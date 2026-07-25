/**
 * Inspection grading now lives in @uza/contracts (policy.ts), accepted from
 * docs/contract-requests/2026-07-25-inspection-thresholds.md. This module is a thin
 * re-export so the quality module (and the Sprint 3 release gate) grade against the one
 * shared definition — critical > 0 ⇒ fail, major > 2 ⇒ conditional — and never re-derive it.
 */
export { gradeInspection, INSPECTION_THRESHOLDS } from '@uza/contracts';
