import { randomUUID } from 'node:crypto';
import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { prisma, resetDb } from './db';
import { resetSourcingQualityDb } from './sourcing-quality-db';
import {
  deals,
  offers,
  suppliers,
  agent,
  cecilia,
  UNIT_COST,
  acceptedOffer,
  reservedDeal,
} from './sourcing-quality-fixtures';

beforeEach(async () => {
  await resetDb();
  await resetSourcingQualityDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe('sourcing — supplier deal two-stage payment', () => {
  it('reserves a unit only against an ACCEPTED offer, computing booking fee + balance', async () => {
    const { offer } = await acceptedOffer({ qty: 4 });

    const deal = await deals.reserve(cecilia, { offerRef: offer.ref, confirmedBy: 'CEC-1' });

    expect(deal.ref).toMatch(/^DEAL-CN-\d{4}-\d{4}$/);
    expect(deal.status).toBe('reserved');
    expect(deal.qty).toBe(4);
    // 4 units * 500_000 minor (5,000 major units) booking fee per unit.
    expect(deal.bookingFeeMinor).toBe(4 * 500_000);
    expect(deal.totalMinor).toBe(4 * deal.unitCostMinor);
    expect(deal.balanceMinor).toBe(deal.totalMinor - deal.bookingFeeMinor);
    expect(deal.bookingFeeConfirmedBy).toBe('CEC-1');
    expect(deal.bookingFeePaidAt).not.toBeNull();
  });

  it('refuses to reserve against an offer that has not been accepted', async () => {
    const supplier = await suppliers.register(cecilia, {
      nameEn: 'Ningbo EV Traders',
      nameZh: '宁波电动车贸易',
    });
    const offer = await offers.submit(cecilia, {
      supplierRef: supplier.ref,
      unitCostMinor: UNIT_COST,
      qty: 1,
      moq: 1,
      leadTimeDays: 10,
      unitCbm: 2,
      unitKg: 180,
    });
    await expect(deals.reserve(cecilia, { offerRef: offer.ref, confirmedBy: 'CEC-1' })).rejects.toThrow();
  });

  it('requires a human confirmedBy to reserve — never AI, never inferred', async () => {
    const { offer } = await acceptedOffer();
    await expect(
      deals.reserve(cecilia, { offerRef: offer.ref, confirmedBy: '' }),
    ).rejects.toThrow();
  });

  it('a PASSING inspection moves the deal to inspected, then a human opens balance_due', async () => {
    const { deal } = await reservedDeal();

    const inspected = await deals.recordInspectionResult(cecilia, deal.ref, {
      critical: 0,
      major: 0,
      minor: 1,
    });
    expect(inspected.status).toBe('inspected');
    expect(inspected.inspectionResult).toBe('pass');

    const dueDeal = await deals.markBalanceDue(cecilia, deal.ref);
    expect(dueDeal.status).toBe('balance_due');
  });

  it('a CRITICAL defect fails the deal inspection — no override — and blocks the balance step', async () => {
    const { deal } = await reservedDeal();

    const failed = await deals.recordInspectionResult(cecilia, deal.ref, {
      critical: 1,
      major: 0,
      minor: 0,
    });
    expect(failed.status).toBe('inspection_failed');
    expect(failed.inspectionResult).toBe('fail');

    await expect(deals.markBalanceDue(cecilia, deal.ref)).rejects.toThrow();
  });

  it('a CONDITIONAL result reaches "inspected" but does NOT unlock the balance step', async () => {
    const { deal } = await reservedDeal();

    const inspected = await deals.recordInspectionResult(cecilia, deal.ref, {
      critical: 0,
      major: 3, // > MAJOR_CONDITIONAL_AT (2) ⇒ conditional
      minor: 0,
    });
    expect(inspected.status).toBe('inspected');
    expect(inspected.inspectionResult).toBe('conditional');

    await expect(deals.markBalanceDue(cecilia, deal.ref)).rejects.toThrow();
  });

  it('a re-inspection after failure can still pass and reach balance_due', async () => {
    const { deal } = await reservedDeal();
    await deals.recordInspectionResult(cecilia, deal.ref, { critical: 1, major: 0, minor: 0 });

    const reinspected = await deals.recordInspectionResult(cecilia, deal.ref, {
      critical: 0,
      major: 0,
      minor: 0,
      inspectionRef: 'INS-CN-2026-9999',
    });
    expect(reinspected.status).toBe('inspected');
    expect(reinspected.inspectionResult).toBe('pass');
    expect(reinspected.inspectionRef).toBe('INS-CN-2026-9999');

    const dueDeal = await deals.markBalanceDue(cecilia, deal.ref);
    expect(dueDeal.status).toBe('balance_due');
  });

  it('the balance is payable only once balance_due, and requires a human confirmedBy', async () => {
    const { deal } = await reservedDeal();
    await deals.recordInspectionResult(cecilia, deal.ref, { critical: 0, major: 0, minor: 0 });

    // Cannot pay before balance_due.
    await expect(deals.confirmBalancePaid(cecilia, deal.ref, 'CEC-1')).rejects.toThrow();

    await deals.markBalanceDue(cecilia, deal.ref);
    await expect(deals.confirmBalancePaid(cecilia, deal.ref, '')).rejects.toThrow();

    const paid = await deals.confirmBalancePaid(cecilia, deal.ref, 'CEC-1');
    expect(paid.status).toBe('paid');
    expect(paid.balanceConfirmedBy).toBe('CEC-1');
    expect(paid.balancePaidAt).not.toBeNull();

    // Idempotent replay: confirming an already-paid deal is a no-op.
    const again = await deals.confirmBalancePaid(cecilia, deal.ref, 'CEC-1');
    expect(again.status).toBe('paid');
  });

  it('offline replay: a retried transition with the same clientRequestId is a no-op, not a double-apply', async () => {
    const { deal } = await reservedDeal();
    const key = randomUUID();

    const first = await deals.recordInspectionResult(cecilia, deal.ref, {
      critical: 0,
      major: 0,
      minor: 0,
      clientRequestId: key,
    });
    expect(first.status).toBe('inspected');

    // Replaying the same clientRequestId must not re-derive/overwrite state, even with
    // different (wrong) counts arriving on retry — it returns the existing row.
    const replay = await deals.recordInspectionResult(cecilia, deal.ref, {
      critical: 5,
      major: 5,
      minor: 5,
      clientRequestId: key,
    });
    expect(replay.status).toBe('inspected');
    expect(replay.inspectionResult).toBe('pass');

    const events = await prisma.supplierDealEvent.findMany({ where: { clientRequestId: key } });
    expect(events).toHaveLength(1);
  });

  it('denies a sales agent from reserving a deal (audited)', async () => {
    const { offer } = await acceptedOffer();
    await expect(
      deals.reserve(agent, { offerRef: offer.ref, confirmedBy: agent.userId }),
    ).rejects.toThrow();
    const deny = await prisma.auditLog.findFirst({
      where: { actorId: agent.userId, resource: 'po', decision: 'deny' },
    });
    expect(deny).not.toBeNull();
  });
});
