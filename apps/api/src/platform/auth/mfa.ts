import { authenticator } from 'otplib';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * TOTP (RFC 6238) multi-factor authentication — real verification, replacing the stub that
 * accepted any six-digit string. Google/Microsoft/Authy-compatible: enrolment returns a
 * standard `otpauth://` URL (render it as a QR code, or let the user paste it), and
 * verification runs the same RFC against the stored secret.
 *
 * THE ENCRYPTION KEY IS NOT OPTIONAL, for the same reason `UZA_ID_PEPPER` is not optional
 * (see `uza-id.hash.ts`): a TOTP secret is a long-lived credential. Recovering it from a
 * stolen database lets an attacker generate valid codes indefinitely — not just replay one
 * captured code, which is all a stolen password hash or a leaked JWT would give them. A
 * server-side key means the database alone is never enough.
 */
export class MissingMfaKeyError extends Error {
  constructor() {
    super(
      'MFA_ENCRYPTION_KEY is not set. Refusing to store or read a TOTP secret unencrypted ' +
        '— see uza-id.hash.ts for why an unkeyed secret sitting in the database is ' +
        'equivalent to no secret at all.',
    );
    this.name = 'MissingMfaKeyError';
  }
}

function encryptionKey(): Buffer {
  const k = process.env['MFA_ENCRYPTION_KEY'];
  if (!k) throw new MissingMfaKeyError();
  // Any-length passphrase in, a fixed 32-byte AES-256 key out.
  return createHash('sha256').update(k).digest();
}

/** A fresh base32 TOTP secret for one enrolment. Nothing is written or trusted until the
 *  caller proves they can generate a code with it — see AuthService.confirmMfaEnrollment. */
export function generateMfaSecret(): string {
  return authenticator.generateSecret();
}

/** The `otpauth://` URL an authenticator app scans (as a QR code) or accepts pasted in. */
export function mfaOtpAuthUrl(accountLabel: string, secret: string): string {
  return authenticator.keyuri(accountLabel, 'UZA Nexus', secret);
}

const IV_LENGTH = 12; // AES-GCM standard nonce size

/** Encrypt a TOTP secret before it is written to User.mfaSecret. */
export function encryptMfaSecret(secret: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // iv:authTag:ciphertext, each base64 — one text column, nothing extra to join at read time.
  return [iv, authTag, ciphertext].map((b) => b.toString('base64')).join(':');
}

function decryptMfaSecret(stored: string): string {
  const [ivB64, authTagB64, ciphertextB64] = stored.split(':');
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error('malformed stored MFA secret');
  }
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * Real verification: RFC 6238 TOTP, checked against otplib's default ±1 time-step window
 * (30s either side) so a small clock drift between phone and server does not lock anyone
 * out. `secret` is the ENCRYPTED column value — decryption happens in here, next to the
 * only place the plaintext needs to briefly exist.
 */
export function verifyMfaCode(encryptedSecret: string | null, code: string): boolean {
  if (!encryptedSecret) return false;
  if (!/^\d{6}$/.test(code)) return false;
  try {
    return authenticator.verify({ token: code, secret: decryptMfaSecret(encryptedSecret) });
  } catch {
    // A malformed stored secret or a decryption failure is a verification failure, not a
    // crash — a corrupt row must not turn into a 500 on every future login attempt.
    return false;
  }
}
