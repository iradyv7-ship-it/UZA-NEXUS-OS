import { randomUUID } from 'node:crypto';
import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { inScope, type EventEnvelope, type Minor } from '@uza/contracts';
import { prisma, resetDb } from './db';
import { resetFinanceDb } from './finance-db';
import {
  invoices,
  payments,
  finance,
  ceo,
  vm,
  agent,
  customer,
  invoicedOrder,
  uploadFor,
  STANDARD_TOTAL,
  CUSTOMER_REF,
  AGENT_ID,
} from './finance-fixtures';
import { financeScopeWhere } from '../src/finance/list-scope';

beforeEach(async () => {
  await resetDb();
  await resetFinanceDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

const CONF = 308150 as Minor; // new-tier confirmation installment on the standard order

// A SECOND customer + their own invoice, so a list/read can never cross the customer
// boundary. Built through the real invoice handler with a hand-rolled envelope (trade would
// have published this) so the Payment's customerRef is set exactly as production would.
const CUSTOMER_B = 'CUS-CD-000002';

async function invoiceFor(customerRef: string, orderRef: string, agentId = ''): Promise<string> {
  const envelope: EventEnvelope<'order.created'> = {
    eventId: randomUUID(),
    name: 'order.created',
    actorId: 'VM-1',
    occurredAt: new Date().toISOString(),
    payload: { orderRef, customerRef, agentId, totalMinor: STANDARD_TOTAL, tier: 'new' },
  };
  const res = await invoices.handleOrderCreated(envelope);
  if (res.status !== 'invoiced') throw new Error(`expected invoiced, got ${res.status}`);
  return res.invoiceRef;
}

// ---------------------------------------------------------------------------
// GET /invoices/order/:orderRef  →  InvoiceService.readByOrder
// ---------------------------------------------------------------------------
describe('invoice-by-order — the payment UI resolves an order to its invoice', () => {
  it('a customer reads their OWN invoice by order ref', async () => {
    const { invoice } = await invoicedOrder({ tier: 'new' }); // ORD-BULK-2026-0001, CUSTOMER_REF
    const got = await invoices.readByOrder(customer, 'ORD-BULK-2026-0001');
    expect(got.ref).toBe(invoice.ref);
    expect(got.customerRef).toBe(CUSTOMER_REF);
    // Invoice declares no CONFIDENTIAL_FIELDS, so masking is a no-op — real values pass through.
    expect(typeof got.totalMinor).toBe('number');
    expect(got.totalMinor).toBe(STANDARD_TOTAL);
  });

  it('finance reads ANY order’s invoice (passes inScope unconditionally)', async () => {
    await invoiceFor(CUSTOMER_B, 'ORD-B-0001');
    const got = await invoices.readByOrder(finance, 'ORD-B-0001');
    expect(got.customerRef).toBe(CUSTOMER_B);
  });

  it('a customer reading ANOTHER customer’s order is denied by scope (403), not given an empty', async () => {
    await invoiceFor(CUSTOMER_B, 'ORD-B-0001');
    await expect(invoices.readByOrder(customer, 'ORD-B-0001')).rejects.toMatchObject({
      code: 'ACCESS_DENIED_SCOPE',
    });
  });

  it('an unknown order ref is 404', async () => {
    await expect(invoices.readByOrder(finance, 'ORD-NOPE')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('a role without invoice:read (sales_agent) is denied by role grant (403)', async () => {
    await invoicedOrder({ tier: 'new' });
    await expect(invoices.readByOrder(agent, 'ORD-BULK-2026-0001')).rejects.toMatchObject({
      code: 'ACCESS_DENIED_ROLE',
    });
  });
});

// ---------------------------------------------------------------------------
// GET /payments  →  PaymentService.list
// ---------------------------------------------------------------------------
describe('payments list — Finance’s verification queue, scoped + masked', () => {
  it('finance sees payments across ALL customers', async () => {
    const { invoice } = await invoicedOrder({ tier: 'new' }); // CUSTOMER_REF
    const pA = await uploadFor(invoice.ref, 'confirmation', CONF, customer);
    const invB = await invoiceFor(CUSTOMER_B, 'ORD-B-0001');
    const pB = await payments.uploadProof(finance, {
      invoiceRef: invB,
      targetTrigger: 'confirmation',
      amountMinor: CONF,
      proofRef: 'PROOF-B',
    });

    const rows = await payments.list(finance, {}, { limit: 20, offset: 0 });
    expect(rows.map((r) => r.ref)).toEqual(expect.arrayContaining([pA.ref, pB.ref]));
  });

  it('venture_manager also lists (holds payment:read)', async () => {
    const { invoice } = await invoicedOrder({ tier: 'new' });
    const p = await uploadFor(invoice.ref, 'confirmation', CONF, customer);
    const rows = await payments.list(vm, {}, { limit: 20, offset: 0 });
    expect(rows.map((r) => r.ref)).toContain(p.ref);
    void ceo; // ceo holds *:* — same all-rows path, not re-run to keep the suite lean
  });

  it('a role WITHOUT payment:read is denied (403) — a customer has payment:create only', async () => {
    await invoicedOrder({ tier: 'new' });
    await expect(payments.list(customer, {}, { limit: 20, offset: 0 })).rejects.toMatchObject({
      code: 'ACCESS_DENIED_ROLE',
    });
    // A sales_agent likewise holds no payment:read (only commission:read), matching by-ref read.
    await expect(payments.list(agent, {}, { limit: 20, offset: 0 })).rejects.toMatchObject({
      code: 'ACCESS_DENIED_ROLE',
    });
  });

  it('filters by status — the pending_verification queue excludes verified/rejected', async () => {
    const { invoice } = await invoicedOrder({ tier: 'new' });
    const conf = await uploadFor(invoice.ref, 'confirmation', CONF, customer);
    const preload = await uploadFor(invoice.ref, 'pre_loading', CONF, customer);
    await payments.verify(finance, conf.ref); // conf → verified, settles confirmation

    const pending = await payments.list(
      finance,
      { status: 'pending_verification' },
      { limit: 20, offset: 0 },
    );
    expect(pending.map((r) => r.ref)).toEqual([preload.ref]);

    const verified = await payments.list(finance, { status: 'verified' }, { limit: 20, offset: 0 });
    expect(verified.map((r) => r.ref)).toEqual([conf.ref]);
  });

  it('filters by invoiceRef — narrows to one invoice, never widening scope', async () => {
    const { invoice } = await invoicedOrder({ tier: 'new' });
    const pA = await uploadFor(invoice.ref, 'confirmation', CONF, customer);
    const invB = await invoiceFor(CUSTOMER_B, 'ORD-B-0001');
    await payments.uploadProof(finance, {
      invoiceRef: invB,
      targetTrigger: 'confirmation',
      amountMinor: CONF,
      proofRef: 'PROOF-B',
    });

    const rows = await payments.list(
      finance,
      { invoiceRef: invoice.ref },
      { limit: 20, offset: 0 },
    );
    expect(rows.map((r) => r.ref)).toEqual([pA.ref]);
  });

  it('masks each row for uniformity — Payment declares no confidential field, so values pass through', async () => {
    const { invoice } = await invoicedOrder({ tier: 'new' });
    await uploadFor(invoice.ref, 'confirmation', CONF, customer);
    const [row] = await payments.list(finance, {}, { limit: 20, offset: 0 });
    expect(row).toBeDefined();
    expect(typeof row!.amountMinor).toBe('number');
    expect(row!.amountMinor).toBe(CONF);
    expect(row!.customerRef).toBe(CUSTOMER_REF);
  });
});

describe('payments list — pagination + stable sort (updatedAt desc)', () => {
  it('honours limit/offset and returns most-recently-updated first', async () => {
    const { invoice } = await invoicedOrder({ tier: 'established' }); // 3 installments → room for 3 proofs
    const a = await uploadFor(invoice.ref, 'confirmation', CONF, customer);
    const b = await uploadFor(invoice.ref, 'pre_loading', CONF, customer);
    const c = await uploadFor(invoice.ref, 'pre_release', CONF, customer);
    const refs = [a.ref, b.ref, c.ref];

    // Pin distinct, increasing updatedAt so the sort is deterministic (c newest).
    for (let i = 0; i < refs.length; i++) {
      await prisma.$executeRawUnsafe(
        'UPDATE "Payment" SET "updatedAt" = $1::timestamptz WHERE ref = $2',
        new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
        refs[i],
      );
    }

    const page1 = await payments.list(finance, {}, { limit: 2, offset: 0 });
    const page2 = await payments.list(finance, {}, { limit: 2, offset: 2 });

    expect(page1.map((r) => r.ref)).toEqual([c.ref, b.ref]); // newest first
    expect(page2.map((r) => r.ref)).toEqual([a.ref]); // no overlap, stable continuation
  });
});

// The predicate is a MIRROR of inScope, not a re-implementation. Because only
// finance/ceo/venture_manager hold payment:read (all pass inScope unconditionally), the
// reachable path is trivially all-rows; we ALSO exercise the customer/sales_agent branches
// of financeScopeWhere directly against inScope to prove the mirror is total.
describe('payments list agrees with inScope', () => {
  it('every payment finance lists passes inScope for finance (soundness on the reachable path)', async () => {
    const { invoice } = await invoicedOrder({ tier: 'new' });
    await uploadFor(invoice.ref, 'confirmation', CONF, customer);
    await invoiceFor(CUSTOMER_B, 'ORD-B-0001').then((invB) =>
      payments.uploadProof(finance, {
        invoiceRef: invB,
        targetTrigger: 'confirmation',
        amountMinor: CONF,
        proofRef: 'PROOF-B',
      }),
    );

    const rows = await payments.list(finance, {}, { limit: 100, offset: 0 });
    for (const row of rows) {
      expect(inScope(finance, { customerId: row.customerRef as string })).toBe(true);
    }
  });

  it('the customer/agent scope predicate admits exactly the rows inScope would (soundness + completeness)', async () => {
    // Payments for two distinct customers.
    const { invoice: invA } = await invoicedOrder({ tier: 'new' }); // CUSTOMER_REF
    const pA = await uploadFor(invA.ref, 'confirmation', CONF, customer);
    const invB = await invoiceFor(CUSTOMER_B, 'ORD-B-0001');
    const pB = await payments.uploadProof(finance, {
      invoiceRef: invB,
      targetTrigger: 'confirmation',
      amountMinor: CONF,
      proofRef: 'PROOF-B',
    });

    // Apply the SAME predicate PaymentService.list uses, for customer A (grant aside).
    const scoped = await prisma.payment.findMany({ where: financeScopeWhere(customer) });
    const scopedRefs = scoped.map((r) => r.ref);

    // Soundness: nothing the predicate admits would fail the by-ref inScope check.
    for (const row of scoped) {
      expect(inScope(customer, { customerId: row.customerRef })).toBe(true);
    }
    // Completeness: A's payment is present, B's is absent — and inScope agrees on the excluded row.
    expect(scopedRefs).toContain(pA.ref);
    expect(scopedRefs).not.toContain(pB.ref);
    expect(inScope(customer, { customerId: CUSTOMER_B })).toBe(false);

    // A sales_agent scoped to CUSTOMER_REF admits the same set (Payment carries no agentId,
    // so only the customer-membership disjunct of inScope can fire).
    const agentScoped = await prisma.payment.findMany({ where: financeScopeWhere(agent) });
    expect(agentScoped.map((r) => r.ref)).toContain(pA.ref);
    expect(agentScoped.map((r) => r.ref)).not.toContain(pB.ref);
    expect(inScope(agent, { customerId: CUSTOMER_REF })).toBe(true);
    void AGENT_ID;
  });
});
