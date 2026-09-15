# Handoff — sourcing-quality (Sprint 1)

Written for an agent with no context. sourcing-quality is the supplier-intelligence and
quality-control half of the corridor: supplier → RFQ → quote → purchase order →
factory visit → inspection → CAPA → release gate, plus an evidence-logged supplier score.
It builds on `docs/handoff/platform.md` (authorisation, transactional outbox, readable
IDs, notifications) and consumes `@uza/contracts` for every shared type, event, permission
and policy number.

Branch: `sprint-1-sourcing-quality`. It does NOT edit `app.module.ts` — the CTO wires
`SourcingModule` and `QualityModule` at integration. Tests instantiate services directly
(no DI container), per the platform handoff.

---

## Services exposed (all authorise at the service layer)

Authorisation is enforced inside each service via
`AuthorizationService.authorize(actor, resource, action, obj?)`. There are no controllers
yet — the web module (Sprint 4) binds routes. Reads project onto the confidential field
names and run `maskFields`.

| Service.method | resource:action | Who can call (per ROLE_GRANTS) |
|---|---|---|
| `SupplierService.register` | `supplier:create` | china_sourcing, ceo |
| `SupplierService.setLifecycle` | `supplier:update` | china_sourcing, ceo |
| `SupplierService.addCertification` | `supplier:update` | china_sourcing, ceo |
| `SupplierService.read` | `supplier:read` | china_sourcing, china_warehouse, venture_manager, finance, ceo |
| `SupplierScoreService.applyScoreChange` | (internal primitive, tx-scoped) | called by handlers only |
| `SupplierScoreService.handleWarehouseReceipt` | (event handler, not authorised) | subscriber only |
| `RfqService.createRfq` | `rfq:create` | china_sourcing, ceo |
| `RfqService.addQuote` | `supplierQuote:create` | china_sourcing, ceo |
| `RfqService.read` | `supplierQuote:read` | china_sourcing, ceo |
| `PurchaseOrderService.create` | `po:create` | china_sourcing, ceo |
| `PurchaseOrderService.read` | `po:read` | china_sourcing, china_warehouse, venture_manager, finance, ceo |
| `VisitService.assign` | `visit:create` | china_sourcing, ceo |
| `VisitService.read` | `visit:read` | china_sourcing, china_warehouse, ceo |
| `InspectionService.record` | `inspection:create` | china_warehouse (François), ceo |
| `InspectionService.read` | `inspection:read` | china_sourcing, china_warehouse, ceo |
| `InspectionService.assertReleasable` | `inspection:read` | (quality's half of the release gate) |
| `CapaService.draftCorrectiveAction` | `capa:update` | china_sourcing, ceo (AI/person drafts; does NOT close) |
| `CapaService.close` | `capa:approve` | china_sourcing, ceo (human only) |
| `CapaService.read` | `capa:read` | china_sourcing, china_warehouse, ceo |

### Key behaviours

- **Inspection result is DERIVED, never supplied.** `critical > 0 ⇒ fail`,
  `major > 2 ⇒ conditional`, else `pass` (`quality/thresholds.ts::gradeInspection`).
  The thresholds are a filed contract-request (below); local const meanwhile.
- **A critical defect fails, blocks release, and auto-opens a CAPA — no override flag.**
  In the same transaction as the inspection, `record` publishes `inspection.recorded`
  and (on fail) `quality.failed`, and creates the CAPA (`status=open`). There is no path
  to record a critical-defect inspection that passes.
- **The project goes red via the event, not a direct write.** `Project` is trade's
  aggregate; quality signals it by publishing `quality.failed`. The subscriber that flips
  `Project.health = red` is trade/orchestration's (the reference's `h_quality_failure`).
  I do not write another module's rows.
- **A CAPA closes only against a human-approved passing reinspection.** `CapaService.close`
  is gated on `capa:approve` (human), requires the reinspection's `result === 'pass'`
  (else `CAPA_REINSPECTION_FAILED`), and refuses the inspection that opened it. AI may
  `draftCorrectiveAction` (sets `status=evidence_submitted`) but can never close.
- **The release gate (quality half).** `assertReleasable(poRef)` throws
  `GATE_QC_NOT_RELEASED` while any CAPA against the PO is not closed. Warehouse enforces
  release on the physical packages; this is the quality-state check it asks first.
- **Cost basis is recorded and enforced.** `addQuote` derives `inlandSeparable` from
  `basis` — an `FOB` quote is forced `inlandSeparable=false` (inland buried), never
  trusted from the caller — so an FOB quote can't masquerade as comparable to an EXW one.
- **Supplier score moves only on logged evidence.** There is no setter. Every move is a
  `SupplierScoreEvent` row (delta, before/after, `cause`, optional `causeRef`/`detail`/
  `sourceEventId`) written in the same transaction as the `Supplier.score` update, via
  `SupplierScoreService.applyScoreChange`.
- **Evidence is bound, not loose.** `InspectionEvidence` carries `lotRef` + `packageRef`
  (nullable for pre-packing stages) so a photo/video/measurement is stored against the lot
  and package it documents — what wins a forwarder or supplier claim later.
- **Price/quality history are first-class.** Each quote appends a `SupplierPricePoint`;
  each inspection appends a `SupplierQualityRecord`, so a supplier's price trend and defect
  record survive independently of the source rows.

### Offline capture (François, poor Ningbo signal)

Every write path takes an optional `clientRequestId` (a device-generated UUID) stored under
a UNIQUE column on `Supplier`, `Rfq`, `SupplierQuote`, `PurchaseOrder`, `Visit`,
`Inspection`, `Capa`. Before writing, the service checks it (`sync.ts::findByClientRequestId`);
a replay returns the existing row and **emits nothing** — a resynced capture cannot
double-open a CAPA, double-publish a failure, or double-issue a PO. The unique column is the
hard backstop if a concurrent duplicate slips past the read. `Inspection.capturedOffline`
records that a row originated offline. This is the retrofit designed in now, as the charter
demands; the transport/queue that carries offline captures to the API is the web/mobile
module's (Sprint 4).

---

## Events published (real example payloads)

All through the transactional outbox (`OutboxService.emit`), committed in the same
transaction as the state change. Only events sourcing/quality OWN (`EVENT_OWNERS`) are
emitted.

```jsonc
// po.issued            (owner: sourcing)
{ "poRef": "PO-CN-2026-0001", "supplierRef": "SUP-CN-0001", "orderRef": "ORD-BULK-2026-0001" }

// inspection.recorded  (owner: quality) — published on EVERY inspection
{ "inspectionRef": "INS-CN-2026-0001", "poRef": "PO-CN-2026-0001",
  "result": "fail", "critical": 1, "major": 0, "minor": 2 }

// quality.failed       (owner: quality) — published only when result === 'fail'
{ "inspectionRef": "INS-CN-2026-0001", "poRef": "PO-CN-2026-0001", "supplierRef": "SUP-CN-0001" }

// capa.closed          (owner: quality)
{ "capaRef": "CAPA-CN-2026-0001", "supplierRef": "SUP-CN-0001" }
```

## Events consumed

- **`warehouse.receiptRecorded`** (owned by warehouse, which does not exist yet). Handler:
  `SupplierScoreService.handleWarehouseReceipt`. On a flagged discrepancy it lowers the
  supplier's score by `-min(abs(variance) * 10, 2.0)`, logging the cause
  (`declared_vs_measured_variance`) with a `SupplierScoreEvent` row; a receipt within
  tolerance is recorded as processed but moves no score. Idempotent on `eventId` via
  `ProcessedEvent` (consumer `sourcing.warehouse-receipt`) — a redelivery cannot
  double-penalise. Built and unit-tested now against SYNTHETIC envelopes (CF-015
  mechanism-ready); wire it to the worker's subscriber fan-out when warehouse lands.

---

## Prisma models added (migration `20260725143238_sourcing_quality_init`)

| Model | Notes |
|---|---|
| `Supplier` | EN + CN names, lifecycle, `score` (evidence-logged only); `SUP-CN-{seq:4}` |
| `SupplierCertification` | ISO/CE/audit certs; expiry is a sourcing signal |
| `SupplierScoreEvent` | APPEND-ONLY score ledger: delta, before/after, `cause`, `sourceEventId` |
| `SupplierPricePoint` | price history; one row per observed quote price, carries basis |
| `SupplierQualityRecord` | quality history; one row per inspection outcome, denormalised |
| `Rfq` | request for quotation against a project |
| `SupplierQuote` | `basis` (EXW/FOB) + `inlandSeparable`; `*Minor` cost; declared cbm/kg |
| `PurchaseOrder` | `declaredCbm`/`declaredKg` (factory numbers); `*Minor`; `PO-CN-{year}-{seq:4}` |
| `Visit` | factory visit assigned to an inspector |
| `Inspection` | four stages; critical/major/minor; DERIVED `result`; `capturedOffline` |
| `InspectionEvidence` | photo/video/measurement bound to `lotRef` + `packageRef` |
| `Capa` | auto-opened on fail; closes only via `closedByReinspectionRef` + `closedBy` |

Enums added: `SupplierLifecycle`, `QuoteBasis`, `PoStatus`, `InspectionStage`,
`InspectionResult`, `CapaStatus` — all aligned with the `@uza/contracts` type unions.

Money is `Int` minor units (`*Minor` columns). Cross-aggregate links are readable refs
(String), mirroring trade; `orderRef`/`projectRef` are refs into trade's aggregates with no
relational FK, so the modules stay independently writable. Every write model has a unique
`clientRequestId` for offline idempotency.

---

## Assumptions taken

- **Grading thresholds and score constants are local, pending contract-requests.** They
  are not in `policy.ts`; filed as `2026-07-25-inspection-thresholds.md` and
  `2026-07-25-supplier-scoring-and-ids.md`. Local copies in `quality/thresholds.ts` and
  `sourcing/scoring.ts`, each marked `// TODO: pending contract-request`.
- **`supplier`/`rfq`/`supplierQuote` are not in `ID_PATTERNS`.** Rendered locally in
  `sourcing/sourcing-ids.ts` (`SUP-CN-{seq:4}`, `RFQ-{year}-{seq:4}`, `SQ-{seq:4}`) per the
  reference; `po`/`visit`/`inspection`/`capa` go through the shared platform formatter.
  Same contract-request proposes adding the three missing patterns.
- **The CAPA auto-opens with no `correctiveAction`.** Drafting (AI or a person) is a
  separate later step; the open CAPA alone blocks release.
- **`assertReleasable` blocks on any non-closed CAPA for the PO.** This is the quality
  reading of "a critical defect blocks release until corrected"; warehouse owns the
  package-level `qcReleased` gate and calls this first.
- **Readable-id sequences are `count()+1` inside the insert transaction** — collision-free
  under the single-writer model, with the `ref`/`@unique` constraint as the hard backstop
  (same convention trade uses).
- **`Inspection.result` union** is sourced from `@uza/contracts` (`inspection.types.ts`
  re-exports it) rather than redeclared.

## What is real vs stubbed

**Real (tested against Postgres):** every service op above, service-layer authorisation
with denial audited before throw, masking on read, derived inspection grading, auto-CAPA on
critical defect, the CAPA-close gate (fail rejected, pass closes, human-approved), the
release gate, cost-basis enforcement (FOB ⇒ inlandSeparable=false), evidence bound to
lot/package, price + quality history rows, `po.issued`/`inspection.recorded`/`quality.failed`/
`capa.closed` emission through the outbox, offline-replay idempotency on the PO and
inspection write paths, and the supplier-score primitive.

**Stubbed / deferred (called out honestly):**
- The `warehouse.receiptRecorded` handler is exercised with SYNTHETIC envelopes (warehouse
  is Sprint 3); no worker subscriber wiring yet. It is the CF-015 *mechanism* — full
  coverage (real receipt → score) lands when warehouse does.
- Project-health-red on `quality.failed` is emitted, not applied here (Project is trade's).
- No controllers/routes (web, Sprint 4). The offline capture/sync TRANSPORT is web/mobile's;
  this module supplies the idempotent write contract it targets.
- Notification delivery (WhatsApp/SMS) is a later sprint; visit-assignment writes the
  durable notification row only.
- Supplier-score inputs other than volumetric variance (defect rate, delivery lateness,
  packaging failure) have cause tags and the `applyScoreChange` primitive ready, but no
  event wired to drive them yet.

## Conformance assertions now covered (real Vitest, real Postgres)

| ID | Assertion | Test |
|---|---|---|
| CF-011 | A critical defect fails inspection and opens a CAPA | `test/quality.inspection.test.ts` |
| CF-012 | A CAPA closes only against a passing reinspection | `test/quality.capa.test.ts` |
| CF-015 | Declared-vs-measured variance lowers the supplier score (mechanism, synthetic envelope) | `test/sourcing.score.test.ts` |

Plus guarantees beyond the numbered set: service-layer role denial audited before throw,
`po.issued`/`inspection.recorded`/`quality.failed`/`capa.closed` emission through the outbox,
FOB-basis inland flag enforcement, evidence bound to lot/package refs, and offline-replay
idempotency on the PO and inspection write paths.

## Contract-requests filed

- `docs/contract-requests/2026-07-25-inspection-thresholds.md` — `INSPECTION_THRESHOLDS`
  (critical>0 ⇒ fail, major>2 ⇒ conditional) into `policy.ts`.
- `docs/contract-requests/2026-07-25-supplier-scoring-and-ids.md` — `SUPPLIER_SCORE`
  constants into `policy.ts` and `supplier`/`rfq`/`supplierQuote` into `ID_PATTERNS`.

Proceeding meanwhile against local constants marked `// TODO: pending contract-request`.

---

## Addendum (2026-09-14) — supplier self-service, EV attachments, two-stage deal payment

Founder request: a supplier-facing channel to submit a deal proactively (not only in
response to an RFQ), with attachments (EV-heavy: images, inspection report, battery-health
certificate), and a two-stage payment (booking fee reserves a unit; balance due only after
a passing inspection). Plus: confirm FOB deals get their own freight arrangement.

### What's real and tested

- **`SupplierOfferService`** (`sourcing/offer/supplier-offer.service.ts`) — a supplier's
  proactive offer, STAFF-RELAYED (`channel: 'staff_relay'`, `relayedBy`, free-text
  `supplierContact`) because suppliers have no login role today (confirmed gap — see
  contract-request below). `submit`/`addAttachment`/`accept`/`decline`/`read`, all
  authorised on the EXISTING `supplierQuote:*` grant (no new ROLE_GRANTS entry needed).
  Offline-safe via `clientRequestId` on both the offer and each attachment.
- **`SupplierOfferAttachment`** — `image` | `inspection_report` |
  `battery_health_certificate`, proper typed rows (not one opaque blob), bound to the
  offer.
- **`SupplierDealService`** (`sourcing/deal/supplier-deal.service.ts`) — the two-stage
  payment state machine: `reserved → inspected → balance_due → paid`, with
  `inspection_failed` as a visible, blocking side-state (never silently stuck). Grades via
  the SAME `gradeInspection` boundary quality uses (never re-derived): a critical defect
  fails, no override, and blocks `markBalanceDue`. `markBalanceDue` additionally requires
  the result to be strictly `pass` (not `conditional`) — the money-release gate. Both
  money-confirmation steps (`reserve`, `confirmBalancePaid`) require an explicit human
  `confirmedBy` and are authorised on `po:approve` (finance/china_sourcing/ceo — an
  existing, previously-unused grant, reused rather than requesting a new one). Offline-safe
  via `SupplierDealEvent`, an append-only per-transition ledger keyed by `clientRequestId`
  — the same idea as `sync.ts` but for state TRANSITIONS on an existing row, not new-row
  creation.
- **PurchaseOrder now carries `basis`/`inlandSeparable`**, copied from the linked
  SupplierQuote at issuance (never trusted from the caller when a quote exists — same
  discipline as `RfqService.addQuote`). Added `PurchaseOrderService.assignOriginForwarder`
  to record who books the sea leg. Checked `logistics/logistics/container.service.ts` and
  `logistics/logistics/freight.service.ts` (owned by logistics-warehouse, not edited here):
  neither branches on incoterm, and that is CORRECT — `QuoteBasis` is only ever EXW or FOB,
  never CIF/DAP, so a SupplierQuote/PO price never includes ocean freight either way; UZA
  always books its own sea leg regardless of basis. The actual gap was that the PO didn't
  retain which basis it was — fixed here, within this module's own files.

### Prisma models added (migration `20260914120000_supplier_offer_and_deal`)

| Model | Notes |
|---|---|
| `SupplierOffer` | proactive, staff-relayed today; `basis`/`inlandSeparable`; `OFF-CN-{year}-{seq:4}` |
| `SupplierOfferAttachment` | `image`/`inspection_report`/`battery_health_certificate`, bound to the offer |
| `SupplierDeal` | two-stage payment state machine; `DEAL-CN-{year}-{seq:4}` |
| `SupplierDealEvent` | append-only per-transition offline-replay ledger, keyed by `clientRequestId` |
| `PurchaseOrder` (altered) | `+basis`, `+inlandSeparable`, `+originForwarderRef`, `+originForwarderName` |

### Contract-requests filed (2026-09-14)

- `docs/contract-requests/2026-09-14-supplier-self-service-role.md` — the real blocker: a
  `supplier` `Role` (login, `ROLE_GRANTS`, `Actor.scope.supplierRef`, `inScope` case) for a
  supplier to authenticate and manage ONLY its own offers. NOT built (cannot be, without
  this). Staff-relayed submission is the real, working interim.
- `docs/contract-requests/2026-09-14-supplier-deal-ids-policy-and-masking.md` —
  `supplierOffer`/`supplierDeal` ID_PATTERNS, `BOOKING_FEE_PER_UNIT_MINOR` policy constant
  (flags an open RMB-vs-implicit-currency question — `Minor` has no currency dimension
  anywhere in this codebase), and `bookingFeeMinor`/`balanceMinor` CONFIDENTIAL_FIELDS
  entries (until accepted, `china_warehouse` sees these two unmasked — documented in
  `SupplierDealService.read`, not hidden).

### What is stubbed / an honest open gap

- No real supplier login exists; `channel: 'staff_relay'` is the only value produced today.
- `bookingFeeMinor`/`balanceMinor` are not yet in `CONFIDENTIAL_FIELDS` (see above).
- The booking-fee constant's currency is unresolved (RMB figure, currency-agnostic `Minor`
  type) — flagged, not silently assumed.
- `SupplierDeal`/`SupplierOffer` do not publish domain events (`po.issued`,
  `inspection.recorded`, `quality.failed`, `capa.closed` are the only four this module
  owns per `EVENT_OWNERS`; a deal reaching `paid`, for instance, is not yet visible to
  other modules via the event bus — would need its own contract-request if that
  visibility turns out to be needed).
- Tests were written (`test/sourcing.supplier-offer.test.ts`,
  `test/sourcing.supplier-deal.test.ts`, plus three new cases in
  `test/sourcing.po.test.ts`) following the exact same fixtures/conventions as the
  existing passing suite, and `tsc --noEmit` is clean. They could NOT be executed against
  a live Postgres in the sandbox this was built in (no reachable database — confirmed by
  running an existing, previously-passing test file, which failed identically with a
  connection error). This is an environment limitation, not a defect; run
  `pnpm --filter api test` against a real `DATABASE_URL`/`TEST_DATABASE_URL` to confirm.
