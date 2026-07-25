import type { InspectionResult } from './inspection/inspection.types';

/**
 * Inspection thresholds — LOCAL, pending a contract-request.
 *
 * The rule (from the reference oracle): a critical defect fails outright; more than two
 * major defects is conditional; otherwise pass.
 *   critical > CRITICAL_FAIL_AT (0)  ⇒ fail
 *   major    > MAJOR_CONDITIONAL_AT (2) ⇒ conditional
 *   else                              ⇒ pass
 *
 * These thresholds are NOT in @uza/contracts/policy.ts. Per integration-contract §6.2
 * (policy numbers belong in policy.ts, not inlined), a contract-request has been filed:
 *   docs/contract-requests/2026-07-25-inspection-thresholds.md
 * proposing an `INSPECTION_THRESHOLDS` export. Until it lands we read from here, in one
 * place, and grade against it.
 */

// TODO: pending contract-request 2026-07-25-inspection-thresholds — move to policy.ts.
export const INSPECTION_THRESHOLDS = {
  /** critical > this ⇒ fail. */
  CRITICAL_FAIL_AT: 0,
  /** major > this ⇒ conditional (when not already failing on a critical). */
  MAJOR_CONDITIONAL_AT: 2,
} as const;

/**
 * Grade an inspection. A critical defect ALWAYS fails and blocks release — there is no
 * override path. This is the single place the result is derived; callers never pass a
 * result in.
 */
export const gradeInspection = (critical: number, major: number): InspectionResult => {
  if (critical > INSPECTION_THRESHOLDS.CRITICAL_FAIL_AT) return 'fail';
  if (major > INSPECTION_THRESHOLDS.MAJOR_CONDITIONAL_AT) return 'conditional';
  return 'pass';
};
