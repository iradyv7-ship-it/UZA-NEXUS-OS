import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { prisma, resetDb } from './db';
import { resetLogisticsDb } from './logistics-db';
import {
  containers, freight, loadableLot, vm, M,
  ORDER_REF, ORDER_REF_2, PO_REF, PO_REF_2,
} from './logistics-fixtures';

beforeEach(async () => {
  await resetDb();
  await resetLogisticsDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

const book = (refs: string[]) =>
  containers.createShipment(vm, {
    packageRefs: refs, container: 'MSKU-1', carrier: 'Maersk', etd: '2026-08-01', eta: '2026-09-15', partnerId: 'IMARI',
  });

// CF-021 — freight allocates PRO-RATA by revenue ton = max(cbm, kg/1000), NOT by CBM.
describe('CF-021 — freight allocation by revenue ton', () => {
  it('allocates pro-rata by revenue ton and the rows sum EXACTLY to freight paid', async () => {
    // Order 1: weight-driven revenue ton = max(1.0, 3000/1000) = 3.0
    const a = await loadableLot({ orderRef: ORDER_REF, poRef: PO_REF, destination: 'KIGALI', packages: [{ kg: 3000, cbm: 1.0 }] });
    // Order 2: volume-driven revenue ton = max(5.0, 500/1000) = 5.0
    const b = await loadableLot({ orderRef: ORDER_REF_2, poRef: PO_REF_2, destination: 'KIGALI', packages: [{ kg: 500, cbm: 5.0 }] });

    const { shipment } = await book([...a.refs, ...b.refs]);
    await freight.recordBilledWeight(vm, shipment.ref, 6.5, M(8000));

    const result = await freight.allocateFreight(vm, shipment.ref);
    expect(result.totalRevenueTon).toBe(8.0); // 3.0 + 5.0

    const byOrder = new Map(result.allocations.map((x) => [x.orderRef, x]));
    // 800000 minor * 3/8 = 300000 ; * 5/8 = 500000 — by revenue ton, not by CBM (which is 1:5).
    expect(byOrder.get(ORDER_REF)!.amountMinor).toBe(300000);
    expect(byOrder.get(ORDER_REF_2)!.amountMinor).toBe(500000);
    expect(byOrder.get(ORDER_REF)!.revenueTon).toBe(3.0);

    const sum = result.allocations.reduce((s, x) => s + x.amountMinor, 0);
    expect(sum).toBe(800000); // exactly freight paid

    const rows = await prisma.freightAllocation.findMany({ where: { shipmentRef: shipment.ref } });
    expect(rows).toHaveLength(2);
  });

  it('remainder from rounding goes to the last allocation so the sum stays exact', async () => {
    // Three equal orders over a freight of 100 (10000 minor): 3333 + 3333 + 3334.
    const a = await loadableLot({ orderRef: 'ORD-BULK-2026-0011', poRef: 'PO-CN-2026-0011', destination: 'GOMA', packages: [{ kg: 1000, cbm: 0.5 }] });
    const b = await loadableLot({ orderRef: 'ORD-BULK-2026-0012', poRef: 'PO-CN-2026-0012', destination: 'GOMA', packages: [{ kg: 1000, cbm: 0.5 }] });
    const c = await loadableLot({ orderRef: 'ORD-BULK-2026-0013', poRef: 'PO-CN-2026-0013', destination: 'GOMA', packages: [{ kg: 1000, cbm: 0.5 }] });

    const { shipment } = await book([...a.refs, ...b.refs, ...c.refs]);
    await freight.recordBilledWeight(vm, shipment.ref, 3.0, M(100));
    const result = await freight.allocateFreight(vm, shipment.ref);

    const amounts = result.allocations.map((x) => x.amountMinor).sort((x, y) => x - y);
    expect(amounts).toEqual([3333, 3333, 3334]);
    expect(amounts.reduce((s, x) => s + x, 0)).toBe(10000);
  });
});

describe('billed weight — the third number, and the forwarder claim flag', () => {
  it('records billed onto the shipment without touching measured, flags a claim over threshold', async () => {
    // Combined measured revenue ton = max(1.0+5.0, (3000+500)/1000) = max(6.0, 3.5) = 6.0
    const a = await loadableLot({ orderRef: ORDER_REF, poRef: PO_REF, destination: 'KIGALI', packages: [{ kg: 3000, cbm: 1.0 }] });
    const b = await loadableLot({ orderRef: ORDER_REF_2, poRef: PO_REF_2, destination: 'KIGALI', packages: [{ kg: 500, cbm: 5.0 }] });
    const { shipment } = await book([...a.refs, ...b.refs]);

    // Billed 6.5 > measured 6.0 * 1.02 = 6.12 → claim
    const out = await freight.recordBilledWeight(vm, shipment.ref, 6.5, M(9000));
    expect(out.measuredRevenueTon).toBe(6.0);
    expect(out.billedRevenueTon).toBe(6.5);
    expect(out.claimRaised).toBe(true);

    const persisted = await prisma.shipment.findUniqueOrThrow({ where: { ref: shipment.ref } });
    expect(persisted.measuredRevenueTon).toBe(6.0); // measured preserved
    expect(persisted.billedRevenueTon).toBe(6.5);   // billed stored alongside, not over

    const events = await prisma.outboxEvent.findMany({ where: { name: 'shipment.billedWeightRecorded' } });
    expect(events).toHaveLength(1);
    const payload = events[0]!.payload as Record<string, unknown>;
    expect(payload.claimRaised).toBe(true);
    expect(payload.measuredRevenueTon).toBe(6.0);
  });

  it('billing within tolerance raises no claim flag', async () => {
    const a = await loadableLot({ orderRef: ORDER_REF, poRef: PO_REF, destination: 'KIGALI', packages: [{ kg: 3000, cbm: 1.0 }] });
    const { shipment } = await book([...a.refs]);
    const out = await freight.recordBilledWeight(vm, shipment.ref, 3.0, M(3000));
    expect(out.claimRaised).toBe(false);
  });
});
