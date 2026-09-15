import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { MIN_DEPOSIT } from '@uza/contracts';
import { prisma, resetDb } from './db';
import { resetTradeDb } from './trade-db';
import {
  orders,
  quotations,
  vm,
  approvedChain,
  SUPPLIER_UNIT,
  standardEst,
} from './trade-fixtures';

beforeEach(async () => {
  await resetDb();
  await resetTradeDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe('order — installment schedule generated from policy, never hardcoded', () => {
  it('CF-005: a new client (0 completed) generates a 50/50 schedule, deposit at the floor', async () => {
    const { quotation } = await approvedChain({ qty: 100, completedOrders: 0 });
    const order = await orders.create(vm, quotation.ref);

    expect(order.tier).toBe('new');
    const insts = await prisma.installment.findMany({
      where: { orderRef: order.ref },
      orderBy: { pct: 'asc' },
    });
    expect(insts.map((i) => i.trigger).sort()).toEqual(['confirmation', 'pre_loading']);
    expect(insts.every((i) => i.pct === 0.5)).toBe(true);

    const deposit = insts.find((i) => i.trigger === 'confirmation')!;
    expect(deposit.pct).toBeGreaterThanOrEqual(MIN_DEPOSIT);

    // parts reconcile EXACTLY to the order total.
    const sum = insts.reduce((a, i) => a + i.amountMinor, 0);
    expect(sum).toBe(order.totalMinor);
  });

  it('CF-006: an established client (>=3 completed) generates 30/40/30', async () => {
    const { quotation } = await approvedChain({ qty: 100, completedOrders: 3 });
    const order = await orders.create(vm, quotation.ref);

    expect(order.tier).toBe('established');
    const insts = await prisma.installment.findMany({ where: { orderRef: order.ref } });
    expect(insts).toHaveLength(3);

    const byTrigger = Object.fromEntries(insts.map((i) => [i.trigger, i.pct]));
    expect(byTrigger['confirmation']).toBe(0.3);
    expect(byTrigger['pre_loading']).toBe(0.4);
    expect(byTrigger['pre_release']).toBe(0.3);
    expect(byTrigger['confirmation']).toBeGreaterThanOrEqual(MIN_DEPOSIT);

    const sum = insts.reduce((a, i) => a + i.amountMinor, 0);
    expect(sum).toBe(order.totalMinor);
  });

  it('publishes order.created into the outbox with the tier and total', async () => {
    const { quotation } = await approvedChain({ qty: 100, completedOrders: 0 });
    const order = await orders.create(vm, quotation.ref);

    const events = await prisma.outboxEvent.findMany({ where: { name: 'order.created' } });
    expect(events).toHaveLength(1);
    const payload = events[0]!.payload as Record<string, unknown>;
    expect(payload.orderRef).toBe(order.ref);
    expect(payload.tier).toBe('new');
    expect(payload.totalMinor).toBe(order.totalMinor);
    expect(order.status).toBe('awaiting_payment'); // procurement only activates on verified confirmation
  });

  it('refuses to create an order from an unapproved quotation', async () => {
    const { project } = await approvedChain();
    // build a fresh draft (not approved)
    const draft = await quotations.build(vm, project.ref, {
      supplierUnitCostMinor: SUPPLIER_UNIT,
      estCostsMinor: standardEst(),
      qty: 5,
      requiredMargin: 0.18,
    });
    await expect(orders.create(vm, draft.ref)).rejects.toThrow(/approved/);
  });

  it('cancels an order and publishes order.cancelled with a reason', async () => {
    const { quotation } = await approvedChain();
    const order = await orders.create(vm, quotation.ref);
    await orders.cancel(vm, order.ref, 'customer withdrew');

    const row = await prisma.order.findUniqueOrThrow({ where: { ref: order.ref } });
    expect(row.status).toBe('cancelled');
    const events = await prisma.outboxEvent.findMany({ where: { name: 'order.cancelled' } });
    expect(events).toHaveLength(1);
    expect((events[0]!.payload as Record<string, unknown>).reason).toBe('customer withdrew');
  });
});
