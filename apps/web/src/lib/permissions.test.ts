import { describe, expect, it } from 'vitest';
import type { Actor, Role } from './session';
import { can, homePathFor } from './permissions';

const as = (role: Role): Actor =>
  ({ userId: `${role}-1`, role, office: 'KGL', scope: {} }) as Actor;

const ROLES: Role[] = [
  'ceo', 'venture_manager', 'china_sourcing', 'china_warehouse',
  'front_office', 'finance', 'sales_agent', 'customer', 'logistics_partner',
];

/**
 * This module is a UI-side MIRROR of the API's grants. It decides which buttons to offer,
 * never whether an action is allowed — the service layer is the security boundary, and a
 * role that slips through gets a 403.
 *
 * So these tests check that the mirror is honest, not that it is a guard. The failure mode
 * they protect against is a role being shown an action it can never complete, which reads
 * to the user as a broken app.
 */

describe('who is offered payment actions', () => {
  it('gives finance and the CEO the full set', () => {
    for (const role of ['ceo', 'finance'] as const) {
      expect(can(as(role), 'payment', 'create')).toBe(true);
      expect(can(as(role), 'payment', 'read')).toBe(true);
      expect(can(as(role), 'payment', 'approve')).toBe(true);
    }
  });

  it('lets a venture manager read but never approve', () => {
    expect(can(as('venture_manager'), 'payment', 'read')).toBe(true);
    expect(can(as('venture_manager'), 'payment', 'approve')).toBe(false);
  });

  it('lets a customer create a payment but not approve or read the queue', () => {
    // A customer pays; they do not review the finance queue.
    expect(can(as('customer'), 'payment', 'create')).toBe(true);
    expect(can(as('customer'), 'payment', 'read')).toBe(false);
    expect(can(as('customer'), 'payment', 'approve')).toBe(false);
  });

  it('offers approve to exactly two roles, and no others', () => {
    // Approval moves money. If this count ever changes, it should be because somebody
    // decided it should — not as a side effect of editing the grant map.
    const approvers = ROLES.filter((r) => can(as(r), 'payment', 'approve'));
    expect(approvers.sort()).toEqual(['ceo', 'finance']);
  });

  it('denies rather than throws for a role with no payment grants at all', () => {
    for (const role of ['china_sourcing', 'china_warehouse', 'sales_agent', 'logistics_partner'] as const) {
      expect(can(as(role), 'payment', 'read')).toBe(false);
    }
  });

  it('defaults to denied for an unrecognised role', () => {
    // A role added to the API but not here must hide the button, not show it. Failing open
    // would offer an action that always 403s.
    expect(can(as('brand_new_role' as Role), 'payment', 'read')).toBe(false);
  });
});

describe('where each role lands', () => {
  it('sends a logistics partner to its own portal, never the shared queue', () => {
    // A logistics partner holds none of the commercial grants the queue needs, so the
    // shared queue would show it nothing but denials.
    expect(homePathFor(as('logistics_partner'))).toBe('/partner/shipments');
  });

  it('sends executives to the group view', () => {
    expect(homePathFor(as('ceo'))).toBe('/nexus');
    expect(homePathFor(as('venture_manager'))).toBe('/nexus');
  });

  it('sends everyone else to their own week', () => {
    for (const role of ['finance', 'front_office', 'sales_agent', 'customer'] as const) {
      expect(homePathFor(as(role))).toBe('/week');
    }
  });

  it('always returns a path — no role lands nowhere', () => {
    // A missing home is a blank screen after login, which is indistinguishable from a
    // broken deployment.
    for (const role of ROLES) {
      expect(homePathFor(as(role))).toMatch(/^\//);
    }
  });
});
