/**
 * Supplier-score policy — LOCAL, pending a contract-request.
 *
 * The reference lowers a supplier's score on declared-vs-measured volumetric variance:
 *   delta = -min(abs(variance) * SCORE_VARIANCE_MULTIPLIER, SCORE_VARIANCE_CAP)
 * applied only when the receipt reported a discrepancy (abs(variance) > CBM_TOLERANCE).
 *
 * These constants are not in @uza/contracts/policy.ts. Per integration-contract §6.2
 * (policy numbers belong in policy.ts, not inlined), a contract-request has been filed to
 * move them there:
 *   docs/contract-requests/2026-07-25-supplier-scoring-and-ids.md
 * Until it lands we read them from here, in one place, marked below.
 */

// TODO: pending contract-request 2026-07-25-supplier-scoring-and-ids — move to policy.ts.
export const SCORE_VARIANCE_MULTIPLIER = 10;
export const SCORE_VARIANCE_CAP = 2.0;

/** Machine-readable cause tags for SupplierScoreEvent. Every score move carries one. */
export const SCORE_CAUSE = {
  declaredVsMeasuredVariance: 'declared_vs_measured_variance',
  defectRate: 'defect_rate',
  deliveryLateness: 'delivery_lateness',
  packagingFailure: 'packaging_failure',
} as const;

export type ScoreCause = (typeof SCORE_CAUSE)[keyof typeof SCORE_CAUSE];

/**
 * The variance penalty. Pure function so it is trivially testable and the same rule is
 * used by the handler and any future backfill. Returns a NEGATIVE delta (a penalty) or 0.
 */
export const varianceScoreDelta = (variance: number): number => {
  const magnitude = Math.min(Math.abs(variance) * SCORE_VARIANCE_MULTIPLIER, SCORE_VARIANCE_CAP);
  return Math.round(-magnitude * 100) / 100;
};
