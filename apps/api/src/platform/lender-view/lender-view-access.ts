/**
 * What a lender is allowed to see about a borrower.
 *
 * This file is the enforcement point for a standing instruction that until now existed
 * only in prose, and prose enforces nothing:
 *
 *   > The cash-collateral facility is for LOLC Unguka only. It must never appear — in
 *   > text, UI, export, notification, deck or email — in anything shown to Jali Finance,
 *   > Equity Bank Rwanda, NCBA Rwanda or any other lender, unless explicitly authorised
 *   > for that lender.
 *
 * A rule like that survives exactly as long as everyone who builds a screen remembers it.
 * `redactForLender` is the version that does not depend on remembering: every lender-facing
 * payload goes through it, and the collateral block is removed for anybody not on the
 * entitlement list — by construction, not by review.
 *
 * The same shape covers the other disclosure rules, which are all one idea: a lender is
 * entitled to a view of ITS OWN borrower, and to nothing else. Not the book, not another
 * lender's borrowers, and not the fact that another lender exists.
 */

/**
 * Lenders entitled to see the credit-enhancement (cash-collateral) position.
 *
 * Deliberately a list of one. Adding to it is a commercial decision that belongs to the
 * founder, and it should require this file to change, a test to change, and a review —
 * which is exactly the amount of friction the rule deserves.
 *
 * Matched case-insensitively against the lender key, after trimming.
 */
export const COLLATERAL_ENTITLED: readonly string[] = ['unguka'];

/** Everything a lender can be shown, before any redaction. */
export interface LenderFacingFile {
  uzaId: string;
  displayName: string;

  /** Completed training, because it is what makes an unbankable applicant assessable. */
  training?: {
    programme: string;
    completedAt: string | null;
    assessmentPassed: boolean | null;
  };

  /**
   * Money moving, split by what the client instructed it to be for.
   *
   * `reserveStatus` and `arrearsStatus` are SEPARATE and must never be merged into one
   * "is he paying" field. A client who is behind on a daily reserve is NOT in arrears: the
   * obligation is the monthly instalment, and the daily reserve is a tool that helps him
   * meet it. Collapsing the two would let a lender treat a smoothing aid as a default,
   * which would make the tool actively dangerous to the person using it.
   */
  wallet?: {
    /** Allocation totals over the window, by purpose. Loan, charging, maintenance, saving… */
    allocations: Record<string, number>;
    windowStart: string;
    windowEnd: string;
    /** Ahead / on-track / behind on the DAILY reserve. Not a credit status. */
    reserveStatus: 'ahead' | 'on_track' | 'behind' | 'unknown';
    /** The actual credit status: has a due instalment been missed. */
    arrearsStatus: 'current' | 'late' | 'unknown';
  };

  /** Condition of the financed asset, from the garage job card. */
  inspections?: {
    performedAt: string;
    outcome: string;
    batteryStateOfHealthPct: number | null;
  }[];

  /** Days the vehicle actually worked. The utilisation feed. */
  utilisation?: {
    windowStart: string;
    windowEnd: string;
    productiveDays: number;
    windowDays: number;
  };

  /**
   * The cash-collateral position. Present ONLY for an entitled lender. Everything about
   * this field is load-bearing: see COLLATERAL_ENTITLED above.
   */
  creditEnhancement?: {
    facility: string;
    depositedRwf: number;
    releasedRwf: number;
    callableRwf: number;
  };
}

export interface DisclosureDecision {
  allowed: boolean;
  /** Present when refused. Safe to log; never contains personal data. */
  reason?:
    | 'no-such-person'
    | 'not-this-lenders-borrower'
    | 'no-consent'
    | 'consent-withdrawn';
}

export const normaliseLender = (lender: string): string => lender.trim().toLowerCase();

/** Is this lender entitled to see the cash-collateral position at all? */
export function maySeeCollateral(lender: string): boolean {
  return COLLATERAL_ENTITLED.includes(normaliseLender(lender));
}

/**
 * Strip everything this lender may not see.
 *
 * Written as a REMOVE-from-a-copy rather than a build-up-a-copy on purpose. A build-up
 * function silently drops any field added to the interface later, which fails safe for
 * disclosure but produces a lender view that quietly loses data nobody notices. A remove
 * function fails the other way — a new field is visible until someone decides otherwise —
 * so the one field where that would be unacceptable is deleted explicitly and covered by a
 * test that names it.
 */
export function redactForLender(file: LenderFacingFile, lender: string): LenderFacingFile {
  const out: LenderFacingFile = { ...file };
  if (!maySeeCollateral(lender)) {
    delete out.creditEnhancement;
  }
  return out;
}

/**
 * Whether this lender may be shown this borrower at all.
 *
 * Two independent gates, and both must pass:
 *
 *  1. **Entitlement** — the lender has a loan file with this person. A lender is never
 *     shown somebody else's borrower, and cannot enumerate the book by trying UZA IDs.
 *  2. **Consent** — the person agreed to disclosure TO THIS LENDER, and has not withdrawn
 *     it. Under Law N° 058/2021 consent is specific: agreeing that Unguka may see a file
 *     is not agreement that Equity may.
 *
 * A refusal returns the same shape whichever gate failed, so the caller cannot use the
 * error to learn whether a person exists. That matters: "not this lender's borrower" and
 * "no such person" must be indistinguishable from outside, or the endpoint becomes a way
 * to test whether a given national ID is a UZA client.
 */
export function mayDisclose(input: {
  personExists: boolean;
  isBorrowerOfThisLender: boolean;
  consentGivenAt: Date | null;
  consentWithdrawnAt: Date | null;
}): DisclosureDecision {
  if (!input.personExists) return { allowed: false, reason: 'no-such-person' };
  if (!input.isBorrowerOfThisLender) {
    return { allowed: false, reason: 'not-this-lenders-borrower' };
  }
  if (!input.consentGivenAt) return { allowed: false, reason: 'no-consent' };
  if (input.consentWithdrawnAt) return { allowed: false, reason: 'consent-withdrawn' };
  return { allowed: true };
}
