import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { UzaError, type Actor } from '@uza/contracts';
import { prisma, resetDb } from './db';
import { resetTradeDb } from './trade-db';
import {
  projects, quotations, orders, intake,
  vm, agent, SUPPLIER_UNIT, standardEst, approvedChain,
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
      .build(agent, project.ref, { supplierUnitCostMinor: SUPPLIER_UNIT, estCostsMinor: standardEst(), qty: 1, requiredMargin: 0.18 })
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
    await expect(projects.create(agent, { requestRef: request.ref, name: 'x', owner: 'o' })).rejects.toMatchObject({
      code: 'ACCESS_DENIED_ROLE',
    });
  });

  it('a sales agent cannot create an order', async () => {
    const { quotation } = await approvedChain();
    await expect(orders.create(agent, quotation.ref)).rejects.toMatchObject({ code: 'ACCESS_DENIED_ROLE' });
  });

  it('a customer cannot read another customer’s order (ACCESS_DENIED_SCOPE, audited)', async () => {
    const { quotation, customer } = await approvedChain();
    const order = await orders.create(vm, quotation.ref);

    const otherCustomer: Actor = {
      userId: 'cust-other', role: 'customer', office: 'CD', scope: { customerId: 'CUS-CD-999999' },
    };
    const err = await orders.read(otherCustomer, order.ref).then(() => null).catch((e) => e);
    expect(err).toBeInstanceOf(UzaError);
    expect((err as UzaError).code).toBe('ACCESS_DENIED_SCOPE');

    // The owning customer CAN read it.
    const owner: Actor = { userId: 'cust', role: 'customer', office: 'CD', scope: { customerId: customer.ref } };
    await expect(orders.read(owner, order.ref)).resolves.toBeTruthy();

    const denies = await prisma.auditLog.findMany({ where: { decision: 'deny', resource: 'order', action: 'read' } });
    expect(denies).toHaveLength(1);
    expect(denies[0]!.reason).toBe('ACCESS_DENIED_SCOPE');
  });

  it('the agent who owns the customer can read the quotation (scope allows agentId match)', async () => {
    const { quotation } = await approvedChain();
    await expect(quotations.read(agent, quotation.ref)).resolves.toBeTruthy();
  });

  it('a customer cannot create a lead', async () => {
    const cust: Actor = { userId: 'c', role: 'customer', office: 'CD', scope: { customerId: 'CUS-CD-000001' } };
    await expect(
      intake.createLead(cust, { customerRef: 'CUS-CD-000001', rawText: 'hi' }),
    ).rejects.toMatchObject({ code: 'ACCESS_DENIED_ROLE' });
  });
});
