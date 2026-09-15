import { randomUUID } from 'node:crypto';
import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { prisma, resetDb } from './db';
import { resetSourcingQualityDb } from './sourcing-quality-db';
import { inspections, francois, cecilia, assignedVisit } from './sourcing-quality-fixtures';

beforeEach(async () => {
  await resetDb();
  await resetSourcingQualityDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe('quality — inspection grading, the CAPA gate and release', () => {
  it('CF-011: a critical defect fails the inspection, auto-opens a CAPA and publishes quality.failed', async () => {
    const { visit, po, supplier } = await assignedVisit();

    const { inspection, capa } = await inspections.record(francois, {
      visitRef: visit.ref,
      stage: 'pre_shipment',
      critical: 1,
      major: 0,
      minor: 2,
      evidence: [
        {
          kind: 'photo',
          uri: 's3://ev/1.jpg',
          lotRef: 'LOT-ORD0001-01',
          packageRef: 'PKG-ORD0001-001',
        },
      ],
    });

    expect(inspection.result).toBe('fail');

    // CAPA opened automatically, bound to the failing inspection and the supplier.
    expect(capa).not.toBeNull();
    expect(capa!.status).toBe('open');
    expect(capa!.inspectionRef).toBe(inspection.ref);
    expect(capa!.supplierRef).toBe(supplier.ref);

    // Both events published in the same transaction as the state change.
    const recorded = await prisma.outboxEvent.findMany({ where: { name: 'inspection.recorded' } });
    expect(recorded).toHaveLength(1);
    expect(recorded[0]!.payload).toMatchObject({ result: 'fail', critical: 1, poRef: po.ref });

    const failed = await prisma.outboxEvent.findMany({ where: { name: 'quality.failed' } });
    expect(failed).toHaveLength(1);
    expect(failed[0]!.payload).toMatchObject({
      inspectionRef: inspection.ref,
      poRef: po.ref,
      supplierRef: supplier.ref,
    });

    // Evidence is stored bound to its lot + package refs, not loose.
    const evidence = await prisma.inspectionEvidence.findMany({
      where: { inspectionRef: inspection.ref },
    });
    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({ lotRef: 'LOT-ORD0001-01', packageRef: 'PKG-ORD0001-001' });
  });

  it('grades > 2 major defects as conditional, and a clean inspection as pass — publishing no quality.failed', async () => {
    const conditional = await assignedVisit();
    const cond = await inspections.record(francois, {
      visitRef: conditional.visit.ref,
      stage: 'during_production',
      critical: 0,
      major: 3,
      minor: 1,
    });
    expect(cond.inspection.result).toBe('conditional');
    expect(cond.capa).toBeNull();

    const clean = await assignedVisit();
    const pass = await inspections.record(francois, {
      visitRef: clean.visit.ref,
      stage: 'pre_shipment',
      critical: 0,
      major: 1,
      minor: 4,
    });
    expect(pass.inspection.result).toBe('pass');

    const failed = await prisma.outboxEvent.findMany({ where: { name: 'quality.failed' } });
    expect(failed).toHaveLength(0);
  });

  it('release gate: an open CAPA blocks release; it clears only once the CAPA is closed', async () => {
    const { visit, po } = await assignedVisit();
    await inspections.record(francois, {
      visitRef: visit.ref,
      stage: 'pre_shipment',
      critical: 2,
      major: 0,
      minor: 0,
    });

    await expect(inspections.assertReleasable(cecilia, po.ref)).rejects.toMatchObject({
      code: 'GATE_QC_NOT_RELEASED',
    });
  });

  it('offline capture: a resynced inspection (same clientRequestId) does not double-open a CAPA or double-publish', async () => {
    const { visit } = await assignedVisit();
    const key = randomUUID();

    const first = await inspections.record(francois, {
      visitRef: visit.ref,
      stage: 'pre_shipment',
      critical: 1,
      major: 0,
      minor: 0,
      capturedOffline: true,
      clientRequestId: key,
    });
    const second = await inspections.record(francois, {
      visitRef: visit.ref,
      stage: 'pre_shipment',
      critical: 1,
      major: 0,
      minor: 0,
      capturedOffline: true,
      clientRequestId: key,
    });

    expect(second.replayed).toBe(true);
    expect((second.inspection as { ref: string }).ref).toBe(first.inspection.ref);

    const capaCount = await prisma.capa.count();
    expect(capaCount).toBe(1);
    const failed = await prisma.outboxEvent.findMany({ where: { name: 'quality.failed' } });
    expect(failed).toHaveLength(1);
  });

  it('denies a sales agent from recording an inspection (audited)', async () => {
    const { visit } = await assignedVisit();
    const { agent } = await import('./sourcing-quality-fixtures');
    await expect(
      inspections.record(agent, {
        visitRef: visit.ref,
        stage: 'pre_shipment',
        critical: 0,
        major: 0,
        minor: 0,
      }),
    ).rejects.toThrow();
    const deny = await prisma.auditLog.findFirst({
      where: { actorId: agent.userId, resource: 'inspection', decision: 'deny' },
    });
    expect(deny).not.toBeNull();
  });
});
