/**
 * The portal kernel — one access pattern, used by every external-facing portal.
 *
 * UZA is building four portals, and they look like four different problems until you write
 * the second one:
 *
 *   the CLIENT portal    a person sees their own file
 *   the BANK portal      a lender sees its own consented borrowers
 *   the GARAGE portal    a mechanic sees the jobs assigned to them
 *   the TRAINING portal  a trainer sees their cohort; a candidate sees themselves
 *
 * Every one is the same sentence: **an outside party, authenticated, sees a scoped subset
 * of records about people, and every look is recorded.** What differs between them is only
 * WHY the party is entitled — a loan, being the person, a job card, a cohort.
 *
 * So the policy lives here, once, and each portal supplies its own entitlement lookup.
 * This is deliberately NOT a generic permission framework: it does one job, it is about a
 * hundred lines, and you can read all of it before using it.
 *
 * ── THE FOUR RULES, AND WHY EACH EXISTS ───────────────────────────────────────────────
 *
 * 1. ENTITLEMENT — the party has a real link to this subject. Without it, a portal is an
 *    enumeration tool: try IDs until one answers.
 *
 * 2. CONSENT — required when the party is NOT the subject. Under Law N° 058/2021 consent
 *    is specific: agreeing that Unguka may see a file is not agreeing that Equity may.
 *    A person looking at their own record needs no consent to themselves, which is why
 *    `selfService` exists.
 *
 * 3. ONE REFUSAL — every denial returns the same message whichever rule failed. If "not
 *    your borrower" were distinguishable from "no such person", the portal would become a
 *    way to test whether a given national ID belongs to a UZA client. That is a disclosure
 *    even when the answer is no. The real reason goes to the audit log.
 *
 * 4. AUDIT BOTH WAYS — allowed reads AND refusals. A refusal is often the interesting one:
 *    a party repeatedly asking about subjects that are not theirs is worth a human noticing.
 *
 * ── ADDING A PORTAL ───────────────────────────────────────────────────────────────────
 *
 * See `docs/PORTALS.md`. In short: define the party kind, write the entitlement lookup,
 * define the projection, call `decideAccess`, and audit through `portalAudit`.
 */

/** Who is asking. `kind` groups them; `id` identifies the individual party. */
export interface PortalParty {
  /** 'lender' | 'client' | 'garage' | 'trainer' — extend as portals are added. */
  kind: string;
  /** The lender key, the person's UZA ID, the garage ref — whatever identifies them. */
  id: string;
}

export interface EntitlementFacts {
  /** Does the subject record exist at all? */
  subjectExists: boolean;
  /** Is this party linked to this subject — a loan, a job, a cohort, being them? */
  entitled: boolean;
  /**
   * True when the party IS the subject. Consent is then not required: a person does not
   * consent to themselves, and demanding it would lock people out of their own records.
   */
  selfService?: boolean;
  consentGivenAt?: Date | null;
  consentWithdrawnAt?: Date | null;
}

export type RefusalReason = 'no-such-subject' | 'not-entitled' | 'no-consent' | 'consent-withdrawn';

export type AccessDecision = { allowed: true } | { allowed: false; reason: RefusalReason };

/**
 * The single message every portal returns on refusal, whatever the reason.
 *
 * Exported so tests can assert that two different refusals are byte-identical, and so no
 * portal quietly invents a more "helpful" message that leaks which rule failed.
 */
export const PORTAL_REFUSAL = 'No record available for that reference.';

/**
 * Apply the four rules. Order matters only for what lands in the audit log — the caller
 * must return the same refusal either way.
 */
export function decideAccess(facts: EntitlementFacts): AccessDecision {
  if (!facts.subjectExists) return { allowed: false, reason: 'no-such-subject' };
  if (!facts.entitled) return { allowed: false, reason: 'not-entitled' };
  if (facts.selfService) return { allowed: true };
  if (!facts.consentGivenAt) return { allowed: false, reason: 'no-consent' };
  if (facts.consentWithdrawnAt) return { allowed: false, reason: 'consent-withdrawn' };
  return { allowed: true };
}

/**
 * Remove fields this party may not see.
 *
 * Written as delete-from-a-copy rather than build-up-a-copy, deliberately. Building up
 * silently drops any field added to the type later — safe for disclosure, but the portal
 * quietly loses data and nobody notices for months. Deleting fails the other way, so each
 * sensitive field is removed explicitly and named in a test.
 *
 * `redact` never mutates its input: one record is often shaped for two parties in one
 * request, and mutation would make the second depend on the first.
 */
export function redact<T extends object, K extends keyof T>(record: T, drop: readonly K[]): T {
  const out = { ...record };
  for (const key of drop) delete out[key];
  return out;
}

/** The audit row shape every portal writes, so one query answers "who saw what". */
export function portalAudit(input: {
  party: PortalParty;
  portal: string;
  subjectRef: string;
  decision: 'allow' | 'deny';
  reason?: RefusalReason;
}): {
  actorId: string;
  actorRole: string;
  resource: string;
  action: string;
  decision: 'allow' | 'deny';
  reason?: string;
  targetRef: string;
} {
  return {
    // `kind:id` so one prefix query finds every read by a party kind, and an exact match
    // finds every read by one party.
    actorId: `${input.party.kind}:${input.party.id}`,
    // An external party is not a UZA employee and must not be given an employee Role.
    // AuditLog.actorRole is a free string precisely so the log can say what really happened.
    actorRole: input.party.kind,
    resource: `portal:${input.portal}`,
    action: 'read',
    decision: input.decision,
    ...(input.reason && { reason: input.reason }),
    targetRef: input.subjectRef,
  };
}
