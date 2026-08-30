import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { UzaError, type Actor } from '@uza/contracts';
import { prisma, resetDb } from './db';
import { resetTradeDb } from './trade-db';
import {
  projects,
  quotations,
  orders,
  intake,
  vm,
  agent,
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

describe('authorisation is enforced at the service layer', () => {
  it('a sales agent cannot build a quotation (ACCESS_DENIED_ROLE, audited)', async () => {
    const { project } = await approvedChain();
    const err = await quotations
      .build(agent, project.ref, {
        supplierUnitCostMinor: SUPPLIER_UNIT,
        estCostsMinor: standardEst(),
        qty: 1,
        requiredMargin: 0.18,
      })
      .then(() => null)
      .catch((e) => e);

    expect(err).toBeInstanceOf(UzaError);
    expect((err as UzaError).code).toBe('ACCESS_DENIED_ROLE');

    const denies = await prisma.auditLog.findMany({
      where: { actorId: agent.userId, resource: 'quotation', action: 'create', decision: 'deny' },
    });
    expect(denies).toHaveLength(1);
  });

  it('a sales agent cannot create a project', async () => {
    const { request } = await approvedChain();
    await expect(
      projects.create(agent, { requestRef: request.ref, name: 'x', owner: 'o' }),
    ).rejects.toMatchObject({
      code: 'ACCESS_DENIED_ROLE',
    });
  });

  it('a sales agent cannot create an order', async () => {
    const { quotation } = await approvedChain();
    await expect(orders.create(agent, quotation.ref)).rejects.toMatchObject({
      code: 'ACCESS_DENIED_ROLE',
    });
  });

  it('an agent outside the customer’s scope cannot read the order (ACCESS_DENIED_SCOPE, audited)', async () => {
    // Rewritten 30 Aug 2026 onto sales_agent (order:read, scope.customerIds) — the original
    // used a 'customer' actor directly; 'customer' is no longer a Nexus login role (see
    // @uza/contracts/permissions.ts). Both new actors use a userId that doesn't match the
    // order's own agentId, so only the customerId branch of inScope is exercised — the
    // direct replacement for what the removed role's scope check did.
    const { quotation, customer } = await approvedChain();
    const order = await orders.create(vm, quotation.ref);

    const unrelatedAgent: Actor = {
      userId: 'AGT-OTHER',
      role: 'sales_agent',
      office: 'CD',
      scope: { customerIds: ['CUS-CD-999999'] },
    };
    const err = await orders
      .read(unrelatedAgent, order.ref)
      .then(() => null)
      .catch((e) => e);
    expect(err).toBeInstanceOf(UzaError);
    expect((err as UzaError).code).toBe('ACCESS_DENIED_SCOPE');

    // An agent whose customerIds includes this customer CAN read it, even with no agentId
    // match — proving the customerId branch, not just the agentId branch, actually admits.
    const coveringAgent: Actor = {
      userId: 'AGT-COVERING',
      role: 'sales_agent',
      office: 'CD',
      scope: { customerIds: [customer.ref] },
    };
    await expect(orders.read(coveringAgent, order.ref)).resolves.toBeTruthy();

    const denies = await prisma.auditLog.findMany({
      where: { decision: 'deny', resource: 'order', action: 'read' },
    });
    expect(denies).toHaveLength(1);
    expect(denies[0]!.reason).toBe('ACCESS_DENIED_SCOPE');
  });

  it('the agent who owns the customer can read the quotation (scope allows agentId match)', async () => {
    const { quotation } = await approvedChain();
    await expect(quotations.read(agent, quotation.ref)).resolves.toBeTruthy();
  });

  it('an external role cannot create a lead', async () => {
    // 'customer' was the original actor here; no longer a Nexus login role.
    // logistics_partner holds no lead grant at all, same conformance point.
    const partner: Actor = {
      userId: 'PTR-1',
      role: 'logistics_partner',
      office: 'CD',
      scope: { shipmentRefs: [] },
    };
    await expect(
      intake.createLead(partner, { customerRef: 'CUS-CD-000001', rawText: 'hi' }),
    ).rejects.toMatchObject({ code: 'ACCESS_DENIED_ROLE' });
  });
});
