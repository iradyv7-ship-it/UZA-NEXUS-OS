import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { Actor } from '@uza/contracts';
import { prisma } from './db';
import { AuditService } from '../src/platform/audit/audit.service';
import { PlanningAccessService } from '../src/planning/planning-authz.service';
import { EstateService } from '../src/planning/estate/estate.service';

/**
 * The readiness view — what the founder opens to see where each system stands.
 *
 * `planning` is the most-used module in the estate and had no test file named for it.
 * This is the first, and it covers the part most likely to mislead: a dashboard that
 * says green when green is not true.
 *
 * Three ways that happens, all asserted below:
 *
 *  - A system nobody has measured looks fine because nothing is red.
 *  - A pass from three weeks ago is presented as current.
 *  - A count is stored that contradicts itself, and somebody quotes it.
 */

const audit = new AuditService(prisma as never);
const access = new PlanningAccessService(audit);
const estate = new EstateService(prisma as never, access);

const vm: Actor = { userId: 'VM-RW-0001', role: 'venture_manager', office: 'KGL', scope: {} };

const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

async function reset(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "SystemVerification","SystemRecord","AuditLog" RESTART IDENTITY CASCADE',
  );
}

/** Register a system through the public API, the way the founder's team would. */
async function addSystem(name: string, ventureCode = 'MOBILITY') {
  return estate.create(vm, {
    name,
    kind: 'backend',
    ownerId: vm.userId,
    ventureCode,
    status: 'building',
  });
}

const rowFor = (readiness: { systems: Array<{ ref: string }> }, ref: string) =>
  readiness.systems.find((s) => s.ref === ref)!;

beforeEach(reset);
afterAll(async () => {
  await prisma.$disconnect();
});

describe('a system nobody has measured', () => {
  it('is unverified, not green and not failing', () => {
    // The distinction the whole model turns on. Reporting an unmeasured system as
    // green is a lie; reporting it as failing makes the estate look broken and trains
    // people to ignore red. It is a third thing.
    return (async () => {
      const s = await addSystem('uza-charge');
      const r = await estate.readiness(vm);
      expect(rowFor(r, s.ref).state).toBe('unverified');
      expect(r.summary.unverified).toBe(1);
      expect(r.summary.green).toBe(0);
      expect(r.summary.failing).toBe(0);
    })();
  });

  it('reports no checks rather than empty ones', async () => {
    const s = await addSystem('battery-life');
    const r = await estate.readiness(vm);
    expect(rowFor(r, s.ref).checks).toBeNull();
    expect(rowFor(r, s.ref).lastVerifiedAt).toBeNull();
  });
});

describe('green has a shelf life', () => {
  it('is green when the run is recent', async () => {
    const s = await addSystem('uza-mobility-bn');
    await estate.recordVerification(vm, {
      systemRef: s.ref,
      verifiedAt: daysAgo(1),
      typecheck: 'pass',
      tests: 'pass',
      imageBuilds: 'pass',
      testsPassed: 149,
      testsTotal: 149,
      verifiedBy: 'CI',
    });
    const row = rowFor(await estate.readiness(vm), s.ref);
    expect(row.state).toBe('green');
    expect(row.checks?.testsPassed).toBe(149);
  });

  it('goes stale on its own, without anyone having to admit anything', async () => {
    // A passing run from three weeks ago describes a codebase that no longer exists.
    const s = await addSystem('uza-nexus');
    await estate.recordVerification(vm, {
      systemRef: s.ref,
      verifiedAt: daysAgo(21),
      typecheck: 'pass',
      tests: 'pass',
      imageBuilds: 'pass',
      testsPassed: 327,
      testsTotal: 327,
      verifiedBy: 'CI',
    });
    const row = rowFor(await estate.readiness(vm), s.ref);
    expect(row.state).toBe('stale');
    expect(row.daysSinceVerified).toBeGreaterThan(14);
  });

  it('calls a three-week-old failure failing, not stale', async () => {
    // Order matters. If staleness won, a failure would quietly drop off the list by
    // getting older — which is exactly the wrong incentive.
    const s = await addSystem('evfleet');
    await estate.recordVerification(vm, {
      systemRef: s.ref,
      verifiedAt: daysAgo(30),
      typecheck: 'pass',
      tests: 'fail',
      imageBuilds: 'pass',
      testsPassed: 8,
      testsTotal: 12,
      verifiedBy: 'CI',
    });
    expect(rowFor(await estate.readiness(vm), s.ref).state).toBe('failing');
  });

  it('treats any one failed check as failing', async () => {
    const s = await addSystem('uza-mobility-frontend');
    await estate.recordVerification(vm, {
      systemRef: s.ref,
      verifiedAt: daysAgo(1),
      typecheck: 'pass',
      tests: 'pass',
      imageBuilds: 'fail',
      verifiedBy: 'CI',
    });
    expect(rowFor(await estate.readiness(vm), s.ref).state).toBe('failing');
  });

  it('does not treat not_applicable as a failure', async () => {
    // A document has no test suite. Recording that as failing would make the estate
    // look broken when it is merely varied.
    const s = await addSystem('the-estate-map');
    await estate.recordVerification(vm, {
      systemRef: s.ref,
      verifiedAt: daysAgo(1),
      typecheck: 'not_applicable',
      tests: 'not_applicable',
      imageBuilds: 'not_applicable',
      verifiedBy: 'Yves',
    });
    expect(rowFor(await estate.readiness(vm), s.ref).state).toBe('green');
  });
});

describe('the latest run is the one that counts', () => {
  it('reports the most recent measurement, not the first or the best', async () => {
    const s = await addSystem('uza-mobility-bn');
    await estate.recordVerification(vm, {
      systemRef: s.ref, verifiedAt: daysAgo(5),
      typecheck: 'pass', tests: 'pass', imageBuilds: 'pass',
      testsPassed: 140, testsTotal: 140, verifiedBy: 'CI',
    });
    await estate.recordVerification(vm, {
      systemRef: s.ref, verifiedAt: daysAgo(1),
      typecheck: 'pass', tests: 'fail', imageBuilds: 'pass',
      testsPassed: 145, testsTotal: 149, verifiedBy: 'CI',
    });
    const row = rowFor(await estate.readiness(vm), s.ref);
    expect(row.state).toBe('failing');
    expect(row.checks?.testsTotal).toBe(149);
  });

  it('shows a growing suite as growing', async () => {
    const s = await addSystem('uza-nexus');
    await estate.recordVerification(vm, {
      systemRef: s.ref, verifiedAt: daysAgo(7),
      typecheck: 'pass', tests: 'pass', imageBuilds: 'pass',
      testsPassed: 301, testsTotal: 301, verifiedBy: 'CI',
    });
    await estate.recordVerification(vm, {
      systemRef: s.ref, verifiedAt: daysAgo(1),
      typecheck: 'pass', tests: 'pass', imageBuilds: 'pass',
      testsPassed: 327, testsTotal: 327, verifiedBy: 'CI',
    });
    expect(rowFor(await estate.readiness(vm), s.ref).trend).toBe('growing');
  });

  it('flags a shrinking suite, which is how coverage quietly disappears', async () => {
    const s = await addSystem('uzacharge');
    await estate.recordVerification(vm, {
      systemRef: s.ref, verifiedAt: daysAgo(7),
      typecheck: 'pass', tests: 'pass', imageBuilds: 'pass',
      testsPassed: 40, testsTotal: 40, verifiedBy: 'CI',
    });
    await estate.recordVerification(vm, {
      systemRef: s.ref, verifiedAt: daysAgo(1),
      typecheck: 'pass', tests: 'pass', imageBuilds: 'pass',
      testsPassed: 12, testsTotal: 12, verifiedBy: 'CI',
    });
    expect(rowFor(await estate.readiness(vm), s.ref).trend).toBe('shrinking');
  });

  it('says nothing about a trend it cannot see', async () => {
    // One run is not a trend, and guessing one would be inventing information.
    const s = await addSystem('uza-mobility-bn');
    await estate.recordVerification(vm, {
      systemRef: s.ref, verifiedAt: daysAgo(1),
      typecheck: 'pass', tests: 'pass', imageBuilds: 'pass',
      testsPassed: 149, testsTotal: 149, verifiedBy: 'CI',
    });
    expect(rowFor(await estate.readiness(vm), s.ref).trend).toBeNull();
  });
});

describe('a measurement that contradicts itself is refused, not stored', () => {
  it('refuses more passing tests than tests', async () => {
    const s = await addSystem('uza-mobility-bn');
    await expect(
      estate.recordVerification(vm, {
        systemRef: s.ref, testsPassed: 200, testsTotal: 149,
        tests: 'pass', verifiedBy: 'CI',
      }),
    ).rejects.toThrow(/cannot exceed/);
  });

  it('refuses "tests passed" alongside tests that did not pass', async () => {
    // The row somebody would quote in a funder meeting. Better to have no row.
    const s = await addSystem('uza-nexus');
    await expect(
      estate.recordVerification(vm, {
        systemRef: s.ref, testsPassed: 300, testsTotal: 327,
        tests: 'pass', verifiedBy: 'CI',
      }),
    ).rejects.toThrow(/cannot be "pass"/);
  });

  it('refuses a verification dated in the future', async () => {
    // It would sit at the top of the history and never go stale.
    const s = await addSystem('evfleet');
    await expect(
      estate.recordVerification(vm, {
        systemRef: s.ref,
        verifiedAt: new Date(Date.now() + 7 * DAY),
        tests: 'pass', verifiedBy: 'CI',
      }),
    ).rejects.toThrow(/future/);
  });

  it('refuses a verification that does not say who ran it', async () => {
    const s = await addSystem('uzacharge');
    await expect(
      estate.recordVerification(vm, { systemRef: s.ref, tests: 'pass', verifiedBy: '   ' }),
    ).rejects.toThrow(/who ran it/);
  });

  it('refuses a verification against a system that does not exist', async () => {
    await expect(
      estate.recordVerification(vm, { systemRef: 'SYS-2026-9999', verifiedBy: 'CI' }),
    ).rejects.toThrow(/no system/);
  });
});

describe('what the summary is allowed to claim', () => {
  it('counts tests only from systems that reported a count', async () => {
    const measured = await addSystem('uza-mobility-bn');
    await addSystem('never-measured');
    await estate.recordVerification(vm, {
      systemRef: measured.ref, verifiedAt: daysAgo(1),
      typecheck: 'pass', tests: 'pass', imageBuilds: 'pass',
      testsPassed: 149, testsTotal: 149, verifiedBy: 'CI',
    });
    const r = await estate.readiness(vm);
    expect(r.summary.testsPassing).toBe(149);
    expect(r.summary.total).toBe(2);
  });

  it('carries the caveat, so a green row is never read as "finished"', async () => {
    // Builds clean and is finished are different questions, and only the first one is
    // easy to measure. The dashboard has to say so where it is read.
    const r = await estate.readiness(vm);
    expect(r.caveat).toMatch(/does not mean the system is finished/);
  });

  it('keeps the gaps a system reported, because that is the unfinished half', async () => {
    const s = await addSystem('uza-mobility-frontend');
    await estate.recordVerification(vm, {
      systemRef: s.ref, verifiedAt: daysAgo(1),
      typecheck: 'pass', tests: 'pass', imageBuilds: 'pass',
      testsPassed: 12, testsTotal: 12,
      gaps: 'Workshop and lender screens have no API behind them yet.',
      verifiedBy: 'CI',
    });
    expect(rowFor(await estate.readiness(vm), s.ref).gaps).toMatch(/no API behind them/);
  });

  it('leaves retired systems out entirely', async () => {
    const s = await addSystem('battery-life');
    await estate.update(vm, s.ref, { status: 'retired' });
    const r = await estate.readiness(vm);
    expect(r.systems.find((x) => x.ref === s.ref)).toBeUndefined();
  });
});
