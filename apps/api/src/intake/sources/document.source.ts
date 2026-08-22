import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, extname, basename } from 'node:path';
import type { CapturedSignal } from './captured-signal';

/**
 * Watches the working-documents repository — where every artifact is authored before it is
 * published, and where the folder READMEs record each venture's owner, state and next
 * action.
 *
 * There is deliberately no call to a published artifact's URL. Artifacts are private pages
 * behind the founder's own session, and a server that had to hold those credentials to do
 * its job would be a worse thing than the problem it solved. The source of every artifact
 * is a file in this repository; reading the file needs no secret at all.
 *
 * Set UZA_DOCS_DIR to the repository root. A changed README with a new "Next action" is the
 * single highest-value signal this source produces: it means someone moved an initiative on
 * disk and the register does not know yet.
 */
@Injectable()
export class DocumentSource {
  private readonly logger = new Logger(DocumentSource.name);
  private readonly root: string | null;

  private static readonly EXTENSIONS = new Set(['.md', '.html']);
  /**
   * Never descend into these — build output, dependencies, the private lane, and
   * `.claude`, which holds the assistant's own working memory. A register fed from the
   * assistant's notes about the register is a loop, not a signal.
   */
  private static readonly SKIP = new Set([
    '.git', '.claude', 'node_modules', '_private', '_inbox', 'dist', '.next',
  ]);
  private static readonly MAX_BODY = 12_000;

  constructor(config: ConfigService) {
    this.root = config.get<string>('UZA_DOCS_DIR') ?? null;
  }

  get configured(): boolean {
    return this.root !== null;
  }

  async collect(since: Date): Promise<CapturedSignal[]> {
    if (!this.root) {
      this.logger.debug('document source not configured — set UZA_DOCS_DIR');
      return [];
    }
    try {
      return await this.walk(this.root, since);
    } catch (err) {
      this.logger.warn(`could not read ${this.root}: ${(err as Error).message}`);
      return [];
    }
  }

  private async walk(dir: string, since: Date): Promise<CapturedSignal[]> {
    const root = this.root!;
    const out: CapturedSignal[] = [];
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (DocumentSource.SKIP.has(entry.name)) continue;
      const path = join(dir, entry.name);

      if (entry.isDirectory()) {
        out.push(...(await this.walk(path, since)));
        continue;
      }
      if (!DocumentSource.EXTENSIONS.has(extname(entry.name).toLowerCase())) continue;

      const info = await stat(path);
      if (info.mtime <= since) continue;

      const raw = await readFile(path, 'utf8');
      const rel = relative(root, path).replace(/\\/g, '/');
      out.push({
        source: 'artifact',
        // The mtime is part of the id on purpose: an edited document is a NEW signal,
        // because what changed is the thing worth triaging. A file swept twice without
        // being touched keeps the same id and is absorbed by the unique constraint.
        externalId: `${rel}@${info.mtime.toISOString()}`,
        title: this.titleOf(raw, entry.name),
        body: raw.length > DocumentSource.MAX_BODY ? `${raw.slice(0, DocumentSource.MAX_BODY)}\n[truncated]` : raw,
        occurredAt: info.mtime,
      });
    }
    return out;
  }

  private titleOf(raw: string, filename: string): string {
    const html = /<title>([^<]+)<\/title>/i.exec(raw);
    if (html?.[1]) return html[1].trim();
    const md = /^#\s+(.+)$/m.exec(raw);
    if (md?.[1]) return md[1].trim();
    return basename(filename, extname(filename));
  }
}
