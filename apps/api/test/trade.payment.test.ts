import { randomUUID } from 'node:crypto';
import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import type { EventEnvelope } from '@uza/contracts';
import { prisma, resetDb } from './db';
import { resetTradeDb } from './trade-db';
import { orders, vm, approvedChain } from './trade-fixtures';

beforeEach(async () => {
  await resetDb();
  await resetTradeDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

// Finance does not exist yet. These SYNTHETIC envelopes stand in for what Finance will
// publish once it verifies a payment. The handler under test is trade's subscriber.
const verified = (
  orderRef: string,
  trigger: 'confirmation' | 'pre_loading' | 'pre_release',
  eventId = randomUUID(),
): EventEnvelope<'payment.verified'> => ({
  eventId,
  name: 'payment.verified',
  actorId: 'FIN-1',
  occurredAt: new Date().toISOString(),
  payload: { paymentRef: 'PAY-2026-0001', orderRef, trigger, paidFraction: 0.5 },
});

describe('consume payment.verified — installment marking + procurement activation', () => {
  it('marks the confirmation installment paid and activates procurement', async () => {
    const { quotation } = await approvedChain({ completedOrders: 0 });
    const order = await orders.create(vm, quotation.ref);
    expect(order.status).toBe('awaiting_payment');

    const result = await orders.handlePaymentVerified(verified(order.ref, 'confirmation'));
    expect(result.status).toBe('processed');

    const row = await prisma.order.findUniqueOrThrow({ where: { ref: order.ref } });
    expect(row.status).toBe('procurement_active');

    const conf = await prisma.installment.findFirstOrThrow({
      where: { orderRef: order.ref, trigger: 'confirmation' },
    });
    expect(conf.status).toBe('paid');
  });

  it('is idempotent on eventId — a redelivered event is a no-op', async () => {
    const { quotation } = await approvedChain({ completedOrders: 0 });
    const order = await orders.create(vm, quotation.ref);

    const envelope = verified(order.ref, 'confirmation');
    const first = await orders.handlePaymentVerified(envelope);
    const second = await orders.handlePaymentVerified(envelope); // same eventId

    expect(first.status).toBe('processed');
    expect(second.status).toBe('duplicate');

    // Exactly one processed-event row, and no double side effects.
    const processed = await prisma.processedEvent.findMany({
      where: { eventId: envelope.eventId, consumer: 'trade.payment-verified' },
    });
    expect(processed).toHaveLength(1);
    const paidCount = await prisma.installment.count({
      where: { orderRef: order.ref, status: 'paid' },
    });
    expect(paidCount).toBe(1);
  });

  it('a non-confirmation trigger marks its installment paid but does NOT (re)activate the order', async () => {
    const { quotation } = await approvedChain({ completedOrders: 3 }); // established: 30/40/30
    const order = await orders.create(vm, quotation.ref);

    await orders.handlePaymentVerified(verified(order.ref, 'confirmation'));
    await orders.handlePaymentVerified(verified(order.ref, 'pre_loading'));

    const preLoading = await prisma.installment.findFirstOrThrow({
      where: { orderRef: order.ref, trigger: 'pre_loading' },
    });
    expect(preLoading.status).toBe('paid');
    const row = await prisma.order.findUniqueOrThrow({ where: { ref: order.ref } });
    expect(row.status).toBe('procurement_active'); // activated by confirmation, unchanged by pre_loading
  });

  it('throws when no due installment matches the trigger', async () => {
    const { quotation } = await approvedChain({ completedOrders: 0 }); // new: no pre_release installment
    const order = await orders.create(vm, quotation.ref);
    await expect(orders.handlePaymentVerified(verified(order.ref, 'pre_release'))).rejects.toThrow(
      /no due installment/,
    );
  });
});
