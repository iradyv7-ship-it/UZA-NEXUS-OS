import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Actor } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { verifyPassword } from './password';
import { toActor } from './actor';

export interface LoginResult {
  readonly accessToken: string;
  readonly actor: Actor;
  readonly mfaRequired: boolean;
}

/**
 * Authentication. JWT-based and MFA-ready:
 *  - password is verified with bcrypt;
 *  - a disabled account (disabledAt) or an EXPIRED account (expiresAt in the past —
 *    this is how partner/customer-portal accounts lapse) is refused;
 *  - if MFA is enabled the second factor is required before a token is issued.
 *
 * MFA verification itself is a documented stub (see `verifyMfaCode`): the structure,
 * columns and enforcement path exist so turning on TOTP is a later, contained change.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string, mfaCode?: string): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { office: true },
    });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.disabledAt) {
      throw new UnauthorizedException('Account disabled');
    }
    if (user.expiresAt && user.expiresAt.getTime() <= Date.now()) {
      // Partner accounts expire. An expired principal cannot authenticate.
      await this.audit.record({
        actorId: user.ref,
        actorRole: user.role,
        resource: 'session',
        action: 'login',
        decision: 'deny',
        reason: 'ACCOUNT_EXPIRED',
      });
      throw new UnauthorizedException('Account expired');
    }

    if (user.mfaEnabled) {
      if (!mfaCode) {
        return { accessToken: '', actor: this.actorFor(user), mfaRequired: true };
      }
      if (!this.verifyMfaCode(user.mfaSecret, mfaCode)) {
        throw new UnauthorizedException('Invalid MFA code');
      }
    }

    const actor = this.actorFor(user);
    const accessToken = await this.jwt.signAsync({ sub: user.id, ref: user.ref, role: user.role });
    await this.audit.record({
      actorId: user.ref,
      actorRole: user.role,
      resource: 'session',
      action: 'login',
      decision: 'allow',
    });
    return { accessToken, actor, mfaRequired: false };
  }

  private actorFor(user: { ref: string; role: string; officeId: string; office?: { code: string };
    scopeCustomerId: string | null; scopeCustomerIds: string[]; scopeShipmentRefs: string[] }): Actor {
    return toActor({
      ref: user.ref,
      role: user.role as Actor['role'],
      officeId: user.officeId,
      officeCode: user.office?.code,
      scopeCustomerId: user.scopeCustomerId,
      scopeCustomerIds: user.scopeCustomerIds,
      scopeShipmentRefs: user.scopeShipmentRefs,
    });
  }

  /**
   * STUB. Real TOTP (otplib) lands with the MFA rollout. Kept deterministic and
   * clearly non-cryptographic so nobody mistakes it for production MFA.
   */
  private verifyMfaCode(secret: string | null, code: string): boolean {
    if (!secret) return false;
    return code.length === 6 && /^\d{6}$/.test(code);
  }
}
