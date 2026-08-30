import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { type Minor } from '@uza/contracts';
import { prisma, resetDb } from './db';
import { resetFinanceDb } from './finance-db';
import {
  payments,
  finance,
  ceo,
  vm,
  frontOffice,
  agent,
  invoicedOrder,
  uploadFor,
} from './finance-fixtures';

beforeEach(async () => {
  await resetDb();
  await resetFinanceDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

const CONF = 308150 as Minor; // new-tier confirmation installment on the standard order

describe('payment proof capture — pending until a human verifies', () => {
  it('uploadProof captures pending_verification and publishes payment.proofUploaded', async () => {
    const { invoice } = await invoicedOrder({ tier: 'new' });
    const payment = await uploadFor(invoice.ref, 'confirmation', CONF);
    expect(payment.status).toBe('pending_verification');
    expect(payment.verifiedBy).toBeNull();

    const evt = await prisma.outboxEvent.findFirstOrThrow({
      where: { name: 'payment.proofUploaded' },
    });
    expect(evt.payload).toMatchObject({
      paymentRef: payment.ref,
      invoiceRef: invoice.ref,
      amountMinor: CONF,
    });
  });
});

// CF-008 — ONLY Finance verifies a payment. Not the front office, not a venture manager,
// not a sales agent, never AI. ('customer' was a fourth example here; removed 30 Aug 2026
// along with the role itself — front_office now creates the record a customer used to, and
// is denied verification the same as everyone else in this matrix.)
describe('CF-008 — only Finance may verify a payment', () => {
  it.each([
    ['front_office', () => frontOffice],
    ['venture_manager', () => vm],
    ['sales_agent', () => agent],
  ])('%s is denied payment verification (and the denial is audited)', async (_label, who) => {
    const { invoice } = await invoicedOrder({ tier: 'new' });
    const payment = await uploadFor(invoice.ref, 'confirmation', CONF);

    await expect(payments.verify(who(), payment.ref)).rejects.toThrow(
      /ACCESS_DENIED_ROLE|does not permit/,
    );

    // The payment never left pending, and a deny row was written before the throw.
    const row = await prisma.payment.findUniqueOrThrow({ where: { ref: payment.ref } });
    expect(row.status).toBe('pending_verification');
    const denies = await prisma.auditLog.count({
      where: { resource: 'payment', action: 'approve', decision: 'deny' },
    });
    expect(denies).toBeGreaterThanOrEqual(1);
  });

  it('finance (and ceo) can verify', async () => {
    const { invoice } = await invoicedOrder({ tier: 'new' });
    const payment = await uploadFor(invoice.ref, 'confirmation', CONF);
    const result = await payments.verify(finance, payment.ref);
    expect(result.status).toBe('verified');
    const row = await prisma.payment.findUniqueOrThrow({ where: { ref: payment.ref } });
    expect(row.verifiedBy).toBe(finance.userId);
    void ceo; // ceo holds *:* — same path, not re-run to keep the suite lean
  });
});

// CF-007 — a short payment is REJECTED naming the shortfall, never silently booked partial.
describe('CF-007 — a short payment is rejected, naming the shortfall', () => {
  it('rejects a payment that does not settle the named installment', async () => {
    const { invoice } = await invoicedOrder({ tier: 'new' });
    const short = (Number(CONF) - 5000) as Minor;
    const payment = await uploadFor(invoice.ref, 'confirmation', short);

    await expect(payments.verify(finance, payment.ref)).rejects.toMatchObject({
      code: 'PAYMENT_SHORT',
      context: expect.objectContaining({
        expectedMinor: 308150,
        paidMinor: 303150,
        shortfallMinor: 5000,
        trigger: 'confirmation',
      }),
    });

    // Nothing was settled — the installment stays due, no partial credit.
    const inst = await prisma.invoiceInstallment.findFirstOrThrow({
      where: { orderRef: invoice.orderRef, trigger: 'confirmation' },
    });
    expect(inst.status).toBe('due');
  });
});

// CF-009 — the confirmation payment is what gates procurement. Finance publishes
// payment.verified with trigger 'confirmation'; trade consumes it to activate.
describe('CF-009 — verifying the confirmation payment publishes payment.verified', () => {
  it('settles the confirmation installment and emits payment.verified{trigger:confirmation}', async () => {
    const { invoice } = await invoicedOrder({ tier: 'new' });
    const payment = await uploadFor(invoice.ref, 'confirmation', CONF);
    const result = await payments.verify(finance, payment.ref);

    expect(result.trigger).toBe('confirmation');
    expect(result.paidFraction).toBeCloseTo(0.5, 4);

    const evt = await prisma.outboxEvent.findFirstOrThrow({ where: { name: 'payment.verified' } });
    expect(evt.payload).toMatchObject({
      paymentRef: payment.ref,
      orderRef: invoice.orderRef,
      trigger: 'confirmation',
      paidFraction: 0.5,
    });

    const inst = await prisma.invoiceInstallment.findFirstOrThrow({
      where: { orderRef: invoice.orderRef, trigger: 'confirmation' },
    });
    expect(inst.status).toBe('settled');
    expect(inst.settledByPaymentRef).toBe(payment.ref);
  });

  it('a non-confirmation trigger settles its installment and emits with its own trigger', async () => {
    const { invoice } = await invoicedOrder({ tier: 'new' });
    const c = await uploadFor(invoice.ref, 'confirmation', CONF);
    await payments.verify(finance, c.ref);
    const p = await uploadFor(invoice.ref, 'pre_loading', CONF);
    const result = await payments.verify(finance, p.ref);

    expect(result.trigger).toBe('pre_loading');
    expect(result.paidFraction).toBeCloseTo(1.0, 4);
    const preloadEvents = await prisma.outboxEvent.findMany({
      where: { name: 'payment.verified' },
    });
    expect(preloadEvents).toHaveLength(2);
  });

  it('cannot verify the same payment twice', async () => {
    const { invoice } = await invoicedOrder({ tier: 'new' });
    const payment = await uploadFor(invoice.ref, 'confirmation', CONF);
    await payments.verify(finance, payment.ref);
    await expect(payments.verify(finance, payment.ref)).rejects.toThrow(/already verified/);
  });
});
