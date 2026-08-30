import type { Actor } from '@uza/contracts';

/**
 * A Prisma WHERE fragment selecting EXACTLY the rows that `inScope`
 * (`packages/contracts/src/permissions.ts`) would admit for this actor on a
 * customer/agent-scoped trade resource — `Project`, `Quotation` and `Order`, each of
 * which carries `customerRef` (string) + `agentId` (nullable string).
 *
 * This is a deliberate, mechanical MIRROR of `inScope`'s switch: a list must never
 * surface a record the by-ref read would deny, and must never hide one it would admit.
 * The by-ref reads call `inScope` with `{ customerId: row.customerRef, agentId: row.agentId }`,
 * so each case below maps a single-record `inScope` branch onto a set predicate.
 * The unit test `list agrees with inScope` pins the two together.
 *
 * Role grants are checked separately (via `AuthorizationService.authorize(actor, res, 'read')`
 * with no object) BEFORE this predicate runs — a role lacking the read grant is denied 403
 * and never reaches the query. This predicate is object-scope only.
 */
export type TradeScopeWhere = {
  customerRef?: string | { in: string[] };
  agentId?: string;
  OR?: Array<{ agentId?: string; customerRef?: { in: string[] } }>;
};

/** The typed empty set. `{ in: [] }` matches no row — used where `inScope` admits nothing. */
const MATCH_NONE: TradeScopeWhere = { customerRef: { in: [] } };

export const tradeScopeWhere = (actor: Actor): TradeScopeWhere => {
  switch (actor.role) {
    // inScope → true unconditionally for these roles ⇒ no object-scope filter.
    case 'ceo':
    case 'venture_manager':
    case 'finance':
    case 'china_sourcing':
    case 'china_warehouse':
    case 'front_office':
      return {};

    // inScope → obj.agentId === actor.userId
    //        || (!!obj.customerId && (actor.scope.customerIds ?? []).includes(obj.customerId))
    case 'sales_agent':
      return {
        OR: [
          { agentId: actor.userId },
          { customerRef: { in: [...(actor.scope.customerIds ?? [])] } },
        ],
      };

    // inScope keys on shipmentRef, which these resources do not carry ⇒ admits nothing.
    // (A logistics_partner also holds no read grant on trade resources, so authorize()
    // denies before we ever build a predicate — this branch keeps the mirror total.)
    case 'logistics_partner':
      return MATCH_NONE;
  }
};
