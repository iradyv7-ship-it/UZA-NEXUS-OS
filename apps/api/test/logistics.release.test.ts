import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { prisma, resetDb } from './db';
import { resetLogisticsDb } from './logistics-db';
import {
  receiving, release, qualityGate, receiveLot, warehouse, agent,
  inspectionRecorded, qualityFailed, PO_REF,
} from './logistics-fixtures';

beforeEach(async () => {
  await resetDb();
  await resetLogisticsDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

// CF-014 — THE most important rule of this sprint. qcReleased (QC state) and varianceHold
// (commercial hold) are TWO SEPARATE boolean fields. Neither operation may touch the other.
describe('CF-014 — qcReleased and varianceHold never collapse', () => {
  it('qcRelease flips qcReleased ONLY — it does not clear a commercial hold', async () => {
    // A hard-stop receipt freezes the goods commercially (varianceHold=true).
    const { receipt, packages } = await receiveLot({ declaredCbm: 3.0 });
    expect(packages.every((p) => p.varianceHold)).toBe(true);
    const refs = packages.map((p) => p.ref);

    await release.qcRelease(warehouse, refs);

    const after = await prisma.package.findMany({ where: { lotRef: receipt.lotRef } });
    // QC released...
    expect(after.every((p) => p.qcReleased)).toBe(true);
    expect(after.every((p) => p.zone === 'READY_FOR_LOADING')).toBe(true);
    // ...but the commercial hold SURVIVES. This is the collapse CF-014 forbids.
    expect(after.every((p) => p.varianceHold === true)).toBe(true);
  });

  it('resolveVariance clears varianceHold ONLY — it does not release QC', async () => {
    const { receipt, packages } = await receiveLot({ declaredCbm: 3.0 });
    expect(packages.every((p) => p.qcReleased === false)).toBe(true);

    await receiving.resolveVariance(warehouse, receipt.lotRef, 'uza_absorbs');

    const after = await prisma.package.findMany({ where: { lotRef: receipt.lotRef } });
    // Commercial hold cleared...
    expect(after.every((p) => p.varianceHold === false)).toBe(true);
    // ...but QC is still not released. The two fields moved independently.
    expect(after.every((p) => p.qcReleased === false)).toBe(true);
  });
});

describe('QC release gate — a failed inspection blocks release', () => {
  it('blocks qcRelease while the PO has an unresolved quality failure (GATE_QC_NOT_RELEASED)', async () => {
    const { packages } = await receiveLot({ poRef: PO_REF });
    const refs = packages.map((p) => p.ref);
    await qualityGate.handleQualityFailed(qualityFailed({ poRef: PO_REF }));

    await expect(release.qcRelease(warehouse, refs)).rejects.toMatchObject({ code: 'GATE_QC_NOT_RELEASED' });
    const after = await prisma.package.findMany({ where: { ref: { in: refs } } });
    expect(after.every((p) => p.qcReleased === false)).toBe(true);
  });

  it('a later passing inspection clears the block and release proceeds', async () => {
    const { packages } = await receiveLot({ poRef: PO_REF });
    const refs = packages.map((p) => p.ref);
    await qualityGate.handleQualityFailed(qualityFailed({ poRef: PO_REF }));
    await qualityGate.handleInspectionRecorded(inspectionRecorded({ poRef: PO_REF, result: 'pass' }));

    await release.qcRelease(warehouse, refs);
    const after = await prisma.package.findMany({ where: { ref: { in: refs } } });
    expect(after.every((p) => p.qcReleased)).toBe(true);
  });

  it('a PO with no recorded inspection is not blocked by the quality gate', async () => {
    const { packages } = await receiveLot({ poRef: PO_REF });
    const refs = packages.map((p) => p.ref);
    await expect(release.qcRelease(warehouse, refs)).resolves.toBeDefined();
  });

  it('authorises qcRelease at the service layer — a customer is denied', async () => {
    const { packages } = await receiveLot();
    await expect(release.qcRelease(agent, packages.map((p) => p.ref))).rejects.toMatchObject({
      code: 'ACCESS_DENIED_ROLE',
    });
  });
});
