import { Injectable } from '@nestjs/common';
import { UzaError, type Actor } from '@uza/contracts';
import { AuditService } from '../platform/audit/audit.service';
import { hasPlanningCapability, type PlanningCapability } from './planning-access';

/**
 * The Planning module's service-layer authorisation gate — the module-local analogue of the
 * platform `AuthorizationService` and a twin of `CommandAccessService`, honouring the same
 * discipline:
 *  - it THROWS `UzaError` on denial, never returns false;
 *  - EVERY denial writes an audit row (via the shared `AuditService`) BEFORE the throw;
 *  - allows are audited too, once, after object-scope has passed.
 *
 * The split from the platform service is deliberate: `AuthorizationService.authorize` checks
 * `can()` over `@uza/contracts` `ROLE_GRANTS`, which does not know planning resources. This
 * gate checks the module-local `PLANNING_ACCESS` policy instead, but writes to the SAME
 * append-only audit log so denials are visible in one place.
 *
 * Usage in a service method (role first, then object-scope, then allow):
 *   await this.access.assertRole(actor, 'plan:read', 'plan', 'read', ref);   // 403 if role denied
 *   if (!inScope) return this.access.denyScope(actor, 'plan', 'read', ref);  // 403 scope
 *   await this.access.allow(actor, 'plan', 'read', ref);                     // audit the allow
 */
@Injectable()
export class PlanningAccessService {
  constructor(private readonly audit: AuditService) {}

  /**
   * Role gate. Audits + throws `ACCESS_DENIED_ROLE` when the role lacks the capability.
   * Does NOT audit the allow — object-scope may still deny, and the platform contract is
   * one audit row per authorisation decision.
   * @throws UzaError ACCESS_DENIED_ROLE
   */
  async assertRole(
    actor: Actor,
    capability: PlanningCapability,
    resource: string,
    action: string,
    ref?: string,
  ): Promise<void> {
    if (!hasPlanningCapability(actor.role, capability)) {
      await this.audit.deny(actor, resource, action, 'ACCESS_DENIED_ROLE', ref);
      throw new UzaError({
        code: 'ACCESS_DENIED_ROLE',
        responsibleRole: actor.role,
        context: { resource, action },
      });
    }
  }

  /**
   * Object-scope denial. Audits + throws `ACCESS_DENIED_SCOPE`. Call once a service has
   * decided the record is outside the actor's scope (not their plan, not their department).
   * @throws UzaError ACCESS_DENIED_SCOPE
   */
  async denyScope(actor: Actor, resource: string, action: string, ref?: string): Promise<never> {
    await this.audit.deny(actor, resource, action, 'ACCESS_DENIED_SCOPE', ref);
    throw new UzaError({
      code: 'ACCESS_DENIED_SCOPE',
      responsibleRole: actor.role,
      context: { resource, action, ...(ref ? { ref } : {}) },
    });
  }

  /** Audit a granted decision (role passed + object-scope passed). */
  allow(actor: Actor, resource: string, action: string, ref?: string): Promise<{ id: string }> {
    return this.audit.allow(actor, resource, action, ref);
  }
}
