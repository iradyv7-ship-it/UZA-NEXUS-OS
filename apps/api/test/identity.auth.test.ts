import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { prisma, resetDb } from './db';
import { IdentityService } from '../src/platform/identity/identity.service';
import { AuditService } from '../src/platform/audit/audit.service';
import { AuthService } from '../src/platform/auth/auth.service';
import { formatId, idRegex } from '../src/platform/ids/readable-id';

const identity = new IdentityService(prisma as never);
const audit = new AuditService(prisma as never);
const jwt = new JwtService({ secret: 'test-secret', signOptions: { expiresIn: '3600s' } });
const auth = new AuthService(prisma as never, jwt, audit);

async function office() {
  const org = await identity.createOrganisation('UZA Solutions Ltd');
  return identity.createOffice(org.id, 'RW', 'Kigali HQ');
}

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe('identity + auth', () => {
  it('creates an employee and logs them in (JWT + Actor)', async () => {
    const off = await office();
    await identity.createEmployee({
      ref: 'AGT-RW-0001', email: 'kagabo@uza.rw', password: 'sup3rsecret',
      role: 'finance', officeId: off.id,
    });

    const result = await auth.login('kagabo@uza.rw', 'sup3rsecret');
    expect(result.accessToken).not.toBe('');
    expect(result.mfaRequired).toBe(false);
    expect(result.actor.role).toBe('finance');
    expect(result.actor.userId).toBe('AGT-RW-0001');
    expect(result.actor.office).toBe('RW'); // resolved to office code

    const login = await prisma.auditLog.findFirst({ where: { action: 'login', decision: 'allow' } });
    expect(login).not.toBeNull();
  });

  it('rejects a wrong password', async () => {
    const off = await office();
    await identity.createEmployee({
      ref: 'AGT-RW-0002', email: 'x@uza.rw', password: 'correcthorse', role: 'front_office', officeId: off.id,
    });
    await expect(auth.login('x@uza.rw', 'wrong')).rejects.toThrow();
  });

  it('partner accounts require a future expiry, and an expired account cannot log in', async () => {
    const off = await office();

    // A past expiry is refused at creation.
    await expect(
      identity.createPartnerAccount(
        { ref: 'PRT-1', email: 'p1@forwarder.cn', password: 'password1', role: 'logistics_partner', officeId: off.id },
        new Date(Date.now() - 1000),
      ),
    ).rejects.toThrow();

    // A valid partner is created with a future expiry and can log in.
    await identity.createPartnerAccount(
      { ref: 'PRT-2', email: 'p2@forwarder.cn', password: 'password1', role: 'logistics_partner',
        officeId: off.id, scopeShipmentRefs: ['SHP-2026-0001'] },
      new Date(Date.now() + 86_400_000),
    );
    const ok = await auth.login('p2@forwarder.cn', 'password1');
    expect(ok.actor.role).toBe('logistics_partner');
    expect(ok.actor.scope.shipmentRefs).toEqual(['SHP-2026-0001']);

    // Force expiry into the past and prove login is now refused + audited as a denial.
    await prisma.user.update({ where: { email: 'p2@forwarder.cn' }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(auth.login('p2@forwarder.cn', 'password1')).rejects.toThrow('Account expired');
    const denial = await prisma.auditLog.findFirst({
      where: { action: 'login', decision: 'deny', reason: 'ACCOUNT_EXPIRED' },
    });
    expect(denial).not.toBeNull();
  });

  it('role assignment keeps append-only history and updates the active role', async () => {
    const off = await office();
    const user = await identity.createEmployee({
      ref: 'EMP-1', email: 'promote@uza.rw', password: 'password1', role: 'front_office', officeId: off.id,
    });

    await identity.assignRole(user.id, 'venture_manager', 'ceo-user', 'promotion');
    await identity.assignRole(user.id, 'finance', 'ceo-user', 'reorg');

    const active = await prisma.user.findUnique({ where: { id: user.id } });
    expect(active!.role).toBe('finance');

    const history = await prisma.roleAssignment.findMany({ where: { userId: user.id }, orderBy: { assignedAt: 'asc' } });
    expect(history).toHaveLength(2);
    expect(history[0]!.revokedAt).not.toBeNull(); // first assignment closed
    expect(history[1]!.revokedAt).toBeNull(); // current one open
  });
});

describe('CF-001: readable IDs follow the documented patterns', () => {
  it('renders and validates ids against ID_PATTERNS', () => {
    const cus = formatId('customer', { country: 'CD', seq: 1 });
    expect(cus).toBe('CUS-CD-000001');
    expect(idRegex('customer').test(cus)).toBe(true);

    const agt = formatId('agent', { office: 'GOM', seq: 21 });
    expect(agt).toBe('AGT-GOM-0021');
    expect(idRegex('agent').test(agt)).toBe(true);

    const ord = formatId('order', { venture: 'BULK', year: 2026, seq: 7 });
    expect(ord).toBe('ORD-BULK-2026-0007');
    expect(idRegex('order').test(ord)).toBe(true);

    expect(idRegex('customer').test('CUS-CD-1')).toBe(false); // wrong seq width
  });
});
