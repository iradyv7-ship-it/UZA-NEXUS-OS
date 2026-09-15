/**
 * What was actually run against each system on 30 August 2026, and what happened.
 *
 *   pnpm --filter @uza/api exec tsx prisma/seed-verifications.ts
 *
 * Every row below is a measurement taken by running the command, not a judgement about
 * how a system is going. Where a check was not run, it says `not_run` rather than
 * guessing — an unmeasured system and a passing one must never look the same on the
 * founder's screen.
 *
 * `gaps` is the half that green does not cover. A system can typecheck, pass its tests
 * and build an image while large parts of the business it describes do not exist, and
 * the readiness page reads this field precisely so a green row is never mistaken for a
 * finished one.
 */
import { PrismaClient, type CheckOutcome } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * The date the runs below were performed, not the date this file is executed.
 *
 * 09:00 UTC, which is when the first of them ran. It was 12:00 here originally, which
 * is LATER THAN the moment the seed executed — so the readiness page rendered
 * "verified -1 days ago". `recordVerification()` refuses a future timestamp for exactly
 * this reason; writing through Prisma directly skipped that guard, which is the argument
 * for not doing it. Kept as a direct write only because seeds run before an actor exists.
 */
const VERIFIED_AT = new Date('2026-08-30T09:00:00.000Z');
const BY = 'Claude Code (local run)';

interface Verification {
  systemRef: string;
  typecheck: CheckOutcome;
  tests: CheckOutcome;
  imageBuilds: CheckOutcome;
  testsPassed?: number;
  testsTotal?: number;
  gaps?: string;
  notes?: string;
}

const RUNS: Verification[] = [
  {
    systemRef: 'SYS-2026-0001', // UZA Nexus OS
    typecheck: 'pass',
    tests: 'pass',
    imageBuilds: 'pass',
    testsPassed: 370,
    testsTotal: 370,
    gaps:
      'planning had no test file until today; estate readiness now has 20. The other ' +
      'eight planning services still have no direct coverage.',
    notes: 'API 347 across 46 files, web 23 across 2.',
  },
  {
    systemRef: 'SYS-2026-0003', // uza-mobility-bn
    typecheck: 'pass',
    tests: 'pass',
    imageBuilds: 'pass',
    testsPassed: 149,
    testsTotal: 149,
    gaps:
      'The workshop module has rules and tests but no controller, so no HTTP surface. ' +
      'There are no lender endpoints at all. 4 of 23 modules have any test, against ' +
      '219 endpoints. A fresh database cannot register anyone until Role rows exist, ' +
      'and the production image ships no seed runner.',
    notes:
      'Helmet, rate limiting, body caps, env CORS and gated Swagger added today. The ' +
      'first attempt at rate limiting throttled the whole platform to 5 requests a ' +
      'minute; fixed and re-verified with 30 ordinary requests and 8 logins.',
  },
  {
    systemRef: 'SYS-2026-0004', // uza-mobility-fn
    typecheck: 'pass',
    tests: 'pass',
    imageBuilds: 'not_run',
    testsPassed: 17,
    testsTotal: 17,
    gaps:
      'Lender and workshop portals added today on feat/lender-and-workshop-portals, ' +
      'not merged. Both call endpoints that do not exist yet, so the screens are ahead ' +
      'of their API. These 17 are the first tests this repository has had.',
    notes:
      'Found and fixed a status-code leak: an unentitled lender’s collateral URL ' +
      'answered 200 while an invented bank answered 404, which disclosed that the ' +
      'facility exists. Now refused in the proxy before rendering.',
  },
  {
    systemRef: 'SYS-2026-0005', // uza-mobility-admin
    typecheck: 'not_run',
    tests: 'not_run',
    imageBuilds: 'not_run',
    gaps: 'Not opened today. Recorded so the estate does not imply it was checked.',
  },
  {
    systemRef: 'SYS-2026-0009', // uza-charge
    typecheck: 'pass',
    tests: 'not_applicable',
    imageBuilds: 'pass',
    gaps: 'No test suite exists. Every behaviour in it is unverified.',
  },
  {
    systemRef: 'SYS-2026-0011', // evfleet
    typecheck: 'pass',
    tests: 'not_applicable',
    imageBuilds: 'pass',
    gaps: 'No test suite exists. Every behaviour in it is unverified.',
  },
  {
    systemRef: 'SYS-2026-0010', // Battery-life
    typecheck: 'not_run',
    tests: 'not_run',
    imageBuilds: 'not_run',
    gaps:
      'Not on this machine. Scheduled for retirement; the Windows build failure is a ' +
      'known Lovable plugin path bug and blocks local work, not deployment.',
  },
];

/**
 * Sequence from the highest existing ref, not from `count()`.
 *
 * Same reasoning as `planning-ids.ts`: `count() + 1` collides the moment a row is
 * deleted or created out of order, and it did exactly that in production data on
 * 24 August.
 */
async function nextRef(): Promise<number> {
  const newest = await prisma.systemVerification.findFirst({
    where: { ref: { startsWith: 'VER-2026-' } },
    orderBy: { ref: 'desc' },
  });
  return newest ? Number(newest.ref.slice(-4)) + 1 : 1;
}

async function main() {
  let seq = await nextRef();
  let written = 0;

  for (const run of RUNS) {
    const system = await prisma.systemRecord.findUnique({ where: { ref: run.systemRef } });
    if (!system) {
      console.warn(`skipped ${run.systemRef}: no such system`);
      continue;
    }

    // Idempotent on (system, timestamp): re-running this file does not invent a second
    // measurement of the same moment, which would show as a flat trend that means nothing.
    const already = await prisma.systemVerification.findFirst({
      where: { systemRef: run.systemRef, verifiedAt: VERIFIED_AT },
    });
    if (already) continue;

    await prisma.systemVerification.create({
      data: {
        ref: `VER-2026-${String(seq++).padStart(4, '0')}`,
        systemRef: run.systemRef,
        verifiedAt: VERIFIED_AT,
        typecheck: run.typecheck,
        tests: run.tests,
        imageBuilds: run.imageBuilds,
        ...(run.testsPassed !== undefined ? { testsPassed: run.testsPassed } : {}),
        ...(run.testsTotal !== undefined ? { testsTotal: run.testsTotal } : {}),
        ...(run.gaps ? { gaps: run.gaps } : {}),
        ...(run.notes ? { notes: run.notes } : {}),
        verifiedBy: BY,
      },
    });
    written += 1;
  }

  console.log(`recorded ${written} verification(s) dated ${VERIFIED_AT.toISOString()}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
