/**
 * Supplier-deal policy: the two-stage payment (booking fee / balance) on a confirmed
 * supplier deal. NOT in @uza/contracts policy.ts yet — filed as
 * the supplier deal ids policy and masking contract request (2026-09-14).
 * `// TODO: pending contract-request 2026-09-14-supplier-deal-ids-policy-and-masking`.
 *
 * The founder's real-world figure is ~5,000 RMB per vehicle to reserve a unit. @uza/contracts
 * `Minor` (backend/contracts/src/money.ts) carries NO currency dimension — every other
 * *Minor field in this codebase (SupplierQuote.unitCostMinor, PurchaseOrder.poTotalMinor,
 * the whole CostLadder) is treated as one implicit currency throughout the app. This booking
 * fee is a genuinely RMB-denominated figure; storing it as a bare Minor alongside
 * USD-denominated PO totals is a currency-consistency gap this module does NOT resolve (no
 * FX/currency concept exists anywhere in @uza/contracts to resolve it against) — flagged in
 * the contract-request, not silently assumed away.
 */
export const BOOKING_FEE_PER_UNIT_MINOR = 500_000; // 5,000 (major units) per vehicle, per-unit
