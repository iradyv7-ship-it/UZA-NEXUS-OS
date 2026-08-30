import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { ROLE_GRANTS, can, UzaError, type Actor, type Role } from '@uza/contracts';
import { prisma, resetDb } from './db';
import { AuditService } from '../src/platform/audit/audit.service';
import { AuthorizationService } from '../src/platform/authorization/authorization.service';

const audit = new AuditService(prisma as never);
const authz = new AuthorizationService(audit);

const ROLES = Object.keys(ROLE_GRANTS) as Role[];

// Derive the resource/action universe straight from ROLE_GRANTS, so the matrix is the
// contract's own grant table — not a hand-maintained list that could drift from it.
const resources = new Set<string>();
const actions = new Set<string>();
for (const grant of Object.values(ROLE_GRANTS).flat()) {
  const [r, a] = grant.split(':');
  if (r && r !== '*') resources.add(r);
  if (a && a !== '*') actions.add(a);
}
const RESOURCES = [...resources].sort();
const ACTIONS = [...actions].sort();

const actorFor = (role: Role): Actor => ({
  userId: `u-${role}`,
  role,
  office: 'RW',
  scope: {},
});

beforeAll(async () => {
  await resetDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe('authorisation matrix: every role against every resource', () => {
  it(`covers ${ROLES.length} roles x ${RESOURCES.length} resources x ${ACTIONS.length} actions`, async () => {
    let checked = 0;
    let allowed = 0;
    let denied = 0;

    for (const role of ROLES) {
      const actor = actorFor(role);
      for (const resource of RESOURCES) {
        for (const action of ACTIONS) {
          const expected = can(actor, resource, action);
          checked += 1;

          if (expected) {
            // Must resolve, and must write an `allow` audit row.
            await expect(authz.authorize(actor, resource, action)).resolves.toBeUndefined();
            allowed += 1;
          } else {
            // Must throw ACCESS_DENIED_ROLE (never return false silently).
            const err = await authz
              .authorize(actor, resource, action)
              .then(() => null)
              .catch((e) => e);
            expect(err, `${role} ${resource}:${action} should be denied`).toBeInstanceOf(UzaError);
            expect((err as UzaError).code).toBe('ACCESS_DENIED_ROLE');
            denied += 1;
          }
        }
      }
    }

    // Every role x every resource x every action was exercised through the real service.
    expect(checked).toBe(ROLES.length * RESOURCES.length * ACTIONS.length);
    expect(allowed + denied).toBe(checked);

    // The audit log holds exactly one row per authorize() call: allow + deny decisions.
    const rows = await prisma.auditLog.count();
    expect(rows).toBe(checked);
    const denyRows = await prisma.auditLog.count({ where: { decision: 'deny' } });
    expect(denyRows).toBe(denied);
    const allowRows = await prisma.auditLog.count({ where: { decision: 'allow' } });
    expect(allowRows).toBe(allowed);

    console.log(
      `matrix: ${checked} checks — ${allowed} allowed, ${denied} denied; audit rows written: ${rows}`,
    );
  });

  it('CEO wildcard grants everything; customer reaches almost nothing', () => {
    const ceo = actorFor('ceo');
    for (const resource of RESOURCES) {
      for (const action of ACTIONS) {
        expect(can(ceo, resource, action)).toBe(true);
      }
    }
    const customer = actorFor('customer');
    expect(can(customer, 'supplier', 'read')).toBe(false);
    expect(can(customer, 'project', 'read')).toBe(true);
  });
});
