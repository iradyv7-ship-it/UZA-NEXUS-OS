import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { COMMISSION_RATE, type Minor } from '@uza/contracts';
import { prisma, resetDb } from './db';
import { resetFinanceDb } from './finance-db';
import {
  payments, commissions, finance, agent, customer,
  invoicedOrder, uploadFor, orderCancelled, STANDARD_TOTAL,
} from './finance-fixtures';

beforeEach(async () => {
  await resetDb();
  await resetFinanceDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

const CONF = 308150 as Minor;
const EXPECTED_COMMISSION = Math.round(Number(STANDARD_TOTAL) * COMMISSION_RATE); // 2% of 616300 = 12326

async function confirmOrder(opts: Parameters<typeof invoicedOrder>[0] = {}) {
  const { invoice } = await invoicedOrder({ tier: 'new', ...opts });
  const payment = await uploadFor(invoice.ref, 'confirmation', CONF, customer);
  await payments.verify(finance, payment.ref);
  return invoice;
}

// CF-010 — 2% commission accrues when the CONFIRMATION installment is verified (deposit),
// NOT at order creation and NOT at delivery. Every movement is a ledger ROW.
describe('CF-010 — commission accrues 2% at confirmation, as a ledger row', () => {
  it('writes one accrual row for 2% of the order total and publishes commission.accrued', async () => {
    const invoice = await confirmOrder();

    const rows = await prisma.commissionEntry.findMany({ where: { orderRef: invoice.orderRef } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: 'accrual', agentId: agent.userId, amountMinor: EXPECTED_COMMISSION });

    const balance = await commissions.balanceFor(finance, agent.userId);
    expect(balance.balanceMinor).toBe(EXPECTED_COMMISSION);

    const evt = await prisma.outboxEvent.findFirstOrThrow({ where: { name: 'commission.accrued' } });
    expect(evt.payload).toMatchObject({ agentId: agent.userId, orderRef: invoice.orderRef, amountMinor: EXPECTED_COMMISSION });
  });

  it('does NOT accrue at order creation — an unpaid order carries no commission', async () => {
    const { invoice } = await invoicedOrder({ tier: 'new' });
    expect(await prisma.commissionEntry.count({ where: { orderRef: invoice.orderRef } })).toBe(0);
  });

  it('an order with no agent accrues no commission', async () => {
    await confirmOrder({ agentId: '' });
    expect(await prisma.commissionEntry.count()).toBe(0);
  });

  it('accrues once even if the confirmation path is somehow re-driven', async () => {
    const invoice = await confirmOrder();
    // A second confirmation upload cannot re-verify (installment already settled) and
    // therefore cannot double-accrue.
    const dup = await uploadFor(invoice.ref, 'confirmation', CONF, customer);
    await expect(payments.verify(finance, dup.ref)).rejects.toThrow(/no due installment/);
    expect(await prisma.commissionEntry.count({ where: { orderRef: invoice.orderRef, type: 'accrual' } })).toBe(1);
  });
});

// CF-030 — clawback on cancellation reverses the accrual and leaves BOTH rows. A corrected
// balance with no history is a failure. Both the agent and Finance are notified.
describe('CF-030 — clawback reverses the accrual and keeps both rows', () => {
  it('adds a negative clawback row, nets the balance to zero, notifies agent + finance', async () => {
    const invoice = await confirmOrder();

    const result = await commissions.handleOrderCancelled(orderCancelled(invoice.orderRef, 'buyer defaulted'));
    expect(result.status).toBe('clawed_back');

    // BOTH rows survive — the accrual is not deleted or edited.
    const rows = await prisma.commissionEntry.findMany({
      where: { orderRef: invoice.orderRef }, orderBy: { createdAt: 'asc' },
    });
    expect(rows.map((r) => r.type)).toEqual(['accrual', 'clawback']);
    expect(rows[0]!.amountMinor).toBe(EXPECTED_COMMISSION);
    expect(rows[1]!.amountMinor).toBe(-EXPECTED_COMMISSION);

    const balance = await commissions.balanceFor(finance, agent.userId);
    expect(balance.balanceMinor).toBe(0);

    // commission.clawedBack published, agent + finance notified.
    const evt = await prisma.outboxEvent.findFirstOrThrow({ where: { name: 'commission.clawedBack' } });
    expect(evt.payload).toMatchObject({ agentId: agent.userId, orderRef: invoice.orderRef, amountMinor: EXPECTED_COMMISSION, reason: 'buyer defaulted' });
    const audiences = (await prisma.notification.findMany({ where: { subjectRef: invoice.orderRef } })).map((n) => n.audience);
    expect(audiences).toEqual(expect.arrayContaining(['agent', 'finance']));
  });

  it('is idempotent on eventId — a redelivered cancellation cannot double-claw', async () => {
    const invoice = await confirmOrder();
    const envelope = orderCancelled(invoice.orderRef, 'buyer defaulted');
    const first = await commissions.handleOrderCancelled(envelope);
    const second = await commissions.handleOrderCancelled(envelope); // same eventId
    expect(first.status).toBe('clawed_back');
    expect(second.status).toBe('duplicate');
    expect(await prisma.commissionEntry.count({ where: { orderRef: invoice.orderRef, type: 'clawback' } })).toBe(1);
  });

  it('cancelling an order that never confirmed is a no-op (nothing to reverse)', async () => {
    const { invoice } = await invoicedOrder({ tier: 'new' }); // never paid → never accrued
    const result = await commissions.handleOrderCancelled(orderCancelled(invoice.orderRef, 'cold feet'));
    expect(result.status).toBe('no_accrual');
    expect(await prisma.commissionEntry.count()).toBe(0);
  });
});
