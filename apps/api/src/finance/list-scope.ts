import type { Actor } from '@uza/contracts';

/**
 * A Prisma WHERE fragment selecting EXACTLY the rows that `inScope`
 * (`packages/contracts/src/permissions.ts`) would admit for this actor on a
 * customer-scoped finance resource — here `Payment`, which carries `customerRef`
 * (string). Unlike trade's `Project`/`Quotation`/`Order`, a `Payment` row has NO
 * `agentId` column, so the by-ref read (`PaymentService.read`) calls `inScope` with
 * `{ customerId: row.customerRef }` and NO agent key. This mirror therefore keys purely
 * on `customerRef`: a `sales_agent`'s `agentId === userId` branch of `inScope` can never
 * fire on a Payment (there is no agent field to match), leaving only its
 * customerId-membership branch.
 *
 * This is a deliberate, mechanical MIRROR of `inScope`'s switch: a list must never surface
 * a record the by-ref read would deny, and must never hide one it would admit. The unit
 * test `list agrees with inScope` pins the two together.
 *
 * Role grants are checked separately (via `AuthorizationService.authorize(actor, res,
 * 'read')` with no object) BEFORE this predicate runs — a role lacking the read grant is
 * denied 403 and never reaches the query. Per `ROLE_GRANTS` only `finance` (`payment:*`),
 * `ceo` (`*:*`) and `venture_manager` (`payment:read`) hold `payment:read`; all three pass
 * `inScope` unconditionally, so in practice this predicate returns `{}` for every role that
 * can actually reach it. The `sales_agent`/`logistics_partner` branches below are
 * unreachable via the grant gate but keep the mirror TOTAL — the agreement test exercises
 * them directly against `inScope`.
 */
export type FinanceScopeWhere = {
  customerRef?: string | { in: string[] };
};

/** The typed empty set. `{ in: [] }` matches no row — used where `inScope` admits nothing. */
const MATCH_NONE: FinanceScopeWhere = { customerRef: { in: [] } };

export const financeScopeWhere = (actor: Actor): FinanceScopeWhere => {
  switch (actor.role) {
    // inScope → true unconditionally for these roles ⇒ no object-scope filter.
    case 'ceo':
    case 'venture_manager':
    case 'finance':
    case 'china_sourcing':
    case 'china_warehouse':
    case 'front_office':
      return {};

    // inScope → obj.agentId === actor.userId || (customerId ∈ scope.customerIds).
    // A Payment carries no agentId, so the first disjunct never fires ⇒ customer-set only.
    case 'sales_agent':
      return { customerRef: { in: [...(actor.scope.customerIds ?? [])] } };

    // inScope keys on shipmentRef, which a Payment does not carry ⇒ admits nothing.
    // (A logistics_partner also holds no payment:read grant, so authorize() denies before
    // we ever build a predicate — this branch keeps the mirror total.)
    case 'logistics_partner':
      return MATCH_NONE;
  }
};
