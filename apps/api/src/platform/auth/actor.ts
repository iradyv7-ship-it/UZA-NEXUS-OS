import type { Actor, Role } from '@uza/contracts';
import type { User } from '@prisma/client';

/**
 * Map a persisted User row to the `Actor` shape the authorisation contract expects.
 *
 * Assumption (flagged in handoff): `Actor.userId` is the readable ref (e.g.
 * AGT-GOM-0021), because that is the identifier other modules carry as `agentId` on
 * orders and leads. `inScope` for a sales_agent compares `obj.agentId === actor.userId`,
 * so the readable ref is the correct key.
 */
export function toActor(
  user: Pick<
    User,
    'ref' | 'role' | 'officeId' | 'scopeCustomerId' | 'scopeCustomerIds' | 'scopeShipmentRefs'
  > & { officeCode?: string },
): Actor {
  return {
    userId: user.ref,
    role: user.role as Role,
    office: user.officeCode ?? user.officeId,
    scope: {
      ...(user.scopeCustomerId ? { customerId: user.scopeCustomerId } : {}),
      customerIds: user.scopeCustomerIds,
      shipmentRefs: user.scopeShipmentRefs,
    },
  };
}
