import { SUPPLIER_SCORE } from '@uza/contracts';

/**
 * Supplier-score policy. The variance multiplier and cap now live in @uza/contracts
 * (policy.ts, SUPPLIER_SCORE), accepted from
 * docs/contract-requests/2026-07-25-supplier-scoring-and-ids.md. The reference lowers a
 * supplier's score on declared-vs-measured volumetric variance:
 *   delta = -min(abs(variance) * VARIANCE_MULTIPLIER, VARIANCE_CAP)
 * applied only when the receipt reported a discrepancy (abs(variance) > CBM_TOLERANCE).
 */

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
  const magnitude = Math.min(
    Math.abs(variance) * SUPPLIER_SCORE.VARIANCE_MULTIPLIER,
    SUPPLIER_SCORE.VARIANCE_CAP,
  );
  return Math.round(-magnitude * 100) / 100;
};
