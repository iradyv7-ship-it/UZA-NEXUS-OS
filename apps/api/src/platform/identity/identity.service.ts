import { Injectable, BadRequestException } from '@nestjs/common';
import type { RoleName, UserKind } from '@prisma/client';
import type { Actor } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { hashPassword } from '../auth/password';

/** Never return password hashes or MFA secrets over the wire. */
const SAFE_USER_SELECT = {
  id: true, ref: true, email: true, role: true, kind: true, officeId: true,
  scopeCustomerId: true, scopeCustomerIds: true, scopeShipmentRefs: true,
  mfaEnabled: true, expiresAt: true, disabledAt: true, createdAt: true, updatedAt: true,
} as const;

export interface NewUser {
  ref: string;
  email: string;
  password: string;
  role: RoleName;
  officeId: string;
  scopeCustomerId?: string;
  scopeCustomerIds?: string[];
  scopeShipmentRefs?: string[];
}

/**
 * Organisations, offices, employees, external partner accounts and role assignment.
 *
 * Partner accounts EXPIRE by construction: `createPartnerAccount` requires an
 * `expiresAt` and rejects a missing/past one. Expiry is enforced at login
 * (AuthService), so an account cannot outlive its window even if nobody prunes it.
 *
 * Role assignment is append-only history: `assignRole` writes a RoleAssignment row and
 * updates the user's active role; revocation stamps `revokedAt` rather than deleting.
 */
@Injectable()
export class IdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
  ) {}

  async createOrganisation(actor: Actor, name: string) {
    await this.authz.authorize(actor, 'organisation', 'create');
    return this.prisma.organisation.create({ data: { name } });
  }

  async createOffice(actor: Actor, organisationId: string, code: string, name: string) {
    await this.authz.authorize(actor, 'office', 'create');
    return this.prisma.office.create({ data: { organisationId, code, name } });
  }

  async createEmployee(actor: Actor, input: NewUser) {
    await this.authz.authorize(actor, 'user', 'create');
    return this.prisma.user.create({
      data: await this.userData(input, 'employee', null),
      select: SAFE_USER_SELECT,
    });
  }

  async createPartnerAccount(actor: Actor, input: NewUser, expiresAt: Date) {
    await this.authz.authorize(actor, 'user', 'create');
    if (!expiresAt || expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Partner accounts require a future expiry date');
    }
    return this.prisma.user.create({
      data: await this.userData(input, 'partner', expiresAt),
      select: SAFE_USER_SELECT,
    });
  }

  /** The assigner is the authenticated actor — not a caller-supplied id. */
  async assignRole(actor: Actor, userId: string, role: RoleName, reason?: string) {
    await this.authz.authorize(actor, 'role', 'assign');
    return this.prisma.$transaction(async (tx) => {
      // close any open assignment, then open a new one — history is preserved
      await tx.roleAssignment.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const assignment = await tx.roleAssignment.create({
        data: { userId, role, assignedById: actor.userId, reason: reason ?? null },
      });
      await tx.user.update({ where: { id: userId }, data: { role } });
      return assignment;
    });
  }

  async disableAccount(actor: Actor, userId: string) {
    await this.authz.authorize(actor, 'user', 'update');
    return this.prisma.user.update({ where: { id: userId }, data: { disabledAt: new Date() } });
  }

  /** True when a partner/customer account is past its expiry. */
  async isExpired(userId: string): Promise<boolean> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { expiresAt: true } });
    return !!u?.expiresAt && u.expiresAt.getTime() <= Date.now();
  }

  private async userData(input: NewUser, kind: UserKind, expiresAt: Date | null) {
    return {
      ref: input.ref,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      kind,
      officeId: input.officeId,
      scopeCustomerId: input.scopeCustomerId ?? null,
      scopeCustomerIds: input.scopeCustomerIds ?? [],
      scopeShipmentRefs: input.scopeShipmentRefs ?? [],
      expiresAt,
    };
  }
}
