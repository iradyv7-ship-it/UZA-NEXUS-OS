import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { authenticator } from 'otplib';
import type { Actor } from '@uza/contracts';
import { prisma, resetDb } from './db';
import { IdentityService } from '../src/platform/identity/identity.service';
import { AuditService } from '../src/platform/audit/audit.service';
import { AuthorizationService } from '../src/platform/authorization/authorization.service';
import { AuthService } from '../src/platform/auth/auth.service';

const audit = new AuditService(prisma as never);
const authz = new AuthorizationService(audit);
const identity = new IdentityService(prisma as never, authz);
const jwt = new JwtService({ secret: 'test-secret', signOptions: { expiresIn: '3600s' } });
const auth = new AuthService(prisma as never, jwt, audit);

const ceo: Actor = { userId: 'CEO-1', role: 'ceo', office: 'RW', scope: {} };

async function office() {
  const org = await identity.createOrganisation(ceo, 'UZA Solutions Ltd');
  return identity.createOffice(ceo, org.id, 'RW', 'Kigali HQ');
}

/** A real employee account, logged in without MFA (not yet enrolled). */
async function freshUser(ref = 'AGT-RW-0001', email = 'mfa-test@uza.rw') {
  const off = await office();
  await identity.createEmployee(ceo, {
    ref,
    email,
    password: 'sup3rsecret',
    role: 'finance',
    officeId: off.id,
  });
  return ref;
}

/** Pulls the base32 secret out of the otpauth:// URL, the same way an authenticator app
 *  would read a scanned QR code — never reaches into encryptMfaSecret/decryptMfaSecret
 *  directly, so this test exercises exactly what a real client can see. */
function secretFromOtpauthUrl(otpauthUrl: string): string {
  const secret = new URL(otpauthUrl).searchParams.get('secret');
  if (!secret) throw new Error('otpauth URL had no secret param');
  return secret;
}

beforeAll(() => {
  // Real TOTP secrets refuse to encrypt/decrypt without a key, same reasoning as
  // UZA_ID_PEPPER — the suite must supply one.
  process.env['MFA_ENCRYPTION_KEY'] = 'test-mfa-key-not-a-real-secret';
});

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

// Regression coverage for the finding that verifyMfaCode never checked the submitted code
// against anything — any six-digit string authenticated any MFA-enabled account. This
// covers the real RFC 6238 TOTP path end to end: enroll, confirm, login, disable.
describe('MFA — real TOTP', () => {
  it('does not enable MFA on startMfaEnrollment alone', async () => {
    const ref = await freshUser();
    const { otpauthUrl } = await auth.startMfaEnrollment(ref);
    expect(otpauthUrl).toContain('otpauth://totp/');

    const login = await auth.login('mfa-test@uza.rw', 'sup3rsecret');
    expect(login.mfaRequired).toBe(false); // still off — confirm was never called
  });

  it('rejects confirmation with a wrong code, and MFA stays off', async () => {
    const ref = await freshUser();
    await auth.startMfaEnrollment(ref);
    await expect(auth.confirmMfaEnrollment(ref, '000000')).rejects.toThrow(/Invalid MFA code/);

    const login = await auth.login('mfa-test@uza.rw', 'sup3rsecret');
    expect(login.mfaRequired).toBe(false);
  });

  it('enrolls, confirms, then requires a real TOTP code at login', async () => {
    const ref = await freshUser();
    const { otpauthUrl } = await auth.startMfaEnrollment(ref);
    const secret = secretFromOtpauthUrl(otpauthUrl);

    await auth.confirmMfaEnrollment(ref, authenticator.generate(secret));

    // Now MFA-required: password alone gets an empty token and mfaRequired: true.
    const first = await auth.login('mfa-test@uza.rw', 'sup3rsecret');
    expect(first.mfaRequired).toBe(true);
    expect(first.accessToken).toBe('');

    // The stub this replaced accepted any six digits — prove a wrong one is rejected now.
    await expect(auth.login('mfa-test@uza.rw', 'sup3rsecret', '000000')).rejects.toThrow(
      /Invalid MFA code/,
    );

    // The real code, freshly generated, succeeds.
    const ok = await auth.login('mfa-test@uza.rw', 'sup3rsecret', authenticator.generate(secret));
    expect(ok.mfaRequired).toBe(false);
    expect(ok.accessToken).not.toBe('');
  });

  it('disables MFA only with a currently-valid code, not on a bearer token alone', async () => {
    const ref = await freshUser();
    const { otpauthUrl } = await auth.startMfaEnrollment(ref);
    const secret = secretFromOtpauthUrl(otpauthUrl);
    await auth.confirmMfaEnrollment(ref, authenticator.generate(secret));

    await expect(auth.disableMfa(ref, '000000')).rejects.toThrow(/Invalid MFA code/);

    await auth.disableMfa(ref, authenticator.generate(secret));
    const login = await auth.login('mfa-test@uza.rw', 'sup3rsecret');
    expect(login.mfaRequired).toBe(false); // back off, no second factor demanded
  });

  it('encrypts the secret at rest — the stored column is never the plaintext TOTP secret', async () => {
    const ref = await freshUser();
    const { otpauthUrl } = await auth.startMfaEnrollment(ref);
    const secret = secretFromOtpauthUrl(otpauthUrl);

    const row = await prisma.user.findUnique({ where: { ref } });
    expect(row?.mfaSecret).not.toBe(secret);
    expect(row?.mfaSecret).toContain(':'); // iv:authTag:ciphertext
  });
});
