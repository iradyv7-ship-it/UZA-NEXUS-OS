Module:     trade-flow
Need:       Quotation target price and walkaway price are derived from the supplier
            unit cost by two hardcoded factors in the reference oracle
            (`target_price = unit_cost * 0.92`, `walkaway = unit_cost * 1.05`). These
            are commercial policy numbers — the floor a negotiator may drop to and the
            point past which UZA walks — and per CLAUDE.md §3 every founder-tunable
            number must live in `policy.ts`, never inline in module code.
Shared?     Yes — finance reads target/walkaway alongside quoted vs realized margin
            when analysing the per-client / per-supplier margin gap, and the web
            quotation screen renders them for authorised roles. A second module
            re-deriving these factors is exactly the drift this kernel prevents.
Proposed:   Add to `packages/contracts/src/policy.ts`:
                export const TARGET_PRICE_FACTOR = 0.92;   // negotiation floor vs unit cost
                export const WALKAWAY_FACTOR     = 1.05;   // walk-away ceiling vs unit cost
            trade-flow's quotation builder would read these instead of local consts.
Breaking?   No, additive — two new exported constants, no signature or type change.
Blocked?    No. I proceed now against the current contract using clearly-named local
            constants `TARGET_PRICE_FACTOR` / `WALKAWAY_FACTOR` in
            `apps/api/src/trade/quotation/pricing.ts`, each marked
            `// TODO: pending contract-request 2026-07-25-trade-price-factors`. When the
            constants land in policy.ts the local copies are deleted and the import
            re-pointed; no behavioural change.
