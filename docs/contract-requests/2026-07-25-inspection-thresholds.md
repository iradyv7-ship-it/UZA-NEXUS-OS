Module:     sourcing-quality
Need:       An inspection's result is graded from its defect counts by two thresholds
            that come straight from the reference oracle (`record_inspection`):
                critical > 0 ⇒ fail (blocks release, no override)
                major    > 2 ⇒ conditional
                else          ⇒ pass
            These are founder-tunable quality-policy numbers (how many major defects are
            tolerable before a shipment is only conditionally acceptable), and per
            CLAUDE.md §3 / integration-contract §6.2 every such number must live in
            `policy.ts`, never inline in module code. `policy.ts` today has no inspection
            thresholds.
Shared?     Yes — quality grades against them, but logistics/warehouse reads the same
            grade at the release gate, and the web inspection screen renders the
            pass/conditional/fail boundary for François. A second module re-deriving
            "> 2 major = conditional" is exactly the drift this kernel prevents.
Proposed:   Add to `packages/contracts/src/policy.ts`:
                export const INSPECTION_THRESHOLDS = {
                  /** critical > this ⇒ fail. A critical defect always fails, no override. */
                  CRITICAL_FAIL_AT: 0,
                  /** major > this ⇒ conditional (when not already failing on a critical). */
                  MAJOR_CONDITIONAL_AT: 2,
                } as const;
            Optionally a helper `gradeInspection(critical, major): 'pass'|'conditional'|'fail'`
            colocated with it, so the grading rule is defined once.
Breaking?   No, additive — one new exported constant (+ optional helper). No signature or
            type change; `Inspection.result` already exists in types.ts.
Blocked?    No. I proceed now against the current contract using a clearly-named local
            constant `INSPECTION_THRESHOLDS` + `gradeInspection` in
            `apps/api/src/quality/thresholds.ts`, marked
            `// TODO: pending contract-request 2026-07-25-inspection-thresholds`. When the
            constant lands in policy.ts the local copy is deleted and the import
            re-pointed; no behavioural change.
