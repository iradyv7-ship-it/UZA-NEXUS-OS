import type { Actor } from '@uza/contracts';

/**
 * A Prisma WHERE fragment selecting EXACTLY the `Shipment` rows that `inScope`
 * (`packages/contracts/src/permissions.ts`) would admit for this actor. A `Shipment`
 * is scoped by its own `ref`: the by-ref partner read (`PartnerPortalService.readShipment`)
 * calls `inScope` with `{ shipmentRef, kind: 'shipment', ref }`, so for a
 * `logistics_partner` the rule reduces to `scope.shipmentRefs.includes(ref)`.
 *
 * This is a deliberate, mechanical MIRROR of `inScope`'s switch: a list must never surface
 * a shipment the by-ref read would deny, and must never hide one it would admit. The unit
 * test `list agrees with inScope` pins the two together.
 *
 * A `Shipment` carries neither `customerRef` nor `agentId`, so `sales_agent`'s branch of
 * `inScope` (which keys on those fields) can never match a shipment ⇒ it admits nothing.
 * That role also holds no relevant grant on the partner portal, so `authorize()` denies
 * before this predicate ever runs; the branch below keeps the mirror TOTAL and is
 * exercised directly by the agreement test.
 *
 * Role grants are checked separately (via `AuthorizationService.authorize(actor,
 * 'shipment', 'read')` with no object) BEFORE this predicate runs — a role lacking the read
 * grant is denied 403 and never reaches the query. This predicate is object-scope only.
 */
export type ShipmentScopeWhere = {
  ref?: { in: string[] };
};

/** The typed empty set. `{ in: [] }` matches no row — used where `inScope` admits nothing. */
const MATCH_NONE: ShipmentScopeWhere = { ref: { in: [] } };

export const shipmentScopeWhere = (actor: Actor): ShipmentScopeWhere => {
  switch (actor.role) {
    // inScope → true unconditionally for these roles ⇒ no object-scope filter.
    case 'ceo':
    case 'venture_manager':
    case 'finance':
    case 'china_sourcing':
    case 'china_warehouse':
    case 'front_office':
      return {};

    // inScope keys on obj.agentId / obj.customerId, neither of which a Shipment carries
    // ⇒ admits nothing.
    case 'sales_agent':
      return MATCH_NONE;

    // inScope → ref ∈ scope.shipmentRefs (the shipment's own ref is its scope key).
    case 'logistics_partner':
      return { ref: { in: [...(actor.scope.shipmentRefs ?? [])] } };
  }
};
