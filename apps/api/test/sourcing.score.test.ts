import { randomUUID } from 'node:crypto';
import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { prisma, resetDb } from './db';
import { resetSourcingQualityDb } from './sourcing-quality-db';
import { scores, suppliedPo, receiptEnvelope } from './sourcing-quality-fixtures';
import { varianceScoreDelta, SCORE_CAUSE } from '../src/sourcing/scoring';

beforeEach(async () => {
  await resetDb();
  await resetSourcingQualityDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

// Warehouse is Sprint 3 and does not exist. These SYNTHETIC envelopes stand in for what it
// will publish on receipt. The handler under test is sourcing's subscriber (CF-015 mechanism).
describe('sourcing — declared-vs-measured variance lowers the supplier score (CF-015)', () => {
  it('lowers the score by the variance penalty and logs the change WITH its cause', async () => {
    const { supplier, po } = await suppliedPo();
    expect(supplier.score).toBe(0);

    // 12% over declared: beyond CBM_TOLERANCE, a real discrepancy.
    const env = receiptEnvelope(po.ref, { variance: 0.12, discrepancy: true });
    const result = await scores.handleWarehouseReceipt(env);

    expect(result.status).toBe('scored');
    const expectedDelta = varianceScoreDelta(0.12); // -min(0.12*10, 2.0) = -1.2
    expect(expectedDelta).toBeCloseTo(-1.2, 2);

    const row = await prisma.supplier.findUniqueOrThrow({ where: { ref: supplier.ref } });
    expect(row.score).toBeCloseTo(-1.2, 2);

    // The move is an append-only ledger row carrying the CAUSE and before/after scores.
    const ledger = await prisma.supplierScoreEvent.findMany({ where: { supplierRef: supplier.ref } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({
      cause: SCORE_CAUSE.declaredVsMeasuredVariance,
      previousScore: 0,
      sourceEventId: env.eventId,
    });
    expect(ledger[0]!.newScore).toBeCloseTo(-1.2, 2);
  });

  it('caps the penalty at the policy cap for extreme variance', async () => {
    const { supplier, po } = await suppliedPo();
    const env = receiptEnvelope(po.ref, { variance: 0.5, discrepancy: true, hardStop: true });
    await scores.handleWarehouseReceipt(env);
    const row = await prisma.supplier.findUniqueOrThrow({ where: { ref: supplier.ref } });
    expect(row.score).toBeCloseTo(-2.0, 2); // min(0.5*10, 2.0) = 2.0
  });

  it('a receipt within tolerance (no discrepancy) does not move the score', async () => {
    const { supplier, po } = await suppliedPo();
    const env = receiptEnvelope(po.ref, { variance: 0.02, discrepancy: false });
    const result = await scores.handleWarehouseReceipt(env);
    expect(result.status).toBe('no_change');
    const row = await prisma.supplier.findUniqueOrThrow({ where: { ref: supplier.ref } });
    expect(row.score).toBe(0);
    expect(await prisma.supplierScoreEvent.count()).toBe(0);
  });

  it('is idempotent on eventId — a redelivered receipt cannot double-penalise', async () => {
    const { supplier, po } = await suppliedPo();
    const env = receiptEnvelope(po.ref, { variance: 0.12, discrepancy: true, eventId: randomUUID() });

    const first = await scores.handleWarehouseReceipt(env);
    const second = await scores.handleWarehouseReceipt(env); // same eventId

    expect(first.status).toBe('scored');
    expect(second.status).toBe('duplicate');

    const row = await prisma.supplier.findUniqueOrThrow({ where: { ref: supplier.ref } });
    expect(row.score).toBeCloseTo(-1.2, 2); // applied once, not twice
    expect(await prisma.supplierScoreEvent.count({ where: { supplierRef: supplier.ref } })).toBe(1);
  });
});
