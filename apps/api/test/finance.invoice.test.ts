import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { type Minor } from '@uza/contracts';
import { prisma, resetDb } from './db';
import { resetFinanceDb } from './finance-db';
import {
  invoices,
  payments,
  finance,
  invoicedOrder,
  uploadFor,
  orderCreated,
  STANDARD_TOTAL,
} from './finance-fixtures';

beforeEach(async () => {
  await resetDb();
  await resetFinanceDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

// Trade does the order; finance owns the Invoice. These SYNTHETIC order.created envelopes
// stand in for what trade publishes (worker fan-out is wired at integration).
describe('invoice — created from order.created, schedule derived from policy', () => {
  it('creates an invoice and a finance-side installment schedule (new = 50/50)', async () => {
    const { invoice } = await invoicedOrder({ tier: 'new' });
    expect(invoice.totalMinor).toBe(STANDARD_TOTAL);
    expect(invoice.status).toBe('issued');

    const byTrigger = Object.fromEntries(
      invoice.installments.map((i) => [i.trigger, i.amountMinor]),
    );
    expect(byTrigger).toEqual({ confirmation: 308150, pre_loading: 308150 });
    // Parts sum EXACTLY to the total — no cents lost to rounding.
    expect(invoice.installments.reduce((a, i) => a + i.amountMinor, 0)).toBe(STANDARD_TOTAL);
  });

  it('an established order gets a 30/40/30 schedule', async () => {
    const { invoice } = await invoicedOrder({ tier: 'established' });
    const byTrigger = Object.fromEntries(
      invoice.installments.map((i) => [i.trigger, i.amountMinor]),
    );
    expect(byTrigger).toEqual({ confirmation: 184890, pre_loading: 246520, pre_release: 184890 });
    expect(invoice.installments.reduce((a, i) => a + i.amountMinor, 0)).toBe(STANDARD_TOTAL);
  });

  it('is idempotent on eventId — a redelivered order.created does not double-invoice', async () => {
    const event = orderCreated({ tier: 'new' });
    const first = await invoices.handleOrderCreated(event);
    const second = await invoices.handleOrderCreated(event); // same eventId
    expect(first.status).toBe('invoiced');
    expect(second.status).toBe('duplicate');
    expect(await prisma.invoice.count()).toBe(1);
    expect(await prisma.invoiceInstallment.count()).toBe(2);
  });
});

// CF-028 — goods RELEASE requires full payment (not delivery). This is the fully-paid
// determination logistics reads in Sprint 3.
describe('CF-028 — release eligibility is the fully-paid determination', () => {
  it('is not release-eligible while any installment is outstanding, and names the balance', async () => {
    const { invoice } = await invoicedOrder({ tier: 'new' });
    const before = await invoices.releaseEligibility(finance, invoice.orderRef);
    expect(before.fullyPaid).toBe(false);
    expect(before.outstandingMinor).toBe(STANDARD_TOTAL);
    expect(before.outstandingTriggers).toEqual(['confirmation', 'pre_loading']);

    // Settle the confirmation installment only — still not fully paid.
    const p1 = await uploadFor(invoice.ref, 'confirmation', 308150 as Minor);
    await payments.verify(finance, p1.ref);
    const mid = await invoices.releaseEligibility(finance, invoice.orderRef);
    expect(mid.fullyPaid).toBe(false);
    expect(mid.outstandingMinor).toBe(308150);
    expect(mid.outstandingTriggers).toEqual(['pre_loading']);
  });

  it('becomes release-eligible only when every installment is settled', async () => {
    const { invoice } = await invoicedOrder({ tier: 'new' });
    const p1 = await uploadFor(invoice.ref, 'confirmation', 308150 as Minor);
    await payments.verify(finance, p1.ref);
    const p2 = await uploadFor(invoice.ref, 'pre_loading', 308150 as Minor);
    await payments.verify(finance, p2.ref);

    const after = await invoices.releaseEligibility(finance, invoice.orderRef);
    expect(after.fullyPaid).toBe(true);
    expect(after.outstandingMinor).toBe(0);
    const row = await prisma.invoice.findUniqueOrThrow({ where: { ref: invoice.ref } });
    expect(row.status).toBe('paid');
  });
});

// The customerId-scope-isolation test that used to live here (a 'customer' actor reading only
// their own invoice, denied on another's) was removed 30 Aug 2026 along with the 'customer'
// login role — see packages/contracts/src/permissions.ts. No remaining role reaches
// invoices.read() with a customerId-restricted scope (front_office, which now records
// payments on a customer's behalf, sees every invoice unconditionally, same as finance/ceo/
// venture_manager) — the scenario this test modeled is no longer a reachable code path, not
// just an untested one. The underlying customerId branch of inScope() (permissions.ts) still
// exists and is still exercised directly by the sales_agent-scoped tests in trade.list.test.ts.
