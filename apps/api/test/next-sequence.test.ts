import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from './db';
import { nextSequence } from '../src/platform/ids/next-sequence';

/**
 * The sequence generator, and the production failure it exists to prevent.
 *
 * On 24 August 2026 the register held 32 decisions while the highest ref was
 * `DEC-2026-0033` — somebody had deleted one. `(await count()) + 1` produced
 * `DEC-2026-0033`, which was already taken, and every attempt to raise a decision
 * returned a 500 until the cause was found.
 *
 * The fix was written that day and applied to one module. Twenty-six other call sites
 * kept the broken version until 30 August. These tests cover the shared replacement,
 * and the first one is the exact scenario that failed.
 */

const REF_PREFIX = 'SYS-2026-';
const buildRef = (n: number) => `SYS-2026-${String(n).padStart(4, '0')}`;

async function reset(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "SystemVerification","SystemRecord" RESTART IDENTITY CASCADE',
  );
}

/** Insert a system with a given ref, using the fields the model requires. */
async function seedRef(ref: string): Promise<void> {
  await prisma.systemRecord.create({
    data: { ref, name: ref, kind: 'backend', ownerId: 'CEO-KGL-0001', status: 'building' },
  });
}

beforeEach(reset);
afterAll(async () => {
  await prisma.$disconnect();
});

describe('the failure that actually happened', () => {
  it('does not collide after a row in the middle is deleted', async () => {
    // Three rows, then delete the second. `count() + 1` returns 3 — already taken.
    await seedRef(buildRef(1));
    await seedRef(buildRef(2));
    await seedRef(buildRef(3));
    await prisma.systemRecord.delete({ where: { ref: buildRef(2) } });

    expect(await prisma.systemRecord.count()).toBe(2);
    expect(await nextSequence(prisma.systemRecord, buildRef)).toBe(4);
  });

  it('does not collide when the newest row is the one deleted', async () => {
    // The sequence does not go backwards and reuse a retired ref, which would
    // silently attach new records to an old identifier in anything that kept it.
    await seedRef(buildRef(1));
    await seedRef(buildRef(2));
    await prisma.systemRecord.delete({ where: { ref: buildRef(2) } });

    expect(await nextSequence(prisma.systemRecord, buildRef)).toBe(2);
  });
});

describe('ordinary sequencing', () => {
  it('starts at 1 on an empty table', async () => {
    expect(await nextSequence(prisma.systemRecord, buildRef)).toBe(1);
  });

  it('continues from the highest ref, not the row count', async () => {
    await seedRef(buildRef(7));
    expect(await prisma.systemRecord.count()).toBe(1);
    expect(await nextSequence(prisma.systemRecord, buildRef)).toBe(8);
  });

  it('crosses the padding boundary without going backwards', async () => {
    // Lexical and numeric order agree only while the width is fixed. 0009 → 0010 is
    // the case that proves the zero-padding assumption holds.
    await seedRef(buildRef(9));
    expect(await nextSequence(prisma.systemRecord, buildRef)).toBe(10);

    await seedRef(buildRef(10));
    expect(await nextSequence(prisma.systemRecord, buildRef)).toBe(11);

    await seedRef(buildRef(99));
    expect(await nextSequence(prisma.systemRecord, buildRef)).toBe(100);
  });
});

describe('prefixes keep sequences apart', () => {
  it('ignores refs belonging to another kind', async () => {
    // The estate and the verification log both live in this database. `VER-2026-0042`
    // must not push the next system to 43.
    await seedRef('SYS-2026-0001');
    await seedRef('OTHER-2026-0042');

    expect(await nextSequence(prisma.systemRecord, buildRef)).toBe(2);
  });

  it('accepts a literal prefix as well as a builder', async () => {
    // Fifteen call sites in `planning` and `umurimo` pass `refPrefix('DEC')`. Both
    // forms have to agree, or unifying the helper would have changed behaviour.
    await seedRef(buildRef(5));

    const viaBuilder = await nextSequence(prisma.systemRecord, buildRef);
    const viaPrefix = await nextSequence(prisma.systemRecord, REF_PREFIX);
    expect(viaPrefix).toBe(viaBuilder);
    expect(viaPrefix).toBe(6);
  });
});

describe('what it refuses', () => {
  it('rejects a ref format with no trailing sequence', async () => {
    // Returning 1 forever would collide on the second row. Failing at the first call
    // is louder and cheaper than a duplicate-key error in production.
    await expect(nextSequence(prisma.systemRecord, () => 'DPT-FINANCE')).rejects.toThrow(
      /does not end in a sequence number/,
    );
  });
});
