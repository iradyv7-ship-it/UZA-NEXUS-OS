Status:     PROPOSED — awaiting contracts-guardian.
Module:     sourcing-quality
Need:       Three smaller, additive gaps surfaced building the supplier-offer/deal
            two-stage-payment feature (founder request, 2026-09-14). Bundled in one
            request per the precedent in
            docs/contract-requests/2026-07-25-supplier-scoring-and-ids.md.

            (1) ID PATTERNS. `ID_PATTERNS` (ids.ts) has no `supplierOffer`/`supplierDeal`
                keys. Rendered locally in apps/api/src/sourcing/sourcing-ids.ts
                (`OFF-CN-{year}-{seq:4}`, `DEAL-CN-{year}-{seq:4}`) pending this.

            (2) BOOKING-FEE POLICY CONSTANT. The founder's real-world figure is ~5,000 RMB
                per vehicle to reserve a unit (SupplierDealService.reserve computes
                `bookingFeeMinor = qty * BOOKING_FEE_PER_UNIT`). This is exactly the kind
                of founder-tunable commercial number CLAUDE.md §3 says belongs in
                `policy.ts`, never inline — currently local in
                apps/api/src/sourcing/deal-policy.ts, marked
                `// TODO: pending contract-request 2026-09-14-supplier-deal-ids-policy-and-masking`.

                OPEN QUESTION, not resolved by this request: `@uza/contracts` `Minor`
                (money.ts) carries NO currency dimension — every `*Minor` field elsewhere
                in this codebase (SupplierQuote.unitCostMinor, PurchaseOrder.poTotalMinor,
                the whole CostLadder) is treated as one implicit currency throughout the
                app. The booking fee is genuinely RMB-denominated; storing it as a bare
                Minor alongside (presumably USD) PO totals is a currency-consistency gap
                this request does NOT resolve, because there is no currency concept
                anywhere in @uza/contracts to resolve it against. Flagging for a founder/
                contracts-guardian decision — either (a) accept that this codebase treats
                all Minor amounts as one implicit currency and the booking fee is
                approximated in that unit, or (b) add a currency dimension to Minor (a
                bigger, precedent-setting change well beyond this request's scope).

            (3) CONFIDENTIAL_FIELDS. `bookingFeeMinor`/`balanceMinor` (SupplierDeal) have
                no masking entry. `supplierUnitCost`/`poTotal` already mask correctly
                (deal.unitCostMinor/totalMinor are projected onto those existing keys in
                SupplierDealService.read), but the booking fee and balance have no
                existing analog key. Until this lands, a role holding `po:read` without
                being on the `poTotal` allow-list (today: only `china_warehouse` is in
                that gap — it holds `po:read` but not the `supplierUnitCost`/`poTotal`
                allow-list) sees these two fields UNMASKED. This is called out explicitly
                in SupplierDealService.read's own comment, not hidden.
Shared?     Yes for all three, same reasoning as the 2026-07-25 precedent: (1) every
            module referencing an offer/deal by ref must agree on its shape; (2) finance
            and any supplier-analytics view would read the same booking-fee figure; (3) a
            masking gap is exactly the CLAUDE.md rule 12 concern ("confidential fields are
            masked on read, not filtered in the UI").
Proposed:   In `packages/contracts/src/ids.ts` ID_PATTERNS, add:
                supplierOffer: 'OFF-{country}-{year}-{seq:4}',
                supplierDeal:  'DEAL-{country}-{year}-{seq:4}',
            In `packages/contracts/src/policy.ts`, a new section "sourcing: supplier deal
            deposit":
                export const BOOKING_FEE_PER_UNIT_MINOR = 500_000; // 5,000 major units/vehicle
            (pending the currency-dimension decision above — the constant's UNIT is what's
            genuinely open, not its existence).
            In `packages/contracts/src/permissions.ts` CONFIDENTIAL_FIELDS, add:
                bookingFeeMinor: ['ceo', 'china_sourcing', 'venture_manager', 'finance'],
                balanceMinor:    ['ceo', 'china_sourcing', 'venture_manager', 'finance'],
            (same allow-list as `supplierUnitCost`/`poTotal` — china_warehouse and
            everyone else stays masked).
Additional observation (not part of this request, flagging only): `finance` already holds
            `po:approve` but NOT `po:read` (nor `po:*`) in the current ROLE_GRANTS — a
            pre-existing shape I inherited by reusing the `po` resource for
            `SupplierDealService`. Today this means finance can approve a booking-fee or
            balance payment via `po:approve` without being able to call
            `SupplierDealService.read`/`PurchaseOrderService.read` to see what it is
            approving. This predates this request (I did not introduce it) and I am not
            authorised to add `po:read` to finance myself — flagging in case the founder
            wants that gap closed; it would be a one-line, additive ROLE_GRANTS change.
Breaking?   No, additive on all three. No existing key, constant, or masking entry changes.
Blocked?    No. Proceeding now against the current contract:
            - refs: rendered locally in `apps/api/src/sourcing/sourcing-ids.ts`
              (`supplierOfferRef`/`supplierDealRef`), same pattern `supplier`/`rfq`/
              `supplierQuote` used before their own ID_PATTERNS entries were accepted.
            - booking fee: `BOOKING_FEE_PER_UNIT_MINOR` in
              `apps/api/src/sourcing/deal-policy.ts`, marked
              `// TODO: pending contract-request`.
            - masking: `SupplierDealService.read` masks what it can via the existing
              `supplierUnitCost`/`poTotal` keys and documents the `bookingFeeMinor`/
              `balanceMinor` gap in its own comment rather than papering over it with
              ad-hoc local masking logic (which would duplicate `maskFields` and drift,
              exactly what CLAUDE.md §3 / integration-contract §6 forbid).
