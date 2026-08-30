import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ConfigService } from '@nestjs/config';
import { ClaudeCodeSource } from '../src/intake/sources/claude-code.source';

/**
 * A session transcript is full of turns that LOOK like the founder speaking and are not:
 * task notifications, skill instructions loaded into the turn, and the summary written
 * when a conversation is compacted. The compaction summary is the dangerous one — it
 * restates the entire business, so if it is captured it gets walled, triaged, and read as
 * a fresh instruction.
 *
 * These tests pin the filter against a transcript in the real on-disk shape.
 */
const LONG = 'x'.repeat(70);

const lines = [
  // A real message the founder typed.
  {
    type: 'user',
    origin: { kind: 'human' },
    sessionId: 'S1',
    uuid: 'u-human',
    timestamp: '2026-08-20T10:00:00.000Z',
    message: { role: 'user', content: `we should wholesale the charging piles. ${LONG}` },
  },
  // A task notification. Wrapped in tags, and marked as non-human.
  {
    type: 'user',
    origin: { kind: 'task-notification' },
    sessionId: 'S1',
    uuid: 'u-task',
    timestamp: '2026-08-20T10:01:00.000Z',
    message: { role: 'user', content: `<task-notification>done</task-notification> ${LONG}` },
  },
  // Skill instructions injected into the turn. No origin field, but isMeta is set.
  {
    type: 'user',
    isMeta: true,
    sessionId: 'S1',
    uuid: 'u-meta',
    timestamp: '2026-08-20T10:02:00.000Z',
    message: { role: 'user', content: `Approach this as the design lead at a studio. ${LONG}` },
  },
  // The compaction summary.
  {
    type: 'user',
    isCompactSummary: true,
    sessionId: 'S1',
    uuid: 'u-compact',
    timestamp: '2026-08-20T10:03:00.000Z',
    message: {
      role: 'user',
      content: `This session is being continued from a previous conversation. ${LONG}`,
    },
  },
  // A tool result, delivered as a user turn.
  {
    type: 'user',
    origin: { kind: 'human' },
    toolUseResult: { stdout: 'ok' },
    sessionId: 'S1',
    uuid: 'u-tool',
    timestamp: '2026-08-20T10:04:00.000Z',
    message: { role: 'user', content: `command output ${LONG}` },
  },
  // A subagent's prompt.
  {
    type: 'user',
    origin: { kind: 'human' },
    isSidechain: true,
    sessionId: 'S1',
    uuid: 'u-side',
    timestamp: '2026-08-20T10:05:00.000Z',
    message: { role: 'user', content: `search the repo for the supplier list ${LONG}` },
  },
  // Too short to carry anything.
  {
    type: 'user',
    origin: { kind: 'human' },
    sessionId: 'S1',
    uuid: 'u-short',
    timestamp: '2026-08-20T10:06:00.000Z',
    message: { role: 'user', content: 'do that' },
  },
  // An assistant turn.
  {
    type: 'assistant',
    sessionId: 'S1',
    uuid: 'u-asst',
    timestamp: '2026-08-20T10:07:00.000Z',
    message: { role: 'assistant', content: [{ type: 'text', text: `here is the plan ${LONG}` }] },
  },
  // Content as blocks rather than a bare string — the other shape the transcript uses.
  {
    type: 'user',
    origin: { kind: 'human' },
    sessionId: 'S1',
    uuid: 'u-blocks',
    timestamp: '2026-08-20T10:08:00.000Z',
    message: {
      role: 'user',
      content: [{ type: 'text', text: `the bank wants 10 percent down. ${LONG}` }],
    },
  },
];

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'uza-transcripts-'));
  const project = join(dir, 'some-project');
  await mkdir(project);
  await writeFile(
    join(project, 'S1.jsonl'),
    // A trailing partial line, as happens while a session is still being written.
    `${lines.map((l) => JSON.stringify(l)).join('\n')}\n{"type":"user","incomplete`,
    'utf8',
  );
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

const source = () => new ClaudeCodeSource({ get: () => dir } as unknown as ConfigService);

describe('claude code transcripts', () => {
  it('captures only what a person actually typed', async () => {
    const got = await source().collect(new Date('2026-08-01T00:00:00.000Z'));
    expect(got.map((s) => s.externalId).sort()).toEqual(['S1:u-blocks', 'S1:u-human']);
  });

  it('does not capture the compaction summary, which would read as a fresh instruction', async () => {
    const got = await source().collect(new Date('2026-08-01T00:00:00.000Z'));
    expect(got.some((s) => s.body.includes('continued from a previous conversation'))).toBe(false);
  });

  it('does not capture skill instructions loaded into the turn', async () => {
    const got = await source().collect(new Date('2026-08-01T00:00:00.000Z'));
    expect(got.some((s) => s.body.includes('design lead'))).toBe(false);
  });

  it('survives a partially written last line', async () => {
    await expect(source().collect(new Date('2026-08-01T00:00:00.000Z'))).resolves.toBeDefined();
  });

  it('respects the since watermark', async () => {
    const got = await source().collect(new Date('2026-08-20T10:07:30.000Z'));
    expect(got.map((s) => s.externalId)).toEqual(['S1:u-blocks']);
  });

  it('titles a signal from its first sentence', async () => {
    const got = await source().collect(new Date('2026-08-01T00:00:00.000Z'));
    const human = got.find((s) => s.externalId === 'S1:u-human');
    expect(human?.title).toBe('we should wholesale the charging piles.');
  });

  it('returns nothing rather than throwing when the transcript directory is absent', async () => {
    const missing = new ClaudeCodeSource({
      get: () => join(dir, 'does-not-exist'),
    } as unknown as ConfigService);
    await expect(missing.collect(new Date(0))).resolves.toEqual([]);
  });
});
