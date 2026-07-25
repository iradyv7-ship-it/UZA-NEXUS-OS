import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { UzaError, MASK, type Actor } from '@uza/contracts';
import { prisma, resetDb } from './db';
import { AuditService } from '../src/platform/audit/audit.service';
import { AuthorizationService } from '../src/platform/authorization/authorization.service';

const audit = new AuditService(prisma as never);
const authz = new AuthorizationService(audit);

const salesAgent: Actor = {
  userId: 'AGT-GOM-0021',
  role: 'sales_agent',
  office: 'GOM',
  scope: { customerIds: ['CUS-CD-000001'] },
};
const customerA: Actor = {
  userId: 'c1',
  role: 'customer',
  office: 'CD',
  scope: { customerId: 'CUS-CD-000001' },
};

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe('denials are audited BEFORE the throw', () => {
  it('CF-024: a sales agent cannot read supplier records — deny row exists after the throw', async () => {
    let threw = false;
    try {
      await authz.authorize(salesAgent, 'supplier', 'read');
    } catch (e) {
      threw = true;
      expect(e).toBeInstanceOf(UzaError);
      expect((e as UzaError).code).toBe('ACCESS_DENIED_ROLE');
    }
    expect(threw).toBe(true);

    // The row is present the instant control returns from the throw. Nothing runs after
    // `throw`, so its existence proves it was written BEFORE the throw.
    const rows = await prisma.auditLog.findMany({
      where: { actorId: 'AGT-GOM-0021', resource: 'supplier', action: 'read' },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.decision).toBe('deny');
    expect(rows[0]!.reason).toBe('ACCESS_DENIED_ROLE');
  });

  it('CF-027: a customer cannot reach another customer’s project — scope denial is audited', async () => {
    // Same role, in-scope object: allowed.
    await expect(
      authz.authorize(customerA, 'project', 'read', { customerId: 'CUS-CD-000001' }),
    ).resolves.toBeUndefined();

    // Different customer's project: role passes, scope fails.
    const err = await authz
      .authorize(customerA, 'project', 'read', { customerId: 'CUS-RW-000999' })
      .then(() => null)
      .catch((e) => e);
    expect(err).toBeInstanceOf(UzaError);
    expect((err as UzaError).code).toBe('ACCESS_DENIED_SCOPE');

    const denies = await prisma.auditLog.findMany({ where: { decision: 'deny' } });
    expect(denies).toHaveLength(1);
    expect(denies[0]!.reason).toBe('ACCESS_DENIED_SCOPE');

    const allows = await prisma.auditLog.count({ where: { decision: 'allow' } });
    expect(allows).toBe(1);
  });

  it('CF-025 / CF-026: masking is applied on read via the authorization service', () => {
    const agentView = authz.mask(salesAgent, {
      customerUnitPriceMinor: 6163,
      supplierUnitCost: 4100,
      marginPct: 0.18,
    });
    expect(agentView.supplierUnitCost).toBe(MASK);
    expect(agentView.marginPct).toBe(MASK);
    expect(agentView.customerUnitPriceMinor).toBe(6163);

    const partner: Actor = {
      userId: 'imari', role: 'logistics_partner', office: 'GOM', scope: { shipmentRefs: ['SHP-2026-0001'] },
    };
    const partnerView = authz.mask(partner, { cbm: 1.55, kg: 287.5, supplierUnitCost: 4100 });
    expect(partnerView.supplierUnitCost).toBe(MASK);
    expect(partnerView.cbm).toBe(1.55);
  });
});
