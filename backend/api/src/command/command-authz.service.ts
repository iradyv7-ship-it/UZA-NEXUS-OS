import { Injectable } from '@nestjs/common';
import { UzaError, type Actor } from '@uza/contracts';
import { AuditService } from '../platform/audit/audit.service';
import { hasCommandCapability, type CommandCapability } from './command-access';

/**
 * The Command Center's service-layer authorisation gate. It is the module-local analogue of
 * the platform `AuthorizationService`, honouring the same discipline:
 *  - it THROWS `UzaError` on denial, never returns false;
 *  - EVERY denial writes an audit row (via the shared `AuditService`) BEFORE the throw;
 *  - allows are audited too, once, after object-scope has passed.
 *
 * The split from the platform service is deliberate: `AuthorizationService.authorize` checks
 * `can()` over `@uza/contracts` `ROLE_GRANTS`, which does not know Command resources. This
 * gate checks the module-local `COMMAND_ACCESS` policy instead, but writes to the SAME
 * append-only audit log so denials are visible in one place.
 *
 * Usage in a service method (mirrors the platform flow — role first, then scope, then allow):
 *   this.access.assertRole(actor, 'task:read', 'commandTask', 'read', ref);   // 403 if role denied
 *   if (!inScope) return this.access.denyScope(actor, 'commandTask', 'read', ref); // 403 scope
 *   await this.access.allow(actor, 'commandTask', 'read', ref);               // audit the allow
 */
@Injectable()
export class CommandAccessService {
  constructor(private readonly audit: AuditService) {}

  /**
   * Role gate. Audits + throws `ACCESS_DENIED_ROLE` when the role lacks the capability.
   * Does NOT audit the allow — object-scope may still deny, and the platform contract is
   * one audit row per authorisation decision.
   * @throws UzaError ACCESS_DENIED_ROLE
   */
  async assertRole(
    actor: Actor,
    capability: CommandCapability,
    resource: string,
    action: string,
    ref?: string,
  ): Promise<void> {
    if (!hasCommandCapability(actor.role, capability)) {
      await this.audit.deny(actor, resource, action, 'ACCESS_DENIED_ROLE', ref);
      throw new UzaError({
        code: 'ACCESS_DENIED_ROLE',
        responsibleRole: actor.role,
        context: { resource, action },
      });
    }
  }

  /**
   * Object-scope denial. Audits + throws `ACCESS_DENIED_SCOPE`. Call this once a service has
   * decided the record is outside the actor's scope (not their task, not their department,
   * not their grant).
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
