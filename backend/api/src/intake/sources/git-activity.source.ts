import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { basename } from 'node:path';
import { promisify } from 'node:util';
import type { CapturedSignal } from './captured-signal';

const execFileAsync = promisify(execFile);

/** ASCII unit/record separators — cannot appear in a commit message, unlike `|` or `\n`. */
const FIELD_SEP = '\x1f';
const RECORD_SEP = '\x1e';

/**
 * Watches commit history across the configured repositories.
 *
 * This is the "harmonise Claude Code and Lovable" source: a commit is a commit regardless
 * of which tool wrote the diff, so this is deliberately the ONE place that answers "what
 * shipped, across the whole estate" without asking which tool gets credit. Splitting it
 * into a "claude source" and a "lovable source" would recreate exactly the two-pipelines
 * problem this module exists to close.
 *
 * `UZA_GIT_REPOS` is a comma-separated list of repository paths — every actively-developed
 * repo the founder wants harmonised into one register, whatever tool built each one:
 * UZA Nexus itself, the Mobility repos, UZA Charge, and any other. The label filed on each
 * signal is the repo's own directory name, so "which repo" is always visible without
 * decoding a path.
 *
 * Same idempotence contract as every other source: `[source, externalId]` is unique, and
 * `externalId` here is `${repoLabel}:${sha}` — a commit is immutable once made, so there is
 * no "edited" case to handle the way DocumentSource has to key on mtime.
 */
@Injectable()
export class GitActivitySource {
  private readonly logger = new Logger(GitActivitySource.name);
  private readonly repos: readonly string[];

  /** Below this a subject is almost always "wip", "typo", "fixup!" — not worth triaging. */
  private static readonly MIN_SUBJECT_CHARS = 8;
  private static readonly NOISE_PREFIXES = ['wip', 'fixup!', 'squash!', 'typo'];

  constructor(config: ConfigService) {
    const raw = config.get<string>('UZA_GIT_REPOS') ?? '';
    this.repos = raw
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
  }

  get configured(): boolean {
    return this.repos.length > 0;
  }

  async collect(since: Date): Promise<CapturedSignal[]> {
    if (!this.repos.length) {
      this.logger.debug('git activity source not configured — set UZA_GIT_REPOS');
      return [];
    }
    const batches = await Promise.all(this.repos.map((repo) => this.collectFrom(repo, since)));
    return batches.flat();
  }

  private async collectFrom(repoPath: string, since: Date): Promise<CapturedSignal[]> {
    const label = basename(repoPath);
    const format = ['%H', '%aI', '%s', '%b'].join(FIELD_SEP) + RECORD_SEP;

    let stdout: string;
    try {
      const result = await execFileAsync(
        'git',
        ['log', '--no-merges', `--since=${since.toISOString()}`, `--pretty=format:${format}`],
        { cwd: repoPath, maxBuffer: 10 * 1024 * 1024 },
      );
      stdout = result.stdout;
    } catch (err) {
      // Not a git repo, git not on PATH, or the path does not exist. One bad repo entry
      // must not take the whole sweep down.
      this.logger.warn(`could not read git log at ${repoPath}: ${(err as Error).message}`);
      return [];
    }

    return this.parse(stdout, label);
  }

  private parse(stdout: string, label: string): CapturedSignal[] {
    const out: CapturedSignal[] = [];
    for (const record of stdout.split(RECORD_SEP)) {
      if (!record.trim()) continue;
      const [sha, dateIso, subject, body] = record.replace(/^\n/, '').split(FIELD_SEP);
      if (!sha || !dateIso || !subject) continue;

      const occurredAt = new Date(dateIso);
      if (Number.isNaN(occurredAt.getTime())) continue;

      const cleanSubject = subject.trim();
      if (cleanSubject.length < GitActivitySource.MIN_SUBJECT_CHARS) continue;
      const lower = cleanSubject.toLowerCase();
      if (GitActivitySource.NOISE_PREFIXES.some((p) => lower.startsWith(p))) continue;

      const cleanBody = (body ?? '').trim();
      out.push({
        source: 'git_commit',
        externalId: `${label}:${sha}`,
        title: `${label}: ${cleanSubject}`,
        body: cleanBody ? `${cleanSubject}\n\n${cleanBody}` : cleanSubject,
        occurredAt,
      });
    }
    return out;
  }
}
