# Handoff — finance-commission (Sprint 2)

Written for an agent with no context. finance-commission is the money half of the
corridor: invoices, payment proof capture, Finance verification, installment settlement
signalling, the commission ledger with clawback, forwarder freight claims, petty cash,
and dual-approval supplier bank details. It builds on `docs/handoff/platform.md`
(authorisation, transactional outbox, notifications, readable IDs) and consumes trade's
`order.created` / `order.cancelled`. It consumes `@uza/contracts` for every shared type,
event, permission and policy number.

Branch: `sprint-2-finance-commission`. It does NOT edit `app.module.ts` — the CTO wires
`FinanceModule` at integration. Tests instantiate services directly (no DI container),
per the platform handoff.

---

## The core principle: money moves by ledger row, never by balance edit

A commission balance, a petty-cash balance and an invoice's paid state are all the
**signed sum of append-only rows**, never a mutated number. A commission dispute is
answered by pointing at rows (the accrual and the clawback both survive), not by a
corrected figure with no history. Money is integer **minor units** everywhere (`*Minor`).

## Services exposed (all authorise at the service layer)

| Service.method | resource:action | Who can call (per ROLE_GRANTS) |
|---|---|---|
| `InvoiceService.handleOrderCreated` | (event handler, not authorised) | subscriber only |
| `InvoiceService.read` | `invoice:read` (+scope) | finance, vm, customer(scoped), ceo |
| `InvoiceService.releaseEligibility` | `invoice:read` (+scope) | the CF-028 fully-paid gate logistics reads |
| `PaymentService.uploadProof` | `payment:create` (+scope) | customer(own invoice), finance, ceo |
| `PaymentService.verify` | `payment:approve` | **finance, ceo ONLY** |
| `PaymentService.reject` | `payment:approve` | finance, ceo |
| `PaymentService.read` | `payment:read` (+scope) | scoped |
| `CommissionService.handleOrderCancelled` | (event handler, not authorised) | subscriber only |
| `CommissionService.recordPayout` | `commission:payout` | finance, ceo |
| `CommissionService.balanceFor` / `ledgerFor` | `commission:read` (+scope) | finance, agent(own), ceo |
| `ForwarderClaimService.handleBilledWeightRecorded` | (event handler, not authorised) | subscriber only |
| `ForwarderClaimService.read` / `setStatus` | `claim:read` / `claim:update` | finance, ceo |
| `PettyCashService.record` / `balance` | `pettyCash:create` / `pettyCash:read` | front_office, ceo |
| `SupplierBankService.requestChange` / `approve` | `payment:approve` | finance, ceo (dual approval) |
| `SupplierBankService.readAccount` | `supplier:read` | china_sourcing, china_warehouse, vm, finance, ceo |

### Key behaviours

- **Only Finance verifies a payment.** `payment:approve` is held by finance and ceo only.
  A payment sits `pending_verification` until a finance-role human acts. The front
  office, a venture manager, a sales agent, the customer and AI are all denied — the
  denial is audited before the throw. Tested (CF-008).
- **Verification settles a NAMED installment, not an arbitrary amount.** A payment carries
  a `targetTrigger`; verification settles the matching still-due finance installment.
- **A short payment is REJECTED naming the shortfall** (`UzaError PAYMENT_SHORT`, context
  carries `expectedMinor`/`paidMinor`/`shortfallMinor`/`trigger`), never booked partial.
  Tested (CF-007).
- **`payment.verified` with trigger `confirmation` is what activates procurement** — and
  nothing else does. Finance publishes `payment.verified` for EVERY settled installment
  (so trade can mark each of its own installments paid), but only `confirmation` carries
  the deposit-floor check and commission accrual; trade activates on `confirmation` alone.
  Tested (CF-009).
- **Commission accrues 2% (`COMMISSION_RATE`) when the confirmation installment is
  verified** — not at order creation, not at delivery. One accrual row per order (guarded
  by `Invoice.commissionAccrued` and the unique `dedupeKey`); no agent ⇒ no commission.
  Tested (CF-010).
- **Clawback on cancellation reverses the accrual and leaves BOTH rows.** The clawback is
  a second, negative row; the accrual is never deleted or edited. Both the agent and
  Finance are notified. Tested (CF-030).
- **Goods release requires FULL payment.** `releaseEligibility(orderRef)` returns
  `{ fullyPaid, outstandingMinor, outstandingTriggers }` — the determination logistics'
  delivery step reads in Sprint 3. Tested (CF-028).
- **Forwarder over-billing raises a CLAIM, not a client conversation.** When billed
  revenue-ton exceeds measured beyond `BILLING_CLAIM_THRESHOLD` (2%), a `ForwarderClaim`
  is raised and Finance is notified. `ForwarderClaimService.assess()` is the single
  threshold rule. Tested (CF-020).
- **Supplier bank-detail changes require DUAL APPROVAL.** A change applies only after two
  DISTINCT finance approvers approve it; the requester may not self-approve, and one
  person cannot approve twice (unique `(requestRef, approverId)`). Tested.
- **Every event handler is idempotent on `eventId`** via `ProcessedEvent`
  (`finance.order-created`, `finance.order-cancelled`, `finance.billed-weight`) plus
  unique `sourceEventId`/`dedupeKey` columns as DB-level backstops.

## Events published (real example payloads)

All through the transactional outbox (`OutboxService.emit` / `enqueue`), committed in the
same transaction as the state change. Only events finance OWNS are emitted.

```jsonc
// payment.proofUploaded  — on uploadProof
{ "paymentRef": "PAY-2026-0001", "invoiceRef": "INV-BULK-2026-0001", "amountMinor": 308150 }

// payment.verified       — on every verified installment; trade activates on 'confirmation'
{ "paymentRef": "PAY-2026-0001", "orderRef": "ORD-BULK-2026-0001",
  "trigger": "confirmation", "paidFraction": 0.5 }

// commission.accrued     — 2% when the confirmation installment is verified
{ "agentId": "AGT-GOM-0021", "orderRef": "ORD-BULK-2026-0001", "amountMinor": 12326 }

// commission.clawedBack  — on order.cancelled, reverses the accrual
{ "agentId": "AGT-GOM-0021", "orderRef": "ORD-BULK-2026-0001", "amountMinor": 12326,
  "reason": "buyer defaulted" }
```

## Events consumed

- **`order.created`** (owned by trade). Handler: `InvoiceService.handleOrderCreated`.
  Creates the Invoice and the finance-side installment schedule, derived LOCALLY from the
  payload via `PAYMENT_SCHEDULES[tier]` + `splitInstallments` — the SAME policy trade
  applied — so payments are validated without reading trade's tables. No event published.
  Idempotent (consumer `finance.order-created`). Built + unit-tested against SYNTHETIC
  envelopes; wire to worker fan-out at integration.
- **`order.cancelled`** (owned by trade). Handler: `CommissionService.handleOrderCancelled`.
  Clawback. Idempotent (consumer `finance.order-cancelled`). Synthetic-tested.
- **`shipment.billedWeightRecorded`** (owned by logistics, Sprint 3). Handler:
  `ForwarderClaimService.handleBilledWeightRecorded`. Raises a claim on over-billing.
  Idempotent (consumer `finance.billed-weight`). Synthetic-tested (CF-020 mechanism).

## Prisma models added (migration `20260725215300_finance_commission_init`)

| Model | Notes |
|---|---|
| `Invoice` | one per order (`orderRef` unique); `totalMinor`/`tier` from the event; `commissionAccrued`/`commissionClawedBack` guard the ledger; unique `sourceEventId` |
| `InvoiceInstallment` | finance's own schedule copy (`due`/`settled`); kept separate from trade's `Installment` so the modules stay independently writable |
| `Payment` | proof capture → verification; `pending_verification`/`verified`/`rejected`; `verifiedBy`, `targetTrigger` |
| `CommissionEntry` | APPEND-ONLY ledger; `accrual`/`clawback`/`payout`; signed `amountMinor`; nullable-unique `dedupeKey` gives DB idempotency for the singular accrual/clawback |
| `ForwarderClaim` | measured-vs-billed over-billing claim; unique `sourceEventId` |
| `PettyCashTransaction` | append-only per-office cash ledger; `float`/`expense`/`replenishment` |
| `SupplierBankAccount` | active pay-to account; written only by applying a dual-approved change |
| `SupplierBankChangeRequest` + `SupplierBankChangeApproval` | dual approval; unique `(requestRef, approverId)` |

Enums: `InvoiceStatus`, `FinanceInstallmentStatus`, `PaymentStatus`, `CommissionEntryType`,
`ClaimStatus`, `PettyCashKind`, `BankChangeStatus`. Money is `Int` minor units (`*Minor`);
cross-aggregate links are readable refs (String), mirroring trade/sourcing.

## Assumptions taken

- **Finance owns the Invoice** and derives the installment schedule from the `order.created`
  payload (tier + total), never reading trade's `Installment`. Trade keeps its own
  `Installment` copy and marks it paid by consuming `payment.verified`.
- **`payment.verified` is emitted for every settled installment**, not only confirmation.
  The reference (`workflow.py::verify_payment`) emits only on confirmation because its
  later gates read installment status directly; in this event-driven system trade marks
  each installment paid via the event, and the contract payload carries `trigger` for
  exactly this. The RULES from the reference (short-payment rejection, 2% at confirmation,
  clawback) are honoured; the emission granularity follows the contract + trade's consumer.
- **Short payment is exact-integer**: `paidMinor < expectedMinor` rejects. No float epsilon
  is needed (the reference's `- 0.01` was a float artefact).
- **Supplier bank dual approval is gated on `payment:approve`** (finance + ceo) — the same
  finance-only permission that governs releasing money. There is no dedicated
  `supplierBank` permission in the contract; this is the closest-fitting money-security
  grant. Four-eyes: two DISTINCT approvers, requester excluded.
- **Petty cash is gated on `pettyCash:*`** (front_office + ceo), because the tin is a
  front-office instrument; finance reconciles it.
- **Readable-id sequences are `count()+1`** inside the insert transaction (same convention
  as trade/sourcing), with the `ref` primary key as the hard backstop.

## What is real vs stubbed

**Real (tested against Postgres):** every service op above; service-layer authorisation
with denial audited before throw (finance-only verification proven denied for four roles);
invoice + schedule creation from `order.created` with exact reconciliation and idempotency;
named-installment settlement; short-payment rejection naming the shortfall; deposit-floor
guard; `payment.proofUploaded`/`payment.verified`/`commission.accrued`/`commission.clawedBack`
emission through the outbox; 2%-at-confirmation accrual as a ledger row; clawback keeping
both rows with agent+finance notification and eventId idempotency; release eligibility;
forwarder-claim assessment + raise + notify with idempotency; petty-cash ledger; supplier
bank dual approval (single approval insufficient, self-approval rejected, double-vote
blocked).

**Stubbed / deferred (called out honestly):**
- The three event handlers are exercised with SYNTHETIC envelopes; no worker subscriber
  fan-out is wired yet (that lands at integration / when logistics ships).
- `CommissionService.recordPayout` exists but the **agent agreement must be signed before
  the first payout** — a FOUNDER DEPENDENCY (business/legal artefact), NOT enforced in
  code. Flagged, not built.
- No controllers/routes (web, Sprint 4). Notification delivery (WhatsApp/SMS) is a later
  sprint; handlers write the durable notification row only.
- Claim recovery workflow beyond `raised → submitted/recovered/written_off` status moves
  is not modelled; the claim + evidence-linking is the Sprint-2 surface.

## Conformance assertions now covered (real Vitest, real Postgres)

| ID | Assertion | Test |
|---|---|---|
| CF-007 | A short payment is rejected naming the shortfall | `test/finance.payment.test.ts` |
| CF-008 | Only Finance verifies a payment (front office / vm / agent / customer denied) | `test/finance.payment.test.ts` |
| CF-009 | Verifying the confirmation payment publishes `payment.verified{trigger:confirmation}` | `test/finance.payment.test.ts` |
| CF-010 | Commission accrues 2% at confirmation as a ledger row | `test/finance.commission.test.ts` |
| CF-020 | Forwarder over-billing raises a claim + notifies finance | `test/finance.claim.test.ts` |
| CF-028 | Goods release requires full payment (release-eligibility determination) | `test/finance.invoice.test.ts` |
| CF-030 | Clawback reverses the accrual and leaves both rows | `test/finance.commission.test.ts` |

Plus guarantees beyond the numbered set: idempotent consumption of `order.created` /
`order.cancelled` / `shipment.billedWeightRecorded`; schedule derived from policy with
exact reconciliation; supplier bank dual approval; petty-cash ledger; masking + scope on
invoice/payment reads.

## Contract-request filed

`docs/contract-requests/2026-07-25-finance-ids.md` proposes `claim`, `pettyCash` and
`bankChange` patterns for `ID_PATTERNS`. Rendering them locally in
`apps/api/src/finance/finance-ids.ts` meanwhile, marked `// TODO: pending contract-request`.
