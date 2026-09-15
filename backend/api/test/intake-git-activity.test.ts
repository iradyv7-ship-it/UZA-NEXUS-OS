import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ConfigService } from '@nestjs/config';
import { GitActivitySource } from '../src/intake/sources/git-activity.source';

const execFileAsync = promisify(execFile);

/**
 * A real, throwaway git repo — this is the source that harmonises Claude Code and Lovable
 * work into one pipeline view, and the property worth pinning is exactly that it does not
 * care which tool made the commit, only what the commit says.
 */
let dir: string;

async function commit(message: string, iso: string) {
  await execFileAsync('git', ['commit', '--allow-empty', '-m', message], {
    cwd: dir,
    env: { ...process.env, GIT_AUTHOR_DATE: iso, GIT_COMMITTER_DATE: iso },
  });
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'uza-git-activity-'));
  await execFileAsync('git', ['init', '-q'], { cwd: dir });
  await execFileAsync('git', ['config', 'user.email', 'test@uza.local'], { cwd: dir });
  await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: dir });

  await commit('Add the reducing-balance loan calculator', '2026-08-20T09:00:00+02:00');
  await commit('wip', '2026-08-20T09:05:00+02:00');
  await commit('fixup! Add the reducing-balance loan calculator', '2026-08-20T09:06:00+02:00');
  await commit(
    'Fix the collateral release order\n\nStepped release, not lump sum — see the credit-enhancement doc.',
    '2026-08-21T11:00:00+02:00',
  );
}, 20_000);

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

const source = () => new GitActivitySource({ get: () => dir } as unknown as ConfigService);

describe('git activity source', () => {
  it('is unconfigured with no repos set', () => {
    const unconfigured = new GitActivitySource({ get: () => undefined } as unknown as ConfigService);
    expect(unconfigured.configured).toBe(false);
  });

  it('reports configured once a repo path is set', () => {
    expect(source().configured).toBe(true);
  });

  it('captures real commits, labelled by repository', async () => {
    const got = await source().collect(new Date('2026-08-01T00:00:00.000Z'));
    const label = basename(dir);
    const titles = got.map((s) => s.title).sort();
    expect(titles).toContain(`${label}: Add the reducing-balance loan calculator`);
    expect(titles).toContain(`${label}: Fix the collateral release order`);
  });

  it('drops noise commits — wip and fixup! — regardless of length', async () => {
    const got = await source().collect(new Date('2026-08-01T00:00:00.000Z'));
    expect(got.some((s) => s.title.endsWith(': wip'))).toBe(false);
    expect(got.some((s) => s.title.includes('fixup!'))).toBe(false);
  });

  it('includes the commit body when there is one', async () => {
    const got = await source().collect(new Date('2026-08-01T00:00:00.000Z'));
    const withBody = got.find((s) => s.title.endsWith('Fix the collateral release order'));
    expect(withBody?.body).toContain('Stepped release, not lump sum');
  });

  it('keys idempotence on the commit sha, not the message', async () => {
    const got = await source().collect(new Date('2026-08-01T00:00:00.000Z'));
    const refs = got.map((s) => s.externalId);
    expect(new Set(refs).size).toBe(refs.length);
    expect(refs.every((r) => r.startsWith(`${basename(dir)}:`))).toBe(true);
  });

  it('respects the since watermark', async () => {
    const got = await source().collect(new Date('2026-08-20T23:00:00+02:00'));
    expect(got).toHaveLength(1);
    expect(got[0]!.title.endsWith('Fix the collateral release order')).toBe(true);
  });

  it('does not fail the whole sweep when a configured path is not a git repo', async () => {
    const notARepo = await mkdtemp(join(tmpdir(), 'uza-not-a-repo-'));
    try {
      await writeFile(join(notARepo, 'readme.txt'), 'nothing here');
      const bad = new GitActivitySource({ get: () => notARepo } as unknown as ConfigService);
      await expect(bad.collect(new Date('2026-08-01T00:00:00.000Z'))).resolves.toEqual([]);
    } finally {
      await rm(notARepo, { recursive: true, force: true });
    }
  });

  it('collects across multiple configured repositories at once', async () => {
    const second = await mkdtemp(join(tmpdir(), 'uza-git-activity-2-'));
    try {
      await execFileAsync('git', ['init', '-q'], { cwd: second });
      await execFileAsync('git', ['config', 'user.email', 'test@uza.local'], { cwd: second });
      await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: second });
      await execFileAsync('git', ['commit', '--allow-empty', '-m', 'A commit in the second repo'], {
        cwd: second,
        env: { ...process.env, GIT_AUTHOR_DATE: '2026-08-22T09:00:00+02:00', GIT_COMMITTER_DATE: '2026-08-22T09:00:00+02:00' },
      });

      const both = new GitActivitySource({
        get: () => `${dir},${second}`,
      } as unknown as ConfigService);
      const got = await both.collect(new Date('2026-08-01T00:00:00.000Z'));
      expect(got.some((s) => s.title.includes('A commit in the second repo'))).toBe(true);
      expect(got.some((s) => s.title.includes('Fix the collateral release order'))).toBe(true);
    } finally {
      await rm(second, { recursive: true, force: true });
    }
  });
});
