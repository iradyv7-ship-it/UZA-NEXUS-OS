import { authenticator } from 'otplib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  encryptMfaSecret,
  generateMfaSecret,
  mfaOtpAuthUrl,
  MissingMfaKeyError,
  verifyMfaCode,
} from '../src/platform/auth/mfa';

/**
 * These exist because the previous implementation was:
 *
 *     return code.length === 6 && /^\d{6}$/.test(code);
 *
 * It checked the SHAPE of the code and never the code, so every user with MFA enabled was
 * protected by nothing while being told they were protected. No test asserted that a wrong
 * code is rejected, which is why it survived. That assertion is the first one below.
 */

const KEY = 'test-mfa-key-not-a-real-secret';
let saved: string | undefined;

beforeAll(() => {
  saved = process.env['MFA_ENCRYPTION_KEY'];
  process.env['MFA_ENCRYPTION_KEY'] = KEY;
});
afterAll(() => {
  if (saved === undefined) delete process.env['MFA_ENCRYPTION_KEY'];
  else process.env['MFA_ENCRYPTION_KEY'] = saved;
});

describe('TOTP verification', () => {
  it('accepts the code the user’s authenticator app would show', () => {
    const secret = generateMfaSecret();
    const stored = encryptMfaSecret(secret);
    expect(verifyMfaCode(stored, authenticator.generate(secret))).toBe(true);
  });

  it('REJECTS a wrong six-digit code', () => {
    // The assertion the old stub could never have passed.
    const secret = generateMfaSecret();
    const stored = encryptMfaSecret(secret);
    const right = authenticator.generate(secret);
    const wrong = right === '000000' ? '111111' : '000000';
    expect(verifyMfaCode(stored, wrong)).toBe(false);
  });

  it('rejects a code generated from a DIFFERENT secret', () => {
    const stored = encryptMfaSecret(generateMfaSecret());
    expect(verifyMfaCode(stored, authenticator.generate(generateMfaSecret()))).toBe(false);
  });

  it('rejects malformed input rather than throwing', () => {
    const stored = encryptMfaSecret(generateMfaSecret());
    for (const bad of ['', '12345', '1234567', 'abcdef', '   ']) {
      expect(verifyMfaCode(stored, bad)).toBe(false);
    }
  });

  it('rejects when the user has no secret stored', () => {
    expect(verifyMfaCode(null, '123456')).toBe(false);
  });
});

describe('the secret at rest', () => {
  it('is never stored in plaintext', () => {
    const secret = generateMfaSecret();
    expect(encryptMfaSecret(secret)).not.toContain(secret);
  });

  it('encrypts the same secret differently each time', () => {
    // A fresh IV per encryption. Identical ciphertexts would tell an attacker holding the
    // database which users share a secret.
    const secret = generateMfaSecret();
    expect(encryptMfaSecret(secret)).not.toBe(encryptMfaSecret(secret));
  });

  it('issues a different secret to every user', () => {
    const secrets = new Set(Array.from({ length: 50 }, () => generateMfaSecret()));
    expect(secrets.size).toBe(50);
  });
});

describe('the encryption key', () => {
  it('refuses to encrypt or verify without one', () => {
    // Same reasoning as UZA_ID_PEPPER: a TOTP secret recovered from a stolen database lets
    // an attacker generate valid codes indefinitely, not just replay one.
    const secret = generateMfaSecret();
    const stored = encryptMfaSecret(secret);
    const code = authenticator.generate(secret);

    delete process.env['MFA_ENCRYPTION_KEY'];
    try {
      expect(() => encryptMfaSecret(secret)).toThrow(MissingMfaKeyError);
      expect(() => verifyMfaCode(stored, code)).toThrow(MissingMfaKeyError);
    } finally {
      process.env['MFA_ENCRYPTION_KEY'] = KEY;
    }
  });

  it('cannot read a secret encrypted under a different key', () => {
    const secret = generateMfaSecret();
    const stored = encryptMfaSecret(secret);
    const code = authenticator.generate(secret);

    process.env['MFA_ENCRYPTION_KEY'] = 'a-completely-different-key';
    try {
      // Rotating the key invalidates stored secrets. That is expected — users re-enrol —
      // but it must fail closed rather than silently authenticating.
      expect(verifyMfaCode(stored, code)).toBe(false);
    } finally {
      process.env['MFA_ENCRYPTION_KEY'] = KEY;
    }
  });
});

describe('enrolment', () => {
  it('produces an otpauth URL an authenticator app can read', () => {
    const secret = generateMfaSecret();
    const url = mfaOtpAuthUrl('ceo@uza.rw', secret);
    expect(url.startsWith('otpauth://totp/')).toBe(true);
    expect(url).toContain(`secret=${secret}`);
  });
});
