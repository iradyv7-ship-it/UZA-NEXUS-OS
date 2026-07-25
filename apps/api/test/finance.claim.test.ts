import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { prisma, resetDb } from './db';
import { resetFinanceDb } from './finance-db';
import { ForwarderClaimService } from '../src/finance/claim/forwarder-claim.service';
import { claims, finance, billedWeight } from './finance-fixtures';

beforeEach(async () => {
  await resetDb();
  await resetFinanceDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

// CF-020 — forwarder over-billing raises a CLAIM against the forwarder, not a client
// conversation. Measured-vs-billed beyond BILLING_CLAIM_THRESHOLD (2%) is the trigger.
// Logistics is Sprint 3, so these are SYNTHETIC shipment.billedWeightRecorded envelopes.
describe('CF-020 — forwarder over-billing raises a claim + notifies finance', () => {
  it('assess() is the single threshold rule: over 2% is warranted', () => {
    expect(ForwarderClaimService.assess(10, 10.2).warranted).toBe(false); // exactly at threshold
    expect(ForwarderClaimService.assess(10, 10.5).warranted).toBe(true);
    expect(ForwarderClaimService.assess(10, 10.5).overRevenueTon).toBeCloseTo(0.5, 3);
  });

  it('raises a claim and notifies finance when billed exceeds measured beyond threshold', async () => {
    const env = billedWeight({ measuredRevenueTon: 10, billedRevenueTon: 10.5 });
    const result = await claims.handleBilledWeightRecorded(env);
    expect(result.status).toBe('claim_raised');

    const claim = await prisma.forwarderClaim.findFirstOrThrow({ where: { shipmentRef: env.payload.shipmentRef } });
    expect(claim.measuredRevenueTon).toBe(10);
    expect(claim.billedRevenueTon).toBe(10.5);
    expect(claim.overRevenueTon).toBeCloseTo(0.5, 3);
    expect(claim.status).toBe('raised');

    // Finance is told — and no customer is addressed.
    const notes = await prisma.notification.findMany({ where: { subjectRef: env.payload.shipmentRef } });
    expect(notes).toHaveLength(1);
    expect(notes[0]!.audience).toBe('finance');
  });

  it('a billing within tolerance raises no claim', async () => {
    const env = billedWeight({ measuredRevenueTon: 10, billedRevenueTon: 10.1 });
    const result = await claims.handleBilledWeightRecorded(env);
    expect(result.status).toBe('within_tolerance');
    expect(await prisma.forwarderClaim.count()).toBe(0);
  });

  it('is idempotent on eventId — a redelivered billing cannot double-claim', async () => {
    const env = billedWeight({ measuredRevenueTon: 10, billedRevenueTon: 10.5 });
    const first = await claims.handleBilledWeightRecorded(env);
    const second = await claims.handleBilledWeightRecorded(env); // same eventId
    expect(first.status).toBe('claim_raised');
    expect(second.status).toBe('duplicate');
    expect(await prisma.forwarderClaim.count()).toBe(1);
  });
});
