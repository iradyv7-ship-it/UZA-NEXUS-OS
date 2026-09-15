import { createHash } from 'node:crypto';

/**
 * Match keys for the UZA ID.
 *
 * Nexus answers exactly one question about a phone number or a national ID: "are these
 * two records the same person?" Equality is all that needs, so the values are hashed and
 * the originals are never stored here — they stay in the system that legitimately
 * collected them, under the consent given there.
 *
 * THE PEPPER IS NOT OPTIONAL.
 *
 * A Rwandan national ID is 16 digits with a good deal of internal structure, and a phone
 * number is effectively seven unknown digits behind a fixed prefix. Both spaces are small
 * enough to enumerate on a laptop, so an unpeppered SHA-256 is reversible — the hash
 * would BE the identity document, and this table would become the thing it exists to
 * avoid being. With a secret pepper, a stolen database is inert without the application
 * secret.
 *
 * Rotating the pepper invalidates every stored hash. That is survivable — matching is
 * rebuilt by re-submitting from the owning systems — but it is not a routine operation,
 * so treat the pepper like a signing key.
 */
export class MissingPepperError extends Error {
  constructor() {
    super(
      'UZA_ID_PEPPER is not set. Person matching is disabled rather than run unpeppered, ' +
        'because an unpeppered hash of a national ID is recoverable by brute force.',
    );
    this.name = 'MissingPepperError';
  }
}

/**
 * Rwandan mobile numbers get written every way a human can think of: 0788123456,
 * +250788123456, 250 788 123 456, 788-123-456. All of those are one person, and a
 * matcher that treats them as four is worse than no matcher at all — it manufactures
 * duplicates and then people trust the duplicates.
 *
 * Digits only, country code and trunk zero removed, so every spelling collapses to the
 * same nine digits. Deliberately the same normalisation the leak scanner uses in the
 * documents repository, so the two agree about what "the same number" means.
 */
export function normalisePhone(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('250')) d = d.slice(3);
  return d.replace(/^0+/, '');
}

/** National IDs vary only by spacing in practice. Digits, nothing else. */
export function normaliseNationalId(raw: string): string {
  return raw.replace(/\D/g, '');
}

function pepper(): string {
  const p = process.env['UZA_ID_PEPPER'];
  if (!p) throw new MissingPepperError();
  return p;
}

function digest(kind: string, normalised: string): string {
  // The kind is mixed in so that a phone number and a national ID that happened to
  // normalise to the same digits could never collide into one person.
  return createHash('sha256').update(`${kind}:${normalised}:${pepper()}`).digest('hex');
}

/** Returns undefined for an empty or unusable input, so callers can pass raw form data. */
export function phoneHash(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const n = normalisePhone(raw);
  return n.length >= 8 ? digest('phone', n) : undefined;
}

export function nationalIdHash(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const n = normaliseNationalId(raw);
  return n.length >= 8 ? digest('nid', n) : undefined;
}
