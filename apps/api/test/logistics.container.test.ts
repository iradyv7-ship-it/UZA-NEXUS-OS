import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { prisma, resetDb } from './db';
import { resetLogisticsDb } from './logistics-db';
import {
  receiving, release, containers, orderPayments,
  receiveLot, loadableLot, warehouse, vm, agent, paymentVerified,
  ORDER_REF, ORDER_REF_2, PO_REF, PO_REF_2,
} from './logistics-fixtures';

beforeEach(async () => {
  await resetDb();
  await resetLogisticsDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

const book = (refs: string[], partnerId?: string) =>
  containers.createShipment(vm, {
    packageRefs: refs,
    container: 'MSKU-1234567',
    carrier: 'Maersk',
    etd: '2026-08-01',
    eta: '2026-09-15',
    partnerId,
  });

describe('container booking — three independent gates, in order', () => {
  it('books a container when all gates pass, emits container.assigned, stamps daysWaitingForConsolidation', async () => {
    const { refs } = await loadableLot({ destination: 'KIGALI' });
    const { shipment, daysWaitingForConsolidation } = await book(refs, 'IMARI');

    expect(shipment.destination).toBe('KIGALI');
    expect(shipment.status).toBe('planned');
    expect(typeof daysWaitingForConsolidation).toBe('number');
    expect(shipment.daysWaitingForConsolidation).toBe(daysWaitingForConsolidation);

    const linked = await prisma.package.findMany({ where: { ref: { in: refs } } });
    expect(linked.every((p) => p.shipmentRef === shipment.ref)).toBe(true);

    const events = await prisma.outboxEvent.findMany({ where: { name: 'container.assigned' } });
    expect(events).toHaveLength(1);
    const payload = events[0]!.payload as Record<string, unknown>;
    expect(payload.destination).toBe('KIGALI');
    expect(payload.packageCount).toBe(refs.length);
  });

  // The QC precondition sits before the three commercial gates.
  it('blocks unreleased packages with GATE_QC_NOT_RELEASED before any booking gate', async () => {
    const { packages } = await receiveLot();
    // not QC-released, no destination, no payment — QC precondition must fire FIRST
    await expect(book(packages.map((p) => p.ref))).rejects.toMatchObject({ code: 'GATE_QC_NOT_RELEASED' });
  });

  // GATE 1 (CF-016/017) — volumetric variance resolved. Reads varianceHold, NOT qcReleased.
  it('GATE 1: an unresolved commercial hold blocks with GATE_VARIANCE_UNRESOLVED', async () => {
    // hard-stop receipt → varianceHold=true; QC-release + destination + payment so ONLY gate 1 can fire
    const { receipt, packages } = await receiveLot({ declaredCbm: 3.0 });
    const refs = packages.map((p) => p.ref);
    await release.qcRelease(warehouse, refs);
    await release.allocateDestination(warehouse, refs, 'KIGALI');
    await orderPayments.handlePaymentVerified(paymentVerified({ orderRef: ORDER_REF, trigger: 'pre_loading', paidFraction: 1.0 }));
    expect(receipt.hardStop).toBe(true);

    await expect(book(refs)).rejects.toMatchObject({ code: 'GATE_VARIANCE_UNRESOLVED' });
  });

  // GATE 2 (CF-018) — pre-loading installment paid. Only reached once variance is resolved.
  it('GATE 2: an unpaid pre-loading installment blocks with GATE_PRELOADING_UNPAID', async () => {
    const { refs } = await loadableLot({ destination: 'KIGALI', payPreLoading: false });
    // variance clean, QC released, destination set, but pre-loading not paid
    await expect(book(refs)).rejects.toMatchObject({ code: 'GATE_PRELOADING_UNPAID' });
  });

  // GATE 3 (CF-018/019) — single destination. Containers are destination-pure.
  it('GATE 3: a mixed-destination load blocks with GATE_MIXED_DESTINATION', async () => {
    const a = await loadableLot({ orderRef: ORDER_REF, poRef: PO_REF, destination: 'KIGALI' });
    const b = await loadableLot({ orderRef: ORDER_REF_2, poRef: PO_REF_2, destination: 'GOMA' });
    await expect(book([...a.refs, ...b.refs])).rejects.toMatchObject({ code: 'GATE_MIXED_DESTINATION' });
  });

  it('GATE 3: packages with no destination assigned block with GATE_MIXED_DESTINATION', async () => {
    const { packages } = await receiveLot();
    const refs = packages.map((p) => p.ref);
    await release.qcRelease(warehouse, refs);
    await orderPayments.handlePaymentVerified(paymentVerified({ orderRef: ORDER_REF, trigger: 'pre_loading', paidFraction: 1.0 }));
    // no allocateDestination → destination null
    await expect(book(refs)).rejects.toMatchObject({ code: 'GATE_MIXED_DESTINATION' });
  });

  // ORDER PROOF — a load failing all three gates surfaces gate 1 first, then 2, then 3.
  it('checks the gates strictly in order: variance → pre-loading → destination', async () => {
    // Fails all three: hard-stop hold, unpaid, mixed/unassigned destination.
    const { packages } = await receiveLot({ declaredCbm: 3.0 });
    const refs = packages.map((p) => p.ref);
    await release.qcRelease(warehouse, refs); // clear the QC precondition so gate 1 is first to fire

    // 1) variance fires first
    await expect(book(refs)).rejects.toMatchObject({ code: 'GATE_VARIANCE_UNRESOLVED' });

    // resolve variance → 2) pre-loading fires next
    const receipt = await prisma.warehouseReceipt.findFirstOrThrow({ where: { orderRef: ORDER_REF } });
    await receiving.resolveVariance(warehouse, receipt.lotRef, 'uza_absorbs');
    await expect(book(refs)).rejects.toMatchObject({ code: 'GATE_PRELOADING_UNPAID' });

    // pay pre-loading → 3) destination fires last
    await orderPayments.handlePaymentVerified(paymentVerified({ orderRef: ORDER_REF, trigger: 'pre_loading', paidFraction: 1.0 }));
    await expect(book(refs)).rejects.toMatchObject({ code: 'GATE_MIXED_DESTINATION' });

    // assign destination → books
    await release.allocateDestination(warehouse, refs, 'KIGALI');
    await expect(book(refs)).resolves.toBeDefined();
  });

  it('authorises booking at the service layer — a sales agent is denied', async () => {
    const { refs } = await loadableLot();
    await expect(
      containers.createShipment(agent, { packageRefs: refs, container: 'X', carrier: 'Y', etd: '', eta: '' }),
    ).rejects.toMatchObject({ code: 'ACCESS_DENIED_ROLE' });
  });
});
