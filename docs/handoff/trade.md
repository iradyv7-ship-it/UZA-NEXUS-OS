# Handoff — trade-flow (Sprint 1)

Written for an agent with no context. trade-flow is the commercial spine: enquiry →
lead → request → project → task → quotation → order → installment schedule. It builds on
`docs/handoff/platform.md` (authorisation, transactional outbox, readable IDs) and
consumes `@uza/contracts` for every shared type, event, permission and policy number.

Branch: `sprint-1-trade-flow`. It does NOT edit `app.module.ts` — the CTO wires
`TradeModule` at integration. Tests instantiate services directly (no DI container),
per the platform handoff.

---

## Services exposed (all authorise at the service layer)

Authorisation is enforced inside each service via
`AuthorizationService.authorize(actor, resource, action, obj?)`. There are no controllers
yet — the web module (Sprint 4) binds routes. Every read path runs `maskFields`.

| Service.method | resource:action | Who can call (per ROLE_GRANTS) |
|---|---|---|
| `CustomerService.create` | `customer:create` | sales_agent, ceo |
| `CustomerService.read` | `customer:read` (+scope) | most internal roles; scoped for agent/customer |
| `IntakeService.createLead` | `lead:create` | sales_agent, venture_manager, ceo |
| `IntakeService.clarifyLead` | `request:create` | sales_agent, venture_manager, ceo |
| `ProjectService.create` | `project:create` | venture_manager, ceo |
| `ProjectService.createTask` | `task:create` | venture_manager, ceo |
| `QuotationService.build` / `revise` | `quotation:create` | venture_manager, ceo |
| `QuotationService.approve` | `quotation:approve` | venture_manager, ceo |
| `QuotationService.closeCosts` | `margin:read` | finance, ceo |
| `QuotationService.read` | `quotation:read` (+scope) | scoped; masks cost/margins |
| `OrderService.create` | `order:create` | venture_manager, ceo |
| `OrderService.cancel` | `order:update` | venture_manager, ceo |
| `OrderService.read` | `order:read` (+scope) | scoped |
| `OrderService.handlePaymentVerified` | (event handler, not authorised) | subscriber only |

### Key behaviours

- **Intake is unstructured-first.** A `Lead` stores the raw WhatsApp text verbatim
  (`rawText`, `clarified=false`). `clarifyLead` is the human-confirmation gate: a person
  submits the confirmed structured `spec`, which produces the `Request` and flips the
  lead to `clarified`. `ProjectService.create` refuses a request whose lead is not
  clarified — unstructured text never becomes a project without confirmation.
- **Quotation is a cost ladder, priced at the sell incoterm.** Built on
  `emptyLadder()`; `FREIGHT_CONTINGENCY` is applied to the freight rungs
  (`ocean`, `inlandDest`) at build time. `read()` always exposes `dapMargin` next to the
  quoted `marginPct` (both masked together for unauthorised roles).
- **Quoted margin locks at build/approval; `realizedMargin` is separate.** `closeCosts`
  writes actuals into the ladder and recomputes `realizedMargin` at DAP. It never touches
  `marginPct`. The quoted-vs-realized gap is preserved deliberately.
- **Versioned, never edited in place.** `revise` creates version n+1 and marks the
  predecessor `superseded` (`supersededByRef` chains old→new).
- **Installments are generated on order creation** from `scheduleFor(customer.completedOrders)`
  + `splitInstallments` (parts sum EXACTLY to the total). The deposit can never fall below
  `MIN_DEPOSIT` (guarded, throws `DEPOSIT_BELOW_MINIMUM`). No split is hardcoded.
- **Masking on every read.** Confidential fields (`supplierUnitCost`, `targetPrice`,
  `walkawayPrice`, `marginPct`, `realizedMargin`, and derived `dapMargin`) are masked for
  roles not in `CONFIDENTIAL_FIELDS`. A sales agent sees `customerUnitPriceMinor` and
  nothing behind it.

---

## Events published (real example payloads)

All published through the transactional outbox (`OutboxService.emit`), committed in the
same transaction as the state change. Only events trade OWNS (`EVENT_OWNERS`) are emitted.

```jsonc
// lead.created
{ "leadRef": "LED-2026-0001", "customerRef": "CUS-CD-000001", "agentId": "AGT-GOM-0021" }

// request.created
{ "requestRef": "REQ-BULK-2026-0001", "customerRef": "CUS-CD-000001" }

// quotation.approved
{ "quotationRef": "QUO-BULK-2026-0001", "projectRef": "PRJ-BULK-2026-0001" }

// order.created
{ "orderRef": "ORD-BULK-2026-0001", "customerRef": "CUS-CD-000001",
  "agentId": "AGT-GOM-0021", "totalMinor": 616300, "tier": "new" }

// order.cancelled
{ "orderRef": "ORD-BULK-2026-0001", "reason": "customer withdrew" }
```

## Events consumed

- **`payment.verified`** (owned by finance, which does not exist yet). Handler:
  `OrderService.handlePaymentVerified`. Marks the due installment matching `payload.trigger`
  as `paid`; on `trigger === 'confirmation'` flips the order to `procurement_active`
  (payment gates procurement — never an agent, never AI). Idempotent on `eventId` via
  `ProcessedEvent` (consumer `trade.payment-verified`): a redelivered event is a no-op.
  Built and unit-tested now against SYNTHETIC envelopes; wire it to the worker's subscriber
  fan-out when finance lands.

---

## Prisma models added (migration `20260725134456_trade_flow_init`)

| Model | Notes |
|---|---|
| `Customer` | `completedOrders` drives the schedule tier; `ref` = `CUS-{country}-{seq:6}` |
| `Lead` | raw WhatsApp text + `clarified` flag; the unstructured intake entry point |
| `Request` | structured `spec` (JSON), produced only via `clarifyLead` |
| `Project` | created only from a clarified lead's request; carries the customer's agent |
| `Task` | RACI: `accountable` and `responsible` are separate, mandatory fields |
| `Quotation` | `ladder` (JSON CostLadder), `*Minor` money, quoted `marginPct` + separate `realizedMargin`, `version` + `supersededByRef` |
| `Order` | `status` (independent lifecycle), `tier`, `totalMinor`; Invoice is NOT created (Finance owns it) |
| `Installment` | `trigger`/`pct`/`amountMinor`/`status`; FK to Order (cascade) |

Enums added: `QuotationStatus`, `OrderStatus`, `InstallmentStatus`. `sellIncoterm`,
`trigger` and `tier` are validated strings against the contract unions.

Money is `Int` minor units everywhere (`*Minor` columns). Ceiling per column is ~$21M
(Int32); acceptable for the corridor, revisit with BigInt if order sizes grow.

---

## Assumptions taken

- **`Customer.completedOrders`** is the tier input. The reference counts delivered orders
  live; trade exposes a counter maintained as orders are delivered downstream (logistics).
- **`order.created.agentId`** is `''` when the quotation has no agent (the event type
  requires a string). Finance treats an empty agent as no-commission.
- **`closeCosts` is authorised on `margin:read`** (finance/ceo). Reference had no auth on
  it; DoD requires one, and closing a quotation's true margin is a finance activity gated
  by the same permission that governs seeing margin. Note: finance does NOT hold
  `quotation:read`, so it reaches margins via `closeCosts`, not direct quotation reads.
- **Readable-id sequences** are `count()+1` inside the insert transaction — collision-free
  under the single-writer model, with the `ref` unique constraint as the hard backstop. A
  per-(kind,year) monotonic DB sequence is a follow-up, not sprint 1.
- **`FREIGHT_RUNGS = [ocean, inlandDest]`** (which rungs are "freight") is a structural
  fact of the corridor kept local to `quotation/pricing.ts`; the contingency RATE is
  `policy.FREIGHT_CONTINGENCY`.

## What is real vs stubbed

**Real (tested against Postgres):** every service op above, service-layer authorisation
with denial audited before throw, masking on read, cost-ladder pricing with contingency,
both margins, quoted/realized separation, quotation versioning, policy-driven installment
generation with exact reconciliation, order/lead/request/quotation.approved event
emission through the outbox, and the `payment.verified` consumer with idempotency.

**Stubbed / deferred:** the `payment.verified` handler is exercised with synthetic
envelopes (finance is Sprint 2); no worker subscriber wiring yet. No controllers/routes
(web, Sprint 4). No `Invoice` model (Finance owns it). Notifications to project owners /
task responsibles are not written (notification delivery is a later sprint).

## Conformance assertions now covered (real Vitest, real Postgres)

| ID | Assertion | Test |
|---|---|---|
| CF-002 | Quoted margin holds at the sell incoterm | `test/trade.quotation.test.ts` |
| CF-003 | DAP margin computed and exposed alongside the quoted margin | `test/trade.quotation.test.ts` |
| CF-004 | Freight rungs carry the contingency factor | `test/trade.quotation.test.ts` |
| CF-005 | A new client's order generates a 50/50 schedule | `test/trade.order.test.ts` |
| CF-006 | An established client's order generates 30/40/30 | `test/trade.order.test.ts` |
| CF-029 | Realized margin computes from actuals; quoted stays intact | `test/trade.quotation.test.ts` |

Plus trade guarantees beyond the numbered set: service-layer role + scope denial audited
before throw, masking on read, quotation versioning, order.created/cancelled emission,
and idempotent `payment.verified` consumption.

## Open founder decision flagged (on default)

**Sell incoterm** is on its `policy.ts` default (`CIF`). Every quotation surfaces BOTH the
quoted margin (at the sell incoterm) and the DAP margin, so the gap is visible until
Badiane decides. On the standard reference ladder that gap is ~18% at CIF vs ~1.1% at DAP.

## Contract-request filed

`docs/contract-requests/2026-07-25-trade-price-factors.md` proposes `TARGET_PRICE_FACTOR`
(0.92) and `WALKAWAY_FACTOR` (1.05) move into `policy.ts`. Proceeding meanwhile against
local constants in `apps/api/src/trade/quotation/pricing.ts`, marked
`// TODO: pending contract-request`.
