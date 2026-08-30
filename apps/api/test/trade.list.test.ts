import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { MASK, inScope, type Actor } from '@uza/contracts';
import { prisma, resetDb } from './db';
import { resetTradeDb } from './trade-db';
import {
  customers,
  intake,
  projects,
  quotations,
  orders,
  vm,
  agent,
  finance,
  SUPPLIER_UNIT,
  standardEst,
  approvedChain,
} from './trade-fixtures';

beforeEach(async () => {
  await resetDb();
  await resetTradeDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

// A second sales agent + their own customer, so we can prove a list never crosses the
// agent/customer boundary. Built through the real services, exactly like approvedChain.
const AGENT_B = 'AGT-KGL-0099';
const agentB: Actor = {
  userId: AGENT_B,
  role: 'sales_agent',
  office: 'KGL',
  scope: { customerIds: [] },
};

async function chainFor(a: Actor) {
  const customer = await customers.create(a, {
    name: `cust-${a.userId}`,
    country: 'RW',
    phone: '+250700000000',
    agentId: a.userId,
  });
  const lead = await intake.createLead(a, { customerRef: customer.ref, rawText: 'need widgets' });
  const request = await intake.clarifyLead(a, {
    leadRef: lead.ref,
    spec: { item: 'widget', qty: 10 },
  });
  const project = await projects.create(vm, {
    requestRef: request.ref,
    name: `prj-${a.userId}`,
    owner: 'o',
  });
  const quotation = await quotations.build(vm, project.ref, {
    supplierUnitCostMinor: SUPPLIER_UNIT,
    estCostsMinor: standardEst(),
    qty: 10,
    requiredMargin: 0.18,
    sellIncoterm: 'CIF',
  });
  await quotations.approve(vm, quotation.ref);
  const order = await orders.create(vm, quotation.ref);
  return { customer, project, quotation, order };
}

// A sales_agent whose customerIds cover a given customer, but whose userId matches no
// order/quotation's agentId — isolates inScope's customerId branch from its agentId branch.
// Stands in for the 'customer' role removed 30 Aug 2026 (no longer a Nexus login role — see
// @uza/contracts/permissions.ts); 'customer' also reached `project:read`, which no remaining
// role does (see 'a sales agent cannot list projects at all', below), so the covering-agent
// version of this test is scoped to quotations/orders only.
const coveringAgent = (customerRef: string): Actor => ({
  userId: `agt-covering-${customerRef}`,
  role: 'sales_agent',
  office: 'RW',
  scope: { customerIds: [customerRef] },
});

describe('list scoping — mirrors inScope per role', () => {
  it('a venture manager sees ALL quotations and orders across customers', async () => {
    const a = await approvedChain(); // customer A, owned by AGENT_ID
    const orderA = await orders.create(vm, a.quotation.ref);
    const b = await chainFor(agentB); // customer B, owned by AGENT_B

    const qs = await quotations.list(vm, {}, { limit: 20, offset: 0 });
    const os = await orders.list(vm, {}, { limit: 20, offset: 0 });

    expect(qs.map((q) => q.ref)).toEqual(
      expect.arrayContaining([a.quotation.ref, b.quotation.ref]),
    );
    expect(os.map((o) => o.ref)).toEqual(expect.arrayContaining([orderA.ref, b.order.ref]));
  });

  it('a sales agent sees only their own rows (agentId match), never another agent’s', async () => {
    const a = await approvedChain(); // agentId = AGENT_ID
    await orders.create(vm, a.quotation.ref);
    const b = await chainFor(agentB); // agentId = AGENT_B

    const qs = await quotations.list(agent, {}, { limit: 20, offset: 0 });
    const os = await orders.list(agent, {}, { limit: 20, offset: 0 });

    expect(qs.map((q) => q.ref)).toContain(a.quotation.ref);
    expect(qs.map((q) => q.ref)).not.toContain(b.quotation.ref);
    expect(os.map((o) => o.customerRef)).not.toContain(b.customer.ref);
  });

  it('an agent covering a customer (but not owning it) sees only that customer’s rows', async () => {
    const a = await approvedChain();
    await orders.create(vm, a.quotation.ref);
    const b = await chainFor(agentB);

    const covering = coveringAgent(a.customer.ref);
    const qs = await quotations.list(covering, {}, { limit: 20, offset: 0 });
    const os = await orders.list(covering, {}, { limit: 20, offset: 0 });

    expect(qs.every((q) => q.customerRef === a.customer.ref)).toBe(true);
    expect(os.every((o) => o.customerRef === a.customer.ref)).toBe(true);
    expect(qs.map((q) => q.ref)).not.toContain(b.quotation.ref);
  });

  it('a sales agent cannot list projects at all (no project:read grant → 403)', async () => {
    await approvedChain();
    await expect(projects.list(agent, {}, { limit: 20, offset: 0 })).rejects.toMatchObject({
      code: 'ACCESS_DENIED_ROLE',
    });
  });

  it('finance cannot list quotations (no quotation:read grant → 403), matching the by-ref read', async () => {
    await approvedChain();
    await expect(quotations.list(finance, {}, { limit: 20, offset: 0 })).rejects.toMatchObject({
      code: 'ACCESS_DENIED_ROLE',
    });
  });

  it('a filter can only NARROW scope, never widen it (an agent passing another customerRef gets nothing)', async () => {
    const a = await approvedChain();
    await orders.create(vm, a.quotation.ref);
    const b = await chainFor(agentB);

    const covering = coveringAgent(a.customer.ref);
    // The covering agent explicitly asks for customer B's ref — scope AND filter ⇒ empty,
    // no leak.
    const os = await orders.list(
      covering,
      { customerRef: b.customer.ref },
      { limit: 20, offset: 0 },
    );
    expect(os).toHaveLength(0);
  });
});

describe('list masking — a list row is never a weaker posture than the by-ref read', () => {
  it('a sales agent’s quotation list masks cost/target/walkaway and BOTH margins', async () => {
    const a = await approvedChain();
    const qs = await quotations.list(agent, {}, { limit: 20, offset: 0 });
    const row = qs.find((q) => q.ref === a.quotation.ref)!;

    expect(row.marginPct).toBe(MASK);
    expect(row.realizedMargin).toBe(MASK);
    expect(row.dapMargin).toBe(MASK);
    expect(row.supplierUnitCost).toBe(MASK);
    expect(row.targetPrice).toBe(MASK);
    expect(row.walkawayPrice).toBe(MASK);
    expect(typeof row.customerUnitPriceMinor).toBe('number');
  });

  it('a venture manager’s quotation list shows the real cost and both margins', async () => {
    const a = await approvedChain();
    const qs = await quotations.list(vm, {}, { limit: 20, offset: 0 });
    const row = qs.find((q) => q.ref === a.quotation.ref)!;

    expect(row.supplierUnitCost).toBe(SUPPLIER_UNIT);
    expect(typeof row.marginPct).toBe('number');
    expect(typeof row.dapMargin).toBe('number');
  });
});

describe('list pagination + stable sort (updatedAt desc)', () => {
  it('honours limit/offset and returns most-recently-updated first', async () => {
    const { project } = await approvedChain();
    // Three more draft quotations on the same project → four rows total for this project.
    const built = [];
    for (let i = 0; i < 3; i++) {
      built.push(
        await quotations.build(vm, project.ref, {
          supplierUnitCostMinor: SUPPLIER_UNIT,
          estCostsMinor: standardEst(),
          qty: 10 + i,
          requiredMargin: 0.18,
        }),
      );
    }
    const refs = built.map((q) => q.ref);

    // Pin distinct, increasing updatedAt so the sort is deterministic (built[2] newest).
    for (let i = 0; i < refs.length; i++) {
      await prisma.$executeRawUnsafe(
        'UPDATE "Quotation" SET "updatedAt" = $1::timestamptz WHERE ref = $2',
        new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
        refs[i],
      );
    }

    const scoped = { projectRef: project.ref, status: 'draft' as const };
    const page1 = await quotations.list(vm, scoped, { limit: 2, offset: 0 });
    const page2 = await quotations.list(vm, scoped, { limit: 2, offset: 2 });

    expect(page1).toHaveLength(2);
    // Newest first: built[2] then built[1].
    expect(page1[0]!.ref).toBe(refs[2]);
    expect(page1[1]!.ref).toBe(refs[1]);
    // Offset continues the same stable order (built[0] next); page 1 and 2 do not overlap.
    expect(page2.map((q) => q.ref)).not.toContain(page1[0]!.ref);
    expect(page2.map((q) => q.ref)).toContain(refs[0]);
  });
});

describe('list agrees with inScope (the predicate is a mirror, not a re-implementation)', () => {
  it('every listed quotation passes inScope for the caller, and an out-of-scope ref is absent', async () => {
    const a = await approvedChain(); // agentId = AGENT_ID (in scope for `agent`)
    const b = await chainFor(agentB); // agentId = AGENT_B (out of scope for `agent`)

    const qs = await quotations.list(agent, {}, { limit: 100, offset: 0 });

    // 1. Soundness: nothing the by-ref read would deny appears in the list.
    for (const row of qs) {
      expect(
        inScope(agent, {
          customerId: row.customerRef as string,
          agentId: (row.agentId as string) ?? undefined,
        }),
      ).toBe(true);
    }
    // 2. Completeness (for this fixture): the known in-scope row is present, the out-of-scope one absent.
    expect(qs.map((q) => q.ref)).toContain(a.quotation.ref);
    expect(qs.map((q) => q.ref)).not.toContain(b.quotation.ref);

    // 3. Cross-check against the canonical single-record rule directly.
    const bRow = await prisma.quotation.findUniqueOrThrow({ where: { ref: b.quotation.ref } });
    expect(
      inScope(agent, { customerId: bRow.customerRef, agentId: bRow.agentId ?? undefined }),
    ).toBe(false);
  });
});
