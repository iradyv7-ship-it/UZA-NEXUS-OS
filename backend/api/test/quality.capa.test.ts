import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { prisma, resetDb } from './db';
import { resetSourcingQualityDb } from './sourcing-quality-db';
import {
  inspections,
  capas,
  visits,
  francois,
  cecilia,
  agent,
  assignedVisit,
} from './sourcing-quality-fixtures';

beforeEach(async () => {
  await resetDb();
  await resetSourcingQualityDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

/** Record a passing / failing reinspection against a fresh visit on the same PO. */
async function reinspect(poRef: string, result: 'pass' | 'fail') {
  const visit = await visits.assign(cecilia, { poRef, inspectorId: francois.userId });
  const { inspection } = await inspections.record(francois, {
    visitRef: visit.ref,
    stage: 'pre_shipment',
    critical: result === 'fail' ? 1 : 0,
    major: 0,
    minor: 0,
  });
  return inspection;
}

describe('quality — CAPA closes only against a human-approved passing reinspection', () => {
  it('CF-012: a CAPA cannot close on a failed reinspection', async () => {
    const { visit, po } = await assignedVisit();
    const failed = await inspections.record(francois, {
      visitRef: visit.ref,
      stage: 'pre_shipment',
      critical: 1,
      major: 0,
      minor: 0,
    });
    const capa = failed.capa!;

    const badReinspection = await reinspect(po.ref, 'fail');
    await expect(capas.close(cecilia, capa.ref, badReinspection.ref)).rejects.toMatchObject({
      code: 'CAPA_REINSPECTION_FAILED',
    });

    const row = await prisma.capa.findUniqueOrThrow({ where: { ref: capa.ref } });
    expect(row.status).toBe('open');
  });

  it('CF-012: a CAPA closes against a passing reinspection, stamps the human approver, and publishes capa.closed', async () => {
    const { visit, po, supplier } = await assignedVisit();
    const failed = await inspections.record(francois, {
      visitRef: visit.ref,
      stage: 'pre_shipment',
      critical: 1,
      major: 0,
      minor: 0,
    });
    const capa = failed.capa!;

    const goodReinspection = await reinspect(po.ref, 'pass');
    const closed = await capas.close(cecilia, capa.ref, goodReinspection.ref);

    expect(closed.status).toBe('closed');
    expect(closed.closedByReinspectionRef).toBe(goodReinspection.ref);
    expect(closed.closedBy).toBe(cecilia.userId);

    const events = await prisma.outboxEvent.findMany({ where: { name: 'capa.closed' } });
    expect(events).toHaveLength(1);
    expect(events[0]!.payload).toMatchObject({ capaRef: capa.ref, supplierRef: supplier.ref });

    // Now that the only CAPA is closed, the PO releases.
    await expect(inspections.assertReleasable(cecilia, po.ref)).resolves.toBeUndefined();
  });

  it('rejects closing against the very inspection that opened the CAPA', async () => {
    const { visit } = await assignedVisit();
    const failed = await inspections.record(francois, {
      visitRef: visit.ref,
      stage: 'pre_shipment',
      critical: 1,
      major: 0,
      minor: 0,
    });
    const capa = failed.capa!;
    await expect(capas.close(cecilia, capa.ref, capa.inspectionRef)).rejects.toThrow(
      /inspection that opened/,
    );
  });

  it('AI may DRAFT the corrective action but a role lacking capa:approve cannot close (audited)', async () => {
    const { visit, po } = await assignedVisit();
    const failed = await inspections.record(francois, {
      visitRef: visit.ref,
      stage: 'pre_shipment',
      critical: 1,
      major: 0,
      minor: 0,
    });
    const capa = failed.capa!;

    // Drafting does not close.
    const drafted = await capas.draftCorrectiveAction(
      cecilia,
      capa.ref,
      'Re-tool jig, re-run pre-shipment AQL.',
      'ai-drafter',
    );
    expect(drafted.status).toBe('evidence_submitted');
    expect(drafted.correctiveAction).toContain('Re-tool');

    // A sales agent (no capa:approve) is denied and audited.
    const good = await reinspect(po.ref, 'pass');
    await expect(capas.close(agent, capa.ref, good.ref)).rejects.toThrow();
    const deny = await prisma.auditLog.findFirst({
      where: { actorId: agent.userId, resource: 'capa', decision: 'deny' },
    });
    expect(deny).not.toBeNull();
  });
});
