import { randomUUID } from 'node:crypto';
import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { prisma, resetDb } from './db';
import { resetSourcingQualityDb } from './sourcing-quality-db';
import {
  suppliers, rfqs, pos, cecilia, agent, UNIT_COST, ORDER_REF, PROJECT_REF, suppliedPo,
} from './sourcing-quality-fixtures';

beforeEach(async () => {
  await resetDb();
  await resetSourcingQualityDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe('sourcing — purchase order issuance', () => {
  it('issues a PO with factory-declared volumetrics and publishes po.issued', async () => {
    const { supplier, po } = await suppliedPo({ qty: 100, unitCbm: 0.05, unitKg: 12 });

    expect(po.ref).toMatch(/^PO-CN-\d{4}-\d{4}$/);
    expect(po.poTotalMinor).toBe(UNIT_COST * 100);
    expect(po.declaredCbm).toBeCloseTo(5.0, 3);
    expect(po.declaredKg).toBeCloseTo(1200, 1);

    const events = await prisma.outboxEvent.findMany({ where: { name: 'po.issued' } });
    expect(events).toHaveLength(1);
    const payload = events[0]!.payload as Record<string, unknown>;
    expect(payload).toMatchObject({ poRef: po.ref, supplierRef: supplier.ref, orderRef: ORDER_REF });
  });

  it('records cost basis: an FOB quote is forced inlandSeparable=false, an EXW quote stays true', async () => {
    const supplier = await suppliers.register(cecilia, { nameEn: 'Anhui Freight Co', nameZh: '安徽货运' });

    const fob = await rfqs.addQuote(cecilia, {
      supplierRef: supplier.ref, projectRef: PROJECT_REF, unitCostMinor: UNIT_COST,
      moq: 50, leadTimeDays: 20, unitCbm: 0.05, unitKg: 12, basis: 'FOB',
    });
    const exw = await rfqs.addQuote(cecilia, {
      supplierRef: supplier.ref, projectRef: PROJECT_REF, unitCostMinor: UNIT_COST,
      moq: 50, leadTimeDays: 20, unitCbm: 0.05, unitKg: 12, basis: 'EXW',
    });

    expect(fob.basis).toBe('FOB');
    expect(fob.inlandSeparable).toBe(false);
    expect(exw.basis).toBe('EXW');
    expect(exw.inlandSeparable).toBe(true);

    // Each quote appends a supplier price-history point carrying the basis.
    const history = await prisma.supplierPricePoint.findMany({ where: { supplierRef: supplier.ref } });
    expect(history).toHaveLength(2);
    expect(new Set(history.map((h) => h.basis))).toEqual(new Set(['FOB', 'EXW']));
  });

  it('offline replay: the same clientRequestId returns the existing PO and does NOT re-emit po.issued', async () => {
    const { supplier } = await suppliedPo();
    const key = randomUUID();

    const first = await pos.create(cecilia, {
      supplierRef: supplier.ref, orderRef: ORDER_REF, qty: 10, unitCostMinor: UNIT_COST,
      unitCbm: 0.05, unitKg: 12, clientRequestId: key,
    });
    const second = await pos.create(cecilia, {
      supplierRef: supplier.ref, orderRef: ORDER_REF, qty: 10, unitCostMinor: UNIT_COST,
      unitCbm: 0.05, unitKg: 12, clientRequestId: key,
    });

    expect(second.ref).toBe(first.ref);
    const rows = await prisma.purchaseOrder.findMany({ where: { clientRequestId: key } });
    expect(rows).toHaveLength(1);
    const events = await prisma.outboxEvent.findMany({ where: { name: 'po.issued' } });
    // one from suppliedPo's PO + exactly one from the first create; the replay adds none.
    expect(events.filter((e) => (e.payload as Record<string, unknown>).poRef === first.ref)).toHaveLength(1);
  });

  it('denies a sales agent from creating a purchase order (audited)', async () => {
    const { supplier } = await suppliedPo();
    await expect(
      pos.create(agent, {
        supplierRef: supplier.ref, orderRef: ORDER_REF, qty: 1, unitCostMinor: UNIT_COST, unitCbm: 0.05, unitKg: 12,
      }),
    ).rejects.toThrow();
    const deny = await prisma.auditLog.findFirst({ where: { actorId: agent.userId, resource: 'po', decision: 'deny' } });
    expect(deny).not.toBeNull();
  });
});
