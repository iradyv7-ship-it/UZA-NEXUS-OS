import { Injectable } from '@nestjs/common';
import { UzaError, type Actor } from '@uza/contracts';
import { AuditService } from '../platform/audit/audit.service';
import { hasUmurimoCapability, type UmurimoCapability } from './umurimo-access';

/**
 * Umurimo's service-layer authorisation gate — the module-local twin of
 * `PlanningAccessService` and `CommandAccessService`, honouring the same three rules:
 *
 *  - it THROWS `UzaError` on denial, never returns false;
 *  - EVERY denial writes an audit row BEFORE the throw;
 *  - allows are audited once, after object-scope has passed.
 *
 * It writes to the SAME append-only audit log as the platform and planning gates, so a denial
 * anywhere in the system is visible in one place rather than three.
 *
 * Usage in a service method — role first, then object scope, then allow:
 *   await this.access.assertRole(actor, 'blocker:own', 'blocker', 'own', ref);
 *   if (!mine) return this.access.denyScope(actor, 'blocker', 'own', ref);
 *   await this.access.allow(actor, 'blocker', 'own', ref);
 */
@Injectable()
export class UmurimoAccessService {
  constructor(private readonly audit: AuditService) {}

  /**
   * Role gate. Audits + throws `ACCESS_DENIED_ROLE` when the role lacks the capability.
   * Does NOT audit the allow — object scope may still deny, and the platform contract is one
   * audit row per authorisation decision.
   * @throws UzaError ACCESS_DENIED_ROLE
   */
  async assertRole(
    actor: Actor,
    capability: UmurimoCapability,
    resource: string,
    action: string,
    ref?: string,
  ): Promise<void> {
    if (!hasUmurimoCapability(actor.role, capability)) {
      await this.audit.deny(actor, resource, action, 'ACCESS_DENIED_ROLE', ref);
      throw new UzaError({
        code: 'ACCESS_DENIED_ROLE',
        responsibleRole: actor.role,
        context: { resource, action },
      });
    }
  }

  /**
   * Object-scope denial. Audits + throws `ACCESS_DENIED_SCOPE`.
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

  /** Audit a granted decision (role passed + object scope passed). */
  allow(actor: Actor, resource: string, action: string, ref?: string): Promise<{ id: string }> {
    return this.audit.allow(actor, resource, action, ref);
  }
}
