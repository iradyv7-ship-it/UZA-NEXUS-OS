import { beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import type { Actor } from '@uza/contracts';
import { prisma, resetDb } from './db';
import { IdentityService } from '../src/platform/identity/identity.service';
import { AuditService } from '../src/platform/audit/audit.service';
import { AuthorizationService } from '../src/platform/authorization/authorization.service';
import { AuthService } from '../src/platform/auth/auth.service';
import { GoogleAuthService } from '../src/platform/auth/google.service';
import { AuthController } from '../src/platform/auth/auth.controller';

const audit = new AuditService(prisma as never);
const authz = new AuthorizationService(audit);
const identity = new IdentityService(prisma as never, authz);
const jwt = new JwtService({ secret: 'test-secret', signOptions: { expiresIn: '3600s' } });
const auth = new AuthService(prisma as never, jwt, audit);

// A fully-configured Google service (env present). The external call is always stubbed.
const configuredEnv = {
  GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
  GOOGLE_CALLBACK_URL: 'http://localhost:3000/auth/google/callback',
};
const google = new GoogleAuthService(new ConfigService(configuredEnv), jwt, auth);

const ceo: Actor = { userId: 'CEO-1', role: 'ceo', office: 'RW', scope: {} };

async function office() {
  const org = await identity.createOrganisation(ceo, 'UZA Solutions Ltd');
  return identity.createOffice(ceo, org.id, 'RW', 'Kigali HQ');
}

/** Stub the ONLY seam that talks to Google: inject a verified payload, no network. */
function stubGoogle(id: { email: string; emailVerified?: boolean; sub?: string; name?: string }) {
  return vi.spyOn(google, 'resolveGoogleIdentity').mockResolvedValue({
    email: id.email,
    emailVerified: id.emailVerified ?? true,
    sub: id.sub ?? 'google-sub-123',
    name: id.name,
  });
}

beforeEach(async () => {
  await resetDb();
  vi.restoreAllMocks();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe('Google sign-in — alternate credential', () => {
  it('matched active user → same app JWT + Actor, records the Google link, audits allow', async () => {
    const off = await office();
    await identity.createEmployee(ceo, {
      ref: 'AGT-RW-0001', email: 'kagabo@uza.rw', password: 'sup3rsecret',
      role: 'finance', officeId: off.id,
    });

    // Google returns a different-cased email + verified sub — match must be case-insensitive.
    stubGoogle({ email: 'Kagabo@UZA.rw', sub: 'sub-1' });
    const state = await google.createState();
    const result = await google.handleCallback('fake-code', state);

    expect(result.accessToken).not.toBe('');
    expect(result.mfaRequired).toBe(false);
    expect(result.actor.role).toBe('finance');           // role comes from the user record
    expect(result.actor.userId).toBe('AGT-RW-0001');
    expect(result.actor.office).toBe('RW');

    // The issued token is a real, verifiable app JWT carrying the user's role.
    const decoded = await jwt.verifyAsync<{ role: string; ref: string }>(result.accessToken);
    expect(decoded.role).toBe('finance');
    expect(decoded.ref).toBe('AGT-RW-0001');

    const allow = await prisma.auditLog.findFirst({ where: { action: 'login', decision: 'allow' } });
    expect(allow).not.toBeNull();

    // First Google success records the verified sub + provider (additive; role unchanged).
    const linked = await prisma.user.findUnique({ where: { email: 'kagabo@uza.rw' } });
    expect(linked?.googleSub).toBe('sub-1');
    expect(linked?.authProvider).toBe('google');
    expect(linked?.role).toBe('finance');
  });

  it('unknown email → denied, no token, audits NO_MATCHING_USER (no auto-provision)', async () => {
    stubGoogle({ email: 'stranger@gmail.com', sub: 'sub-x' });
    const state = await google.createState();

    await expect(google.handleCallback('fake-code', state)).rejects.toThrow();

    // No user was created — match-only.
    expect(await prisma.user.count()).toBe(0);
    const denial = await prisma.auditLog.findFirst({
      where: { action: 'login', decision: 'deny', reason: 'NO_MATCHING_USER' },
    });
    expect(denial).not.toBeNull();
    expect(denial?.actorId).toBe('stranger@gmail.com');
  });

  it('disabled account → denied, audits ACCOUNT_DISABLED', async () => {
    const off = await office();
    const user = await identity.createEmployee(ceo, {
      ref: 'EMP-DIS', email: 'disabled@uza.rw', password: 'password1',
      role: 'front_office', officeId: off.id,
    });
    await prisma.user.update({ where: { id: user.id }, data: { disabledAt: new Date() } });

    stubGoogle({ email: 'disabled@uza.rw' });
    const state = await google.createState();

    await expect(google.handleCallback('fake-code', state)).rejects.toThrow('Account disabled');
    const denial = await prisma.auditLog.findFirst({
      where: { action: 'login', decision: 'deny', reason: 'ACCOUNT_DISABLED' },
    });
    expect(denial).not.toBeNull();
  });

  it('expired account → denied, audits ACCOUNT_EXPIRED', async () => {
    const off = await office();
    await identity.createPartnerAccount(
      ceo,
      { ref: 'PRT-EXP', email: 'partner@forwarder.cn', password: 'password1',
        role: 'logistics_partner', officeId: off.id, scopeShipmentRefs: ['SHP-2026-0001'] },
      new Date(Date.now() + 86_400_000),
    );
    // Force the window into the past.
    await prisma.user.update({
      where: { email: 'partner@forwarder.cn' }, data: { expiresAt: new Date(Date.now() - 1000) },
    });

    stubGoogle({ email: 'partner@forwarder.cn' });
    const state = await google.createState();

    await expect(google.handleCallback('fake-code', state)).rejects.toThrow('Account expired');
    const denial = await prisma.auditLog.findFirst({
      where: { action: 'login', decision: 'deny', reason: 'ACCOUNT_EXPIRED' },
    });
    expect(denial).not.toBeNull();
  });

  it('state mismatch → rejected before any code exchange', async () => {
    const off = await office();
    await identity.createEmployee(ceo, {
      ref: 'AGT-RW-0009', email: 'ok@uza.rw', password: 'password1', role: 'finance', officeId: off.id,
    });
    const spy = stubGoogle({ email: 'ok@uza.rw' });

    await expect(google.handleCallback('fake-code', 'not-a-valid-state')).rejects.toThrow();
    // State is checked first, so the Google exchange never runs on a bad state.
    expect(spy).not.toHaveBeenCalled();
  });

  it('unverified Google email → rejected, no user matched', async () => {
    const off = await office();
    await identity.createEmployee(ceo, {
      ref: 'AGT-RW-0010', email: 'unverified@uza.rw', password: 'password1', role: 'finance', officeId: off.id,
    });
    stubGoogle({ email: 'unverified@uza.rw', emailVerified: false });
    const state = await google.createState();

    await expect(google.handleCallback('fake-code', state)).rejects.toThrow();
    // No login was issued for an email Google itself does not vouch for.
    const allow = await prisma.auditLog.findFirst({ where: { action: 'login', decision: 'allow' } });
    expect(allow).toBeNull();
  });
});

/**
 * NOTE: the unconfigured service is built from a STUB, not from `new ConfigService({})`.
 *
 * Nest's ConfigService falls through to `process.env` for any key its own map does not hold,
 * so on a machine whose .env has GOOGLE_CLIENT_ID set — which is every machine where Google
 * sign-in actually works — `new ConfigService({})` reported itself configured and this test
 * failed. It was asserting a property of the developer's environment rather than of the code.
 */
describe('Google sign-in — controller / env gating', () => {
  it('unconfigured env → 503 { error: google_signin_not_configured } on both endpoints', async () => {
    const unconfigured = new GoogleAuthService(({ get: () => undefined } as unknown as ConfigService), jwt, auth);
    expect(unconfigured.isConfigured()).toBe(false);
    const controller = new AuthController(auth, unconfigured);

    // Callback throws synchronously with the exact contract body.
    let thrown: unknown;
    try {
      controller.google_callback('code', 'state');
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ServiceUnavailableException);
    expect((thrown as ServiceUnavailableException).getResponse()).toEqual({
      error: 'google_signin_not_configured',
    });

    // Start endpoint rejects and never redirects.
    const res = { redirect: vi.fn() };
    await expect(controller.google_start(res)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it('configured start endpoint → 302 to Google consent with scopes + state', async () => {
    const controller = new AuthController(auth, google);
    const res = { redirect: vi.fn() };

    await controller.google_start(res);

    expect(res.redirect).toHaveBeenCalledTimes(1);
    const url = res.redirect.mock.calls[0]![0] as string;
    expect(url).toContain('accounts.google.com');
    expect(url).toContain('scope=openid');
    expect(url).toContain('state=');
    expect(url).toContain('access_type=online');
  });

  it('configured callback endpoint → returns { accessToken, actor } for a matched user', async () => {
    const off = await office();
    await identity.createEmployee(ceo, {
      ref: 'CEO-RW-0002', email: 'owner@gmail.com', password: 'password1', role: 'ceo', officeId: off.id,
    });
    stubGoogle({ email: 'owner@gmail.com', sub: 'owner-sub' });
    const state = await google.createState();

    const controller = new AuthController(auth, google);
    const result = await controller.google_callback('fake-code', state);

    expect(result.accessToken).not.toBe('');
    expect(result.actor.role).toBe('ceo');
    expect(result.actor.userId).toBe('CEO-RW-0002');
  });
});
