import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { CapturedSignal } from './captured-signal';

/**
 * Reads Claude Code session transcripts off disk.
 *
 * This is where most of UZA's thinking has actually happened, and none of it has ever
 * reached the register. Every decision the founder typed into a session — a new supplier
 * rule, a structure he settled on, a thing he wants built — is sitting in a JSONL file
 * and nowhere else.
 *
 * Only messages a HUMAN typed are captured. Assistant turns are excluded because a
 * register built from what the assistant said is a register of its own suggestions; tool
 * results are excluded because they are output, not intent. That leaves the founder's own
 * words, which is exactly the material worth triaging.
 *
 * Transcripts live under CLAUDE_PROJECTS_DIR (default: ~/.claude/projects). The sweep is
 * incremental by file mtime and idempotent by `[source, externalId]`, so running it every
 * hour re-reads only what changed and never files the same message twice.
 */
@Injectable()
export class ClaudeCodeSource {
  private readonly logger = new Logger(ClaudeCodeSource.name);
  private readonly root: string;

  /** Below this length a message is almost always "yes", "do that", "continue". */
  private static readonly MIN_CHARS = 60;

  constructor(config: ConfigService) {
    const home = process.env.USERPROFILE ?? process.env.HOME ?? '';
    this.root = config.get<string>('CLAUDE_PROJECTS_DIR') ?? join(home, '.claude', 'projects');
  }

  /**
   * @param since only messages after this instant are returned. Pass the last successful
   *   sweep time; the file-level mtime check makes an unchanged transcript free to skip.
   */
  async collect(since: Date): Promise<CapturedSignal[]> {
    let projects: string[];
    try {
      projects = await readdir(this.root);
    } catch {
      this.logger.warn(`no transcripts at ${this.root} — set CLAUDE_PROJECTS_DIR if they live elsewhere`);
      return [];
    }

    const out: CapturedSignal[] = [];
    for (const project of projects) {
      const dir = join(this.root, project);
      let files: string[];
      try {
        files = (await readdir(dir)).filter((f) => f.endsWith('.jsonl'));
      } catch {
        continue; // not a directory, or unreadable — a stray file in the projects folder
      }

      for (const file of files) {
        const path = join(dir, file);
        try {
          const info = await stat(path);
          if (info.mtime <= since) continue;
          out.push(...this.parse(await readFile(path, 'utf8'), project, since));
        } catch (err) {
          this.logger.warn(`could not read ${path}: ${(err as Error).message}`);
        }
      }
    }
    return out;
  }

  private parse(contents: string, project: string, since: Date): CapturedSignal[] {
    const out: CapturedSignal[] = [];
    for (const line of contents.split('\n')) {
      if (!line.trim()) continue;
      let row: Record<string, any>;
      try {
        row = JSON.parse(line);
      } catch {
        continue; // a partially-flushed last line while a session is live
      }
      if (row.type !== 'user') continue;
      // A tool result is delivered as a user turn. It is output, not something anyone said.
      if (row.toolUseResult !== undefined) continue;
      if (row.isSidechain) continue; // a subagent's prompt, not the founder's

      const at = new Date(row.timestamp);
      if (Number.isNaN(at.getTime()) || at <= since) continue;

      const text = this.textOf(row.message?.content);
      if (!text || text.length < ClaudeCodeSource.MIN_CHARS) continue;
      // System-injected turns wrap themselves in tags; they are not human input.
      if (text.trimStart().startsWith('<')) continue;

      out.push({
        source: 'claude_code',
        externalId: `${row.sessionId ?? project}:${row.uuid}`,
        title: this.titleOf(text),
        body: text,
        occurredAt: at,
      });
    }
    return out;
  }

  private textOf(content: unknown): string | null {
    if (typeof content === 'string') return content.trim();
    if (Array.isArray(content)) {
      const parts = content
        .filter((b: any) => b?.type === 'text' && typeof b.text === 'string')
        .map((b: any) => b.text);
      return parts.length ? parts.join('\n').trim() : null;
    }
    return null;
  }

  /** First sentence or first 90 characters, whichever is shorter. */
  private titleOf(text: string): string {
    const firstLine = text.split('\n').find((l) => l.trim()) ?? text;
    const sentence = firstLine.split(/(?<=[.?!])\s/)[0] ?? firstLine;
    const t = sentence.trim();
    return t.length <= 90 ? t : `${t.slice(0, 87)}...`;
  }
}
