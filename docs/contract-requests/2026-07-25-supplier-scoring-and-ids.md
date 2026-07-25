Status:     ACCEPTED (shared) — contracts-guardian, 2026-07-25.
            (1) Added `SUPPLIER_SCORE` (VARIANCE_MULTIPLIER 10, VARIANCE_CAP 2.0) to
                packages/contracts/src/policy.ts (section "sourcing: supplier score").
            (2) Added `supplier` (SUP-{country}-{seq:4}), `rfq` (RFQ-{year}-{seq:4}) and
                `supplierQuote` (SQ-{seq:4}) keys to ID_PATTERNS in
                packages/contracts/src/ids.ts.
            Additive; no existing key or type changed. @uza/contracts typechecks clean.
            The cause-tag enum is NOT added this sprint (request marks it optional); revisit
            when a second score input is wired.
Rationale:  (1) Founder-tunable — how hard a factory is punished for volume misdeclaration;
            finance/analytics read the score series, warehouse produces the variance.
            (2) Readable IDs are definitionally shared (CF-001); every module referencing a
            supplier/quote by ref must agree on shape.
Migration:  Modules that must now import instead of rendering locally —
            - sourcing: apps/api/src/sourcing/scoring.ts — replace local
              SCORE_VARIANCE_MULTIPLIER / SCORE_VARIANCE_CAP with SUPPLIER_SCORE.* from
              @uza/contracts; drop the `// TODO: pending contract-request` marker.
              varianceScoreDelta keeps its logic, just reads the shared constants.
            - sourcing: apps/api/src/sourcing/sourcing-ids.ts — delete the local
              supplierRef / rfqRef / supplierQuoteRef renderers and route through
              formatId('supplier'|'rfq'|'supplierQuote', parts); update callers in
              supplier.service.ts and rfq.service.ts. Rendered refs are unchanged.
            No SCORE_CAUSE change: cause tags stay local until the shared enum is filed.

Module:     sourcing-quality
Need:       Two gaps in @uza/contracts surfaced while building sourcing:

            (1) SUPPLIER SCORE CONSTANTS. The reference lowers a supplier's score on
                declared-vs-measured volumetric variance by
                    delta = -min(abs(variance) * 10, 2.0)
                applied only when the receipt flags a discrepancy. The multiplier (10)
                and the cap (2.0) are founder-tunable — how hard a factory is punished
                for lying about volume — and per CLAUDE.md §3 / integration-contract §6.2
                belong in `policy.ts`, not inline. `policy.ts` has no scoring constants.

            (2) ID PATTERNS. `ID_PATTERNS` in `ids.ts` has `po`, `visit`, `inspection`
                and `capa`, but NOT `supplier`, `rfq` or `supplierQuote`. The reference
                renders SUP-CN-{seq:4} and SQ-{seq:4}; there is no RFQ pattern at all.
                Without contract entries these three refs are formatted locally, which is
                the single-source drift the kernel exists to prevent (CF-001).
Shared?     Yes.
            (1) Finance and any supplier-analytics view read the same score series;
                warehouse produces the variance that drives it. A second module
                re-deriving the penalty formula would diverge silently.
            (2) Every module that references a supplier/quote by its readable id (web,
                finance, warehouse) must agree on its shape.
Proposed:   In `packages/contracts/src/policy.ts`:
                export const SUPPLIER_SCORE = {
                  VARIANCE_MULTIPLIER: 10,     // score points per unit of |variance|
                  VARIANCE_CAP: 2.0,           // max single-event penalty
                } as const;
            In `packages/contracts/src/ids.ts` ID_PATTERNS, add:
                supplier:      'SUP-{country}-{seq:4}',
                rfq:           'RFQ-{year}-{seq:4}',
                supplierQuote: 'SQ-{seq:4}',
            (Cause tags for SupplierScoreEvent — declared_vs_measured_variance,
             defect_rate, delivery_lateness, packaging_failure — could also move to a
             shared enum once more score inputs land; not required this sprint.)
Breaking?   No, additive. New constants and new ID_PATTERNS keys; no existing key or
            type changes.
Blocked?    No. I proceed now against the current contract:
            - score constants + cause tags: `apps/api/src/sourcing/scoring.ts`, marked
              `// TODO: pending contract-request 2026-07-25-supplier-scoring-and-ids`.
            - supplier/rfq/quote refs: rendered locally in
              `apps/api/src/sourcing/sourcing-ids.ts` (po/visit/inspection/capa already
              go through the shared platform formatter). When the entries land the local
              renderers are deleted and re-pointed at formatId; refs are unchanged.
