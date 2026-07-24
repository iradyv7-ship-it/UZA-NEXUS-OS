# Contract Review 001 — pre-Sprint-0 audit

Reviewer: contracts-guardian
Scope: `packages/contracts` against `tests/conformance/SPEC.md`
Verdict: **six gaps found and closed.** Contracts are ready for Sprint 0.

## Critical — would have caused module drift

**1. Cost ladder arithmetic was not shared.** `trade-flow` computes margin at
quotation, `finance-commission` recomputes realized margin from the same ladder.
With no shared implementation the two would have diverged on a rounding rule
within weeks, and nobody could say which P&L was correct.
→ Added `ladder.ts`: `ladderAt`, `marginAt`, `dapMargin`, `hasAllActuals`.

**2. No error taxonomy.** The three booking gates and the release gate are the
product. Each module would have thrown its own ad-hoc string, and the web app
could not have rendered them consistently, let alone in four languages.
→ Added `errors.ts`: `UzaError` with a shared code, a next action, and the
responsible role. A gate failure now tells a user what to do and who does it.

**3. Installment rounding could strand cents.** 30/40/30 of an awkward total
leaves a remainder, so the final installment would never mark itself paid and
goods would never release.
→ Added `splitInstallments`, which guarantees the parts sum exactly to the total.
Test included with $1,844.31, which does not divide cleanly.

## Significant — missing shared records

**4.** No `Supplier`, `SupplierQuote`, `PurchaseOrder`, `Inspection`, `Capa`.
`sourcing-quality` would have declared its own; `finance` needs `supplierRef`
and score to reconcile. → Added, including `inlandSeparable` on supplier quotes,
without which EXW and FOB quotes cannot be compared honestly.

**5.** No `VarianceReport`, `TrackingEvent`, `FreightClaim`. Warehouse produces
the variance, finance decides who pays it — a cross-module record by definition.
→ Added.

**6.** No `Invoice`, `Payment`, `Delivery`, `Notification`, `NotificationAudience`.
CF-023 requires fan-out to five distinct audiences; with no shared audience type
each module would have invented its own recipient list. → Added.

## Accepted as-is

- `ID_PATTERNS` is data, not a generator. Generation belongs to platform-core
  behind a sequence table; the patterns stay canonical here.
- `Minor` branded type is sufficient; no currency dimension yet. Multi-currency
  is a real future need but not v1 (USD purchasing, USD/RWF selling). Flagged.

## Verification

```
npx tsc --noEmit                                                    → clean
node --experimental-strip-types tests/conformance/contracts.test.ts → 13 pass, 0 fail
cd reference && python3 run_scenarios.py                            → 30 pass, 0 fail
```

## Founder dependency unchanged

The sell-incoterm decision is still open. `trade-flow` will bake it into every
quotation, so it should be settled before Sprint 1, not before Sprint 0.
