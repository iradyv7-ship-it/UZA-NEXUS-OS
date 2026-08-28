import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import { prisma } from './db';
import { AuditService } from '../src/platform/audit/audit.service';
import { UzaIdService } from '../src/platform/uza-id/uza-id.service';
import {
  LenderViewService,
  type LenderDataSource,
} from '../src/platform/lender-view/lender-view.service';

const audit = new AuditService(prisma as never);
const ids = new UzaIdService(prisma as never);

/** A source where everything is instrumented, so redaction has something to remove. */
const FULL: LenderDataSource = {
  training: async () => ({ programme: 'Tunga Taxi', completedAt: '2026-10-17', assessmentPassed: true }),
  wallet: async () => ({
    allocations: { loan: 780_000, charging: 78_000, maintenance: 78_000, saving: 78_000 },
    windowStart: '2026-09-01',
    windowEnd: '2026-09-30',
    reserveStatus: 'behind' as const,
    arrearsStatus: 'current' as const,
  }),
  utilisation: async () => ({
    windowStart: '2026-09-01', windowEnd: '2026-09-30', productiveDays: 24, windowDays: 26,
  }),
  inspections: async () => [
    { performedAt: '2026-09-15', outcome: 'pass', batteryStateOfHealthPct: 94 },
  ],
  creditEnhancement: async () => ({
    facility: 'cash collateral', depositedRwf: 750_000, releasedRwf: 0, callableRwf: 750_000,
  }),
};

const full = new LenderViewService(prisma as never, audit, FULL);
const bare = new LenderViewService(prisma as never, audit); // nothing instrumented

beforeAll(() => {
  process.env['UZA_ID_PEPPER'] = 'test-pepper-not-a-real-secret';
});

async function reset(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "LenderBorrower","PersonLink","Person","AuditLog" RESTART IDENTITY CASCADE',
  );
}

/** A consenting borrower of `lender`. Returns the UZA ID. */
async function borrower(lender: string, externalId = 'm-1'): Promise<string> {
  const p = await ids.resolve({ system: 'mobility', externalId, displayName: 'A Borrower' });
  await full.registerBorrower({ personRef: p.ref, lender, loanRef: 'L-1' });
  await full.setConsent(p.ref, lender, true);
  return p.ref;
}

beforeEach(reset);
afterAll(async () => { await prisma.$disconnect(); });

describe('the cash-collateral wall, end to end', () => {
  it('shows the collateral to Unguka', async () => {
    const ref = await borrower('unguka');
    const { file } = await full.view('unguka', ref);
    expect(file.creditEnhancement?.depositedRwf).toBe(750_000);
  });

  it('never shows it to any other lender, even when the source supplies it', async () => {
    // The source deliberately returns a collateral position for everyone. Only redaction
    // stands between that and a disclosure — which is exactly what this asserts.
    for (const lender of ['jali', 'equity', 'ncba', 'bank of kigali']) {
      await reset();
      const ref = await borrower(lender);
      const { file } = await full.view(lender, ref);
      expect(file.creditEnhancement, `${lender} must never see the collateral`).toBeUndefined();
      expect(file.training?.assessmentPassed).toBe(true); // but still gets its own file
    }
  });
});

describe('a lender sees only its own consenting borrowers', () => {
  it('serves its own borrower', async () => {
    const ref = await borrower('equity');
    const { file } = await full.view('equity', ref);
    expect(file.uzaId).toBe(ref);
  });

  it('refuses another lender’s borrower', async () => {
    const ref = await borrower('equity');
    await expect(full.view('ncba', ref)).rejects.toThrow(/No file available/);
  });

  it('refuses without consent, and after it is withdrawn', async () => {
    const p = await ids.resolve({ system: 'mobility', externalId: 'm-9', displayName: 'B' });
    await full.registerBorrower({ personRef: p.ref, lender: 'equity' });
    await expect(full.view('equity', p.ref)).rejects.toThrow(/No file available/);

    await full.setConsent(p.ref, 'equity', true);
    await expect(full.view('equity', p.ref)).resolves.toBeDefined();

    await full.setConsent(p.ref, 'equity', false);
    await expect(full.view('equity', p.ref)).rejects.toThrow(/No file available/);
  });

  it('gives an identical refusal for an unknown ID and for someone else’s borrower', async () => {
    // If these differed, a lender could walk UZA IDs to learn who is a UZA client — a
    // disclosure even when the answer is no.
    const ref = await borrower('equity');
    const notMine = await full.view('ncba', ref).catch((e) => e.message);
    const unknown = await full.view('ncba', 'UZA-P-999999').catch((e) => e.message);
    expect(notMine).toBe(unknown);
  });

  it('does not treat consent to one lender as consent to another', async () => {
    const ref = await borrower('unguka');
    await full.registerBorrower({ personRef: ref, lender: 'equity' }); // entitled, no consent
    await expect(full.view('equity', ref)).rejects.toThrow(/No file available/);
    await expect(full.view('unguka', ref)).resolves.toBeDefined();
  });
});

describe('every disclosure and every refusal is recorded', () => {
  it('writes an allow with the lender and the borrower', async () => {
    const ref = await borrower('unguka');
    await full.view('unguka', ref);
    const row = await prisma.auditLog.findFirst({
      where: { resource: 'lender-view', decision: 'allow' },
      orderBy: { createdAt: 'desc' },
    });
    expect(row?.actorId).toBe('lender:unguka');
    expect(row?.actorRole).toBe('lender');
    expect(row?.targetRef).toBe(ref);
  });

  it('writes a deny WITH the reason, even though the caller is told nothing', async () => {
    const ref = await borrower('equity');
    await full.view('ncba', ref).catch(() => undefined);
    const row = await prisma.auditLog.findFirst({
      where: { resource: 'lender-view', decision: 'deny' },
      orderBy: { createdAt: 'desc' },
    });
    // A lender repeatedly asking about people who are not its borrowers is worth noticing.
    expect(row?.reason).toBe('not-this-lenders-borrower');
    expect(row?.actorId).toBe('lender:ncba');
  });
});

describe('absent is not zero', () => {
  it('names the sections no live system feeds yet', async () => {
    const ref = await borrower('unguka');
    const { file, notYetInstrumented } = await bare.view('unguka', ref);
    // A credit committee shown an empty training section would read it as "no training".
    // Absent plus a named gap reads as "we are not measuring this yet", which is the truth.
    expect(file.training).toBeUndefined();
    expect(notYetInstrumented).toEqual(['training', 'wallet', 'utilisation', 'inspections']);
  });

  it('reports nothing missing once the sources are live', async () => {
    const ref = await borrower('unguka');
    const { notYetInstrumented } = await full.view('unguka', ref);
    expect(notYetInstrumented).toEqual([]);
  });
});

describe('reserve behind is not arrears', () => {
  it('passes both through as separate fields', async () => {
    const ref = await borrower('unguka');
    const { file } = await full.view('unguka', ref);
    expect(file.wallet?.reserveStatus).toBe('behind');
    expect(file.wallet?.arrearsStatus).toBe('current');
  });
});

describe('registration is idempotent', () => {
  it('does not create a second entitlement, or lose consent, on re-registration', async () => {
    const ref = await borrower('unguka');
    await full.registerBorrower({ personRef: ref, lender: 'unguka', loanRef: 'L-2' });
    const rows = await prisma.lenderBorrower.findMany({ where: { personRef: ref } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.loanRef).toBe('L-2');
    await expect(full.view('unguka', ref)).resolves.toBeDefined();
  });
});
