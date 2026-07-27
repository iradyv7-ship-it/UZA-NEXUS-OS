/**
 * Commercial policy. Every number a founder should be able to change without a
 * developer lives here. Modules must read these constants, never inline them.
 */

// ---------- payment ----------
export type InstallmentTrigger = 'confirmation' | 'pre_loading' | 'pre_release';
export type ClientTier = 'new' | 'established';

export const PAYMENT_SCHEDULES: Record<ClientTier, ReadonlyArray<readonly [InstallmentTrigger, number]>> = {
  new:         [['confirmation', 0.50], ['pre_loading', 0.50]],
  established: [['confirmation', 0.30], ['pre_loading', 0.40], ['pre_release', 0.30]],
};

export const MIN_DEPOSIT = 0.30;
export const ESTABLISHED_AFTER_ORDERS = 3;

export const scheduleFor = (completedOrders: number) => {
  const tier: ClientTier = completedOrders >= ESTABLISHED_AFTER_ORDERS ? 'established' : 'new';
  return { tier, schedule: PAYMENT_SCHEDULES[tier] };
};

// ---------- volumetrics ----------
export const CBM_TOLERANCE = 0.05;   // declared vs measured, normal factory drift
export const CBM_HARD_STOP = 0.10;   // beyond this, loading stops until a human decides
export const FREIGHT_CONTINGENCY = 0.09;
export const BILLING_CLAIM_THRESHOLD = 0.02; // billed over measured before we claim
/** Revenue-ton capacity of a container, for utilisation reporting only (never a gate).
 * Ties to the open founder decision on container utilisation (CLAUDE.md §7). */
export const CONTAINER_RT_CAPACITY = 28.0;

export type VarianceDecision = 'client_pays' | 'uza_absorbs' | 'reduce_qty';

// ---------- commission ----------
export const COMMISSION_RATE = 0.02;       // on confirmed orders (deposit verified)
export const LEAD_DECAY_RATE = 0.01;       // repeat orders, same client
export const LEAD_OWNERSHIP_MONTHS = 12;
export const CLAIMS_WINDOW_DAYS = 14;

// ---------- quotation pricing ----------
/**
 * The negotiation floor and walk-away ceiling, derived from the supplier unit cost.
 * TARGET is the price a negotiator aims for; below WALKAWAY UZA declines the deal.
 * Founder-tunable commercial policy — never inline these in a pricing routine.
 */
export const TARGET_PRICE_FACTOR = 0.92;   // negotiation floor vs supplier unit cost
export const WALKAWAY_FACTOR = 1.05;       // walk-away ceiling vs supplier unit cost

// ---------- quality: inspection grading ----------
/**
 * How an inspection's defect counts grade into a result. A critical defect always fails
 * and blocks release (no override); more than the major threshold is only conditional.
 * Founder-tunable quality policy — quality grades against it, the release gate and the
 * web inspection screen read the same boundary.
 */
export const INSPECTION_THRESHOLDS = {
  /** critical > this ⇒ fail. A critical defect always fails, no override. */
  CRITICAL_FAIL_AT: 0,
  /** major > this ⇒ conditional (when not already failing on a critical). */
  MAJOR_CONDITIONAL_AT: 2,
} as const;

/**
 * The single definition of the grading rule, so a publisher and the release gate never
 * re-derive "> 2 major = conditional" and drift. Return type mirrors Inspection.result.
 */
export const gradeInspection = (
  critical: number,
  major: number,
): 'pass' | 'conditional' | 'fail' => {
  if (critical > INSPECTION_THRESHOLDS.CRITICAL_FAIL_AT) return 'fail';
  if (major > INSPECTION_THRESHOLDS.MAJOR_CONDITIONAL_AT) return 'conditional';
  return 'pass';
};

// ---------- sourcing: supplier score ----------
/**
 * How hard a factory's score is lowered for declared-vs-measured volumetric variance:
 *   delta = -min(abs(variance) * VARIANCE_MULTIPLIER, VARIANCE_CAP)
 * applied only when the receipt flagged a discrepancy. Founder-tunable — finance and
 * supplier analytics read the resulting score series; warehouse produces the variance.
 */
export const SUPPLIER_SCORE = {
  VARIANCE_MULTIPLIER: 10,   // score points per unit of |variance|
  VARIANCE_CAP: 2.0,         // max single-event penalty
} as const;

// ---------- cost ladder ----------
export const INCOTERMS = ['EXW', 'FOB', 'CIF', 'DAP'] as const;
export type Incoterm = (typeof INCOTERMS)[number];

/** Each rung accumulates into the incoterm it is listed against. */
export const LADDER: ReadonlyArray<readonly [CostRung, Incoterm]> = [
  ['exw', 'EXW'],
  ['inlandCn', 'FOB'], ['exportDocs', 'FOB'], ['originThc', 'FOB'],
  ['ocean', 'CIF'], ['insurance', 'CIF'],
  ['destCharges', 'DAP'], ['dutyVat', 'DAP'], ['inlandDest', 'DAP'],
];

export type CostRung =
  | 'exw' | 'inlandCn' | 'exportDocs' | 'originThc'
  | 'ocean' | 'insurance' | 'destCharges' | 'dutyVat' | 'inlandDest';

/**
 * Split a total into installments whose parts sum EXACTLY to the total.
 *
 * Naive rounding of 30/40/30 leaves cents unaccounted for, and the last
 * installment then never marks itself paid. The remainder goes to the final
 * installment deliberately.
 */
export const splitInstallments = (
  totalMinor: number,
  schedule: ReadonlyArray<readonly [InstallmentTrigger, number]>,
): ReadonlyArray<{ trigger: InstallmentTrigger; pct: number; amountMinor: number }> => {
  const parts = schedule.map(([trigger, p]) => ({
    trigger, pct: p, amountMinor: Math.floor(totalMinor * p),
  }));
  const allocated = parts.reduce((a, p) => a + p.amountMinor, 0);
  const last = parts[parts.length - 1];
  if (last) last.amountMinor += totalMinor - allocated;
  return parts;
};
