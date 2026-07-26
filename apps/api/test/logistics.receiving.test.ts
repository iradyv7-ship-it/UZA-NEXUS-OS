import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { UzaError } from '@uza/contracts';
import { prisma, resetDb } from './db';
import { resetLogisticsDb } from './logistics-db';
import { receiving, receiveLot, warehouse, agent, ORDER_REF } from './logistics-fixtures';

beforeEach(async () => {
  await resetDb();
  await resetLogisticsDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe('warehouse receiving — three-way volumetrics', () => {
  it('records measured numbers without touching declared, and emits warehouse.receiptRecorded', async () => {
    const { receipt, packages } = await receiveLot({
      declaredCbm: 4.0,
      declaredKg: 1000,
      packages: [{ kg: 500, cbm: 2.0 }, { kg: 500, cbm: 2.0 }],
    });
    // Declared (factory) preserved; measured (François) computed independently.
    expect(receipt.declaredCbm).toBe(4.0);
    expect(receipt.measuredCbm).toBe(4.0);
    expect(receipt.measuredKg).toBe(1000);
    // revenue ton = max(cbm, kg/1000) = max(4.0, 1.0) = 4.0
    expect(receipt.measuredRevenueTon).toBe(4.0);
    expect(packages).toHaveLength(2);

    const events = await prisma.outboxEvent.findMany({ where: { name: 'warehouse.receiptRecorded' } });
    expect(events).toHaveLength(1);
    const payload = events[0]!.payload as Record<string, unknown>;
    expect(payload.orderRef).toBe(ORDER_REF);
    expect(payload.declaredCbm).toBe(4.0);
    expect(payload.measuredCbm).toBe(4.0);
    expect(payload.discrepancy).toBe(false);
    expect(payload.hardStop).toBe(false);
  });

  // CF-013 — variance beyond CBM_HARD_STOP (0.10) freezes the goods (varianceHold=true).
  it('CF-013: variance beyond the hard stop freezes every package (varianceHold=true)', async () => {
    const { receipt, packages } = await receiveLot({
      declaredCbm: 3.0, // measured 4.0 → variance 0.333 > 0.10
      packages: [{ kg: 500, cbm: 2.0 }, { kg: 500, cbm: 2.0 }],
    });
    expect(receipt.hardStop).toBe(true);
    expect(receipt.discrepancy).toBe(true);
    expect(packages.every((p) => p.varianceHold)).toBe(true);
    // The QC state is untouched by the commercial freeze (CF-014 separation).
    expect(packages.every((p) => p.qcReleased === false)).toBe(true);

    const payload = (await prisma.outboxEvent.findFirstOrThrow({ where: { name: 'warehouse.receiptRecorded' } }))
      .payload as Record<string, unknown>;
    expect(payload.hardStop).toBe(true);
  });

  it('flags a discrepancy inside the hard stop without freezing (supplier-score signal only)', async () => {
    const { receipt, packages } = await receiveLot({
      declaredCbm: 3.7, // measured 4.0 → variance 0.081: >0.05 discrepancy, <0.10 no freeze
      packages: [{ kg: 500, cbm: 2.0 }, { kg: 500, cbm: 2.0 }],
    });
    expect(receipt.discrepancy).toBe(true);
    expect(receipt.hardStop).toBe(false);
    expect(packages.every((p) => p.varianceHold === false)).toBe(true);
  });

  it('resolveVariance clears the commercial hold and emits warehouse.varianceResolved', async () => {
    const { receipt } = await receiveLot({ declaredCbm: 3.0 });
    expect(receipt.hardStop).toBe(true);

    const out = await receiving.resolveVariance(warehouse, receipt.lotRef, 'client_pays', 'client agreed to extra freight');
    expect(out.decision).toBe('client_pays');

    const pkgs = await prisma.package.findMany({ where: { lotRef: receipt.lotRef } });
    expect(pkgs.every((p) => p.varianceHold === false)).toBe(true);

    const resolved = await prisma.warehouseReceipt.findUniqueOrThrow({ where: { lotRef: receipt.lotRef } });
    expect(resolved.decision).toBe('client_pays');
    expect(resolved.decidedBy).toBe(warehouse.userId);

    const events = await prisma.outboxEvent.findMany({ where: { name: 'warehouse.varianceResolved' } });
    expect(events).toHaveLength(1);
    expect((events[0]!.payload as Record<string, unknown>).decision).toBe('client_pays');
  });

  it('rejects an unknown variance decision', async () => {
    const { receipt } = await receiveLot({ declaredCbm: 3.0 });
    await expect(
      // @ts-expect-error deliberately invalid decision
      receiving.resolveVariance(warehouse, receipt.lotRef, 'ignore_it'),
    ).rejects.toBeInstanceOf(UzaError);
  });

  it('offline replay of the same clientRequestId returns the receipt and emits nothing new', async () => {
    const input = {
      orderRef: ORDER_REF,
      customerRef: 'CUS-CD-000001',
      poRef: 'PO-CN-2026-0001',
      declaredCbm: 4.0,
      declaredKg: 1000,
      packages: [{ kg: 500, cbm: 2.0 }, { kg: 500, cbm: 2.0 }],
      clientRequestId: 'device-abc-123',
    };
    const first = await receiving.receivePackages(warehouse, input);
    const second = await receiving.receivePackages(warehouse, input);
    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(await prisma.warehouseReceipt.count()).toBe(1);
    expect(await prisma.outboxEvent.count({ where: { name: 'warehouse.receiptRecorded' } })).toBe(1);
  });

  it('authorises receiving at the service layer — a sales agent is denied (audited)', async () => {
    await expect(receiveLot({ orderRef: ORDER_REF })).resolves.toBeDefined(); // warehouse can
    await expect(
      receiving.receivePackages(agent, {
        orderRef: ORDER_REF,
        customerRef: 'CUS-CD-000001',
        poRef: 'PO-CN-2026-0001',
        declaredCbm: 4.0,
        declaredKg: 1000,
        packages: [{ kg: 500, cbm: 2.0 }],
      }),
    ).rejects.toMatchObject({ code: 'ACCESS_DENIED_ROLE' });
    const denials = await prisma.auditLog.findMany({ where: { decision: 'deny' } });
    expect(denials.length).toBeGreaterThan(0);
  });
});
