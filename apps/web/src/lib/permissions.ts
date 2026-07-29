import type { Actor, Role } from './session';

/**
 * A UI-side mirror of the API's ROLE_GRANTS, used ONLY to decide which actions/nav to
 * OFFER — never to authorise. The API (services) remains the security boundary; if a role
 * reaches an action it shouldn't, the server returns 403 and the screen renders the
 * permission-denied state. This keeps the UI honest without pretending to be the guard.
 *
 * We deliberately model only the grants this slice needs (payments). Keeping the map narrow
 * avoids drift: it is not a full copy of the server's grant table, just enough to hide
 * buttons a role can obviously never use.
 */
const PAYMENT_GRANTS: Record<Role, readonly string[]> = {
  ceo: ['payment:create', 'payment:read', 'payment:approve'],
  finance: ['payment:create', 'payment:read', 'payment:approve'],
  venture_manager: ['payment:read'],
  customer: ['payment:create'],
  china_sourcing: [],
  china_warehouse: [],
  front_office: [],
  sales_agent: [],
  logistics_partner: [],
};

export function can(actor: Actor, resource: 'payment', action: 'create' | 'read' | 'approve'): boolean {
  return PAYMENT_GRANTS[actor.role]?.includes(`${resource}:${action}`) ?? false;
}
