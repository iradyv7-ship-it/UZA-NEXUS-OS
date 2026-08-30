import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Actor } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { verifyPassword } from './password';
import { toActor } from './actor';
import { encryptMfaSecret, generateMfaSecret, mfaOtpAuthUrl, verifyMfaCode } from './mfa';

export interface LoginResult {
  readonly accessToken: string;
  readonly actor: Actor;
  readonly mfaRequired: boolean;
}

export interface MfaEnrollment {
  /** Not yet active. Nothing is trusted until confirmMfaEnrollment verifies a real code. */
  readonly otpauthUrl: string;
}

/**
 * Authentication. JWT-based, with real TOTP MFA:
 *  - password is verified with bcrypt;
 *  - a disabled account (disabledAt) or an EXPIRED account (expiresAt in the past —
 *    this is how partner/customer-portal accounts lapse) is refused;
 *  - if MFA is enabled the second factor is required before a token is issued, verified
 *    with RFC 6238 TOTP (see `mfa.ts`) — not the six-digit-shaped stub this replaced.
 *
 * Enrollment is two steps, deliberately: `startMfaEnrollment` generates a secret and
 * returns it as an otpauth:// URL, but writes nothing to `mfaEnabled`. Only
 * `confirmMfaEnrollment`, which requires a real code generated from that secret, flips
 * `mfaEnabled` on — proving the user actually captured the secret in an authenticator app
 * before the account starts requiring it. Enrolling with a secret nobody can generate a
 * code from would be a self-lockout, not security.
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
      if (!verifyMfaCode(user.mfaSecret, mfaCode)) {
        await this.audit.record({
          actorId: user.ref,
          actorRole: user.role,
          resource: 'session',
          action: 'login',
          decision: 'deny',
          reason: 'MFA_INVALID_CODE',
        });
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

  /**
   * Google/OIDC login. The Google identity has already been VERIFIED by the caller
   * (GoogleAuthService verifies the ID token against GOOGLE_CLIENT_ID); this method only
   * decides authorisation. It is a pure alternate credential:
   *
   *  - It matches an EXISTING active user by their primary email OR any of their
   *    `alternateEmails` (e.g. a personal Gmail routing to a company account), case-
   *    insensitively. It never auto-provisions — an unmatched email is a denial, not a
   *    signup. `alternateEmails` is stored pre-lowercased (see seed-users.ts), so a plain
   *    `has` on the already-lowercased incoming address is a correct case-insensitive match
   *    without needing Prisma's `mode: 'insensitive'`, which array filters don't support.
   *  - A matched user receives EXACTLY the JWT + Actor password login would issue, so the
   *    role and object-scope come from the user record and nothing else — signing in via an
   *    alternate email never grants anything the primary email wouldn't.
   *  - Disabled and expired accounts are refused, mirroring the password path, and every
   *    denial writes an audit row before throwing (NO_MATCHING_USER / ACCOUNT_DISABLED /
   *    ACCOUNT_EXPIRED / MFA_REQUIRED).
   *
   * On first success the verified Google `sub` is recorded on the user (authProvider =
   * 'google') so later logins can be strengthened; this is additive and never changes role
   * or scope.
   */
  async loginWithGoogle(email: string, googleSub?: string): Promise<LoginResult> {
    const normalised = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: normalised, mode: 'insensitive' } },
          { alternateEmails: { has: normalised } },
        ],
      },
      include: { office: true },
    });

    if (!user) {
      // Secure default: match-only. No matching user is a denial, audited then thrown.
      await this.audit.record({
        actorId: normalised,
        actorRole: 'unknown',
        resource: 'session',
        action: 'login',
        decision: 'deny',
        reason: 'NO_MATCHING_USER',
        detail: { provider: 'google', email: normalised },
      });
      throw new UnauthorizedException('Google sign-in is not permitted for this account');
    }

    if (user.disabledAt) {
      await this.audit.record({
        actorId: user.ref,
        actorRole: user.role,
        resource: 'session',
        action: 'login',
        decision: 'deny',
        reason: 'ACCOUNT_DISABLED',
        detail: { provider: 'google' },
      });
      throw new UnauthorizedException('Account disabled');
    }

    if (user.expiresAt && user.expiresAt.getTime() <= Date.now()) {
      // Partner accounts expire; an expired principal cannot authenticate, by any credential.
      await this.audit.record({
        actorId: user.ref,
        actorRole: user.role,
        resource: 'session',
        action: 'login',
        decision: 'deny',
        reason: 'ACCOUNT_EXPIRED',
        detail: { provider: 'google' },
      });
      throw new UnauthorizedException('Account expired');
    }

    if (user.mfaEnabled) {
      // The redirect flow cannot collect a second factor, so an MFA-enabled account must
      // use password + MFA until Google-flow MFA is designed. Refuse rather than bypass MFA.
      await this.audit.record({
        actorId: user.ref,
        actorRole: user.role,
        resource: 'session',
        action: 'login',
        decision: 'deny',
        reason: 'MFA_REQUIRED',
        detail: { provider: 'google' },
      });
      throw new UnauthorizedException('This account requires multi-factor sign-in');
    }

    // Record the verified Google link on first success; keep it idempotent on re-login.
    if (googleSub && (user.googleSub !== googleSub || user.authProvider !== 'google')) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { googleSub, authProvider: 'google' },
      });
    }

    const actor = this.actorFor(user);
    const accessToken = await this.jwt.signAsync({ sub: user.id, ref: user.ref, role: user.role });
    await this.audit.record({
      actorId: user.ref,
      actorRole: user.role,
      resource: 'session',
      action: 'login',
      decision: 'allow',
      detail: { provider: 'google' },
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
   * Step 1 of enrolling: generate a secret, return it as an otpauth:// URL to render as a
   * QR code (or accept pasted). Self-service only — `userRef` always comes from the
   * caller's own authenticated identity, never a caller-supplied id, matching the pattern
   * `identity.service.ts` uses for role assignment.
   *
   * Does NOT set mfaEnabled and does NOT touch the existing mfaSecret column yet — that
   * only happens once `confirmMfaEnrollment` proves the secret actually works. Calling
   * this twice before confirming is fine; it just issues a new secret, discarding the
   * unconfirmed one.
   */
  async startMfaEnrollment(userRef: string): Promise<MfaEnrollment> {
    const user = await this.prisma.user.findUnique({ where: { ref: userRef } });
    if (!user) throw new UnauthorizedException('unknown account');
    const secret = generateMfaSecret();
    await this.prisma.user.update({
      where: { ref: userRef },
      // Stored encrypted immediately, even though mfaEnabled stays false — an unconfirmed
      // secret sitting in the database in plaintext would defeat the point of encrypting
      // the confirmed one.
      data: { mfaSecret: encryptMfaSecret(secret) },
    });
    return { otpauthUrl: mfaOtpAuthUrl(user.email, secret) };
  }

  /**
   * Step 2: prove the enrollment worked. Requires a real code generated from the secret
   * `startMfaEnrollment` just issued — only then does the account start requiring MFA.
   */
  async confirmMfaEnrollment(userRef: string, code: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { ref: userRef } });
    if (!user) throw new UnauthorizedException('unknown account');
    if (!user.mfaSecret) {
      throw new BadRequestException('call startMfaEnrollment first');
    }
    if (!verifyMfaCode(user.mfaSecret, code)) {
      throw new UnauthorizedException('Invalid MFA code');
    }
    await this.prisma.user.update({ where: { ref: userRef }, data: { mfaEnabled: true } });
    await this.audit.record({
      actorId: user.ref,
      actorRole: user.role,
      resource: 'session',
      action: 'mfa:enable',
      decision: 'allow',
    });
  }

  /**
   * Turn MFA off. Requires a currently-valid code, the same self-service proof-of-
   * possession as confirming — otherwise anyone who stole a bearer token could disable the
   * second factor that was supposed to stop them.
   */
  async disableMfa(userRef: string, code: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { ref: userRef } });
    if (!user) throw new UnauthorizedException('unknown account');
    if (!user.mfaEnabled || !verifyMfaCode(user.mfaSecret, code)) {
      throw new UnauthorizedException('Invalid MFA code');
    }
    await this.prisma.user.update({
      where: { ref: userRef },
      data: { mfaEnabled: false, mfaSecret: null },
    });
    await this.audit.record({
      actorId: user.ref,
      actorRole: user.role,
      resource: 'session',
      action: 'mfa:disable',
      decision: 'allow',
    });
  }
}
