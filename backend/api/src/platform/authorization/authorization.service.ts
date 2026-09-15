import { Injectable } from '@nestjs/common';
import { can, inScope, maskFields, UzaError, type Actor, type Scopable } from '@uza/contracts';
import { AuditService } from '../audit/audit.service';

/**
 * The SINGLE authorisation enforcement point for the platform. Every protected
 * resource is checked here, at the service layer, because object scope depends on the
 * record being touched — not on the route.
 *
 * Contract rules honoured:
 *  - `can`, `inScope`, `maskFields` are imported from @uza/contracts and NOT
 *    reimplemented. If they were insufficient a contract request would be filed.
 *  - `authorize` THROWS (UzaError) on denial. It never returns false silently.
 *  - Every denial writes an audit row BEFORE the throw.
 */
@Injectable()
export class AuthorizationService {
  constructor(private readonly audit: AuditService) {}

  /**
   * @throws UzaError ACCESS_DENIED_ROLE  when the role grant is missing
   * @throws UzaError ACCESS_DENIED_SCOPE when the object is outside the actor's scope
   */
  async authorize(actor: Actor, resource: string, action: string, obj?: Scopable): Promise<void> {
    if (!can(actor, resource, action)) {
      await this.audit.deny(actor, resource, action, 'ACCESS_DENIED_ROLE', refOf(obj));
      throw new UzaError({
        code: 'ACCESS_DENIED_ROLE',
        responsibleRole: actor.role,
        context: { resource, action },
      });
    }

    if (obj !== undefined && !inScope(actor, obj)) {
      await this.audit.deny(actor, resource, action, 'ACCESS_DENIED_SCOPE', refOf(obj));
      throw new UzaError({
        code: 'ACCESS_DENIED_SCOPE',
        responsibleRole: actor.role,
        context: { resource, action, ...(refOf(obj) ? { ref: refOf(obj)! } : {}) },
      });
    }

    await this.audit.allow(actor, resource, action, refOf(obj));
  }

  /**
   * Field masking on READ. Confidential fields (supplier cost, margin, PO total …)
   * are replaced with MASK for roles not permitted to see them. Masking is applied
   * here on the server, never left to the UI.
   */
  mask<T extends Record<string, unknown>>(actor: Actor, record: T) {
    return maskFields(actor, record);
  }
}

const refOf = (obj?: Scopable): string | undefined =>
  obj?.ref ?? obj?.shipmentRef ?? obj?.customerId ?? undefined;
