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

/**
 * Where a role's home lives. Role-aware navigation (charter): each persona lands only in
 * its own area. A `logistics_partner` holds none of the commercial grants the work queue
 * needs (`quotation:read`/`order:read`/`project:read`), so it would only see denials there
 * — send it to its shipments portal instead. Everyone else uses the shared queue, scoped
 * server-side to what they own (a `customer` sees only their own projects/orders there).
 *
 * This is a UI convenience, NOT a security boundary — the API still scopes every read.
 */
export function homePathFor(actor: Actor): string {
  if (actor.role === 'logistics_partner') return '/partner/shipments';
  // Executives land on the group view; everyone else lands on their own week. Neither is a
  // security boundary — the API scopes every read regardless.
  if (actor.role === 'ceo' || actor.role === 'venture_manager') return '/nexus';
  return '/week';
}

/** Only the logistics partner belongs in the partner portal — used to redirect others out
 *  (the API also scopes it to an empty set for a non-partner, so this is UX, not the guard). */
export function isPartner(actor: Actor): boolean {
  return actor.role === 'logistics_partner';
}

/**
 * The dashboard's "Generate demo deal" + "track by reference" toolbar is internal VM
 * scaffolding (it logs in as a seed agent, then runs the VM clarify→project→quotation half
 * with the caller's own grants). Never offer it to an external persona (customer/partner):
 * they hold none of those grants and it is not part of their story.
 */
export function showSeedTools(actor: Actor): boolean {
  return actor.role === 'venture_manager' || actor.role === 'ceo';
}
