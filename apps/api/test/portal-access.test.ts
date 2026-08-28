import { describe, expect, it } from 'vitest';
import {
  decideAccess,
  PORTAL_REFUSAL,
  portalAudit,
  redact,
} from '../src/platform/portal/portal-access';

/**
 * Narrow a refusal and return its reason. The decision type is a discriminated union, so
 * `.reason` is only reachable on the refused branch — which is the type doing its job.
 */
function refusalReason(d: ReturnType<typeof decideAccess>): string {
  expect(d.allowed).toBe(false);
  return d.allowed ? '' : d.reason;
}

const consented = {
  subjectExists: true,
  entitled: true,
  consentGivenAt: new Date('2026-09-01'),
  consentWithdrawnAt: null,
};

describe('the four access rules', () => {
  it('allows an entitled party with consent', () => {
    expect(decideAccess(consented)).toEqual({ allowed: true });
  });

  it('refuses a subject that does not exist', () => {
    expect(decideAccess({ ...consented, subjectExists: false }).allowed).toBe(false);
  });

  it('refuses a party with no link to this subject', () => {
    // Without this rule a portal is an enumeration tool: try IDs until one answers.
    expect(decideAccess({ ...consented, entitled: false })).toEqual({
      allowed: false,
      reason: 'not-entitled',
    });
  });

  it('refuses without consent, and after consent is withdrawn', () => {
    expect(refusalReason(decideAccess({ ...consented, consentGivenAt: null }))).toBe('no-consent');
    expect(refusalReason(decideAccess({ ...consented, consentWithdrawnAt: new Date() }))).toBe(
      'consent-withdrawn',
    );
  });
});

describe('self-service', () => {
  it('lets a person see their own record without consenting to themselves', () => {
    // The client portal. Demanding consent-to-self would lock people out of their own file.
    expect(decideAccess({ subjectExists: true, entitled: true, selfService: true })).toEqual({
      allowed: true,
    });
  });

  it('still requires the subject to exist and the party to be entitled', () => {
    // selfService must not become a bypass. "I am this person" is a claim the portal
    // establishes from the session, and entitlement is what proves it.
    expect(decideAccess({ subjectExists: false, entitled: true, selfService: true }).allowed).toBe(
      false,
    );
    expect(
      refusalReason(decideAccess({ subjectExists: true, entitled: false, selfService: true })),
    ).toBe('not-entitled');
  });
});

describe('one refusal, whatever the reason', () => {
  it('gives every failure a distinct audit reason but the same public message', () => {
    const failures = [
      { ...consented, subjectExists: false },
      { ...consented, entitled: false },
      { ...consented, consentGivenAt: null },
      { ...consented, consentWithdrawnAt: new Date() },
    ];
    const reasons = failures.map((f) => refusalReason(decideAccess(f)));
    // Distinct internally — a party repeatedly hitting 'not-entitled' is worth noticing.
    expect(new Set(reasons).size).toBe(4);
    // Identical externally. If these differed, the portal would answer "is this national
    // ID a UZA client?" — a disclosure even when the answer is no.
    expect(PORTAL_REFUSAL).toBe('No record available for that reference.');
  });
});

describe('redaction', () => {
  const file = () => ({ uzaId: 'UZA-P-000123', name: 'A Person', collateral: 750_000 });

  it('removes what the party may not see and keeps the rest', () => {
    const out = redact(file(), ['collateral']);
    expect(out.collateral).toBeUndefined();
    expect(out.uzaId).toBe('UZA-P-000123');
    expect(out.name).toBe('A Person');
  });

  it('does not mutate the record it was given', () => {
    // One record is often shaped for two parties in one request. Mutating would make the
    // second party's view depend on the first one's.
    const original = file();
    redact(original, ['collateral']);
    expect(original.collateral).toBe(750_000);
  });

  it('is a no-op when nothing is dropped', () => {
    expect(redact(file(), [])).toEqual(file());
  });
});

describe('the audit row', () => {
  it('records the party, the portal and the subject', () => {
    const row = portalAudit({
      party: { kind: 'lender', id: 'unguka' },
      portal: 'bank',
      subjectRef: 'UZA-P-000123',
      decision: 'allow',
    });
    expect(row).toMatchObject({
      actorId: 'lender:unguka',
      actorRole: 'lender',
      resource: 'portal:bank',
      action: 'read',
      decision: 'allow',
      targetRef: 'UZA-P-000123',
    });
    expect(row.reason).toBeUndefined();
  });

  it('carries the real reason on a refusal, though the caller is told nothing', () => {
    const row = portalAudit({
      party: { kind: 'garage', id: 'GAR-001' },
      portal: 'garage',
      subjectRef: 'UZA-P-000999',
      decision: 'deny',
      reason: 'not-entitled',
    });
    expect(row.decision).toBe('deny');
    expect(row.reason).toBe('not-entitled');
  });

  it('uses kind:id so one prefix finds every read by a party kind', () => {
    // "Show me everything any lender looked at" must be one query, not a join.
    const a = portalAudit({
      party: { kind: 'lender', id: 'unguka' }, portal: 'bank', subjectRef: 'X', decision: 'allow',
    });
    const b = portalAudit({
      party: { kind: 'lender', id: 'equity' }, portal: 'bank', subjectRef: 'Y', decision: 'allow',
    });
    expect(a.actorId.startsWith('lender:')).toBe(true);
    expect(b.actorId.startsWith('lender:')).toBe(true);
  });
});
