# Handoff — logistics-warehouse (Sprint 3)

Written for an agent with no context. logistics-warehouse is the physical chain and the
LAST real control point over an order before it sails: warehouse receiving, three-way
volumetric reconciliation, QC release, destination allocation, containers (the three
booking gates), freight allocation, tracking, delivery with proof, and the Imari partner
portal. It builds on `docs/handoff/platform.md` (authorisation, transactional outbox,
notifications, readable IDs) and consumes sourcing/quality's inspection events and
finance's `payment.verified`. Every shared type/event/permission/policy number comes from
`@uza/contracts`.

Branch: `sprint-3-logistics-warehouse`. It does NOT edit `app.module.ts` — the CTO wires
`LogisticsModule` at integration. Tests instantiate services directly (no DI container),
per the platform handoff.

---

## The two rules that shaped everything

1. **`qcReleased` and `varianceHold` are two SEPARATE boolean columns on `Package` (CF-014).**
   They are never a single status/zone. `qcRelease` writes only `qcReleased`;
   `resolveVariance` writes only `varianceHold`. The zone enum deliberately carries no
   per-city or QC/hold semantics. Collapsing these once let unresolved goods sail.
2. **Volumetrics are three numbers, never one.** `declared*` (factory, on `WarehouseReceipt`,
   copied from the PO, never mutated here) · `measured*` (François, the `Package` kg/cbm and
   the receipt's `measured*`) · `billed*` (forwarder, on `Shipment`). No column is ever
   overwritten by another number. Declared-vs-measured is a SUPPLIER problem
   (`warehouse.receiptRecorded` feeds the supplier score). Measured-vs-billed is a CLAIM
   against the forwarder (`shipment.billedWeightRecorded` → finance raises it).

---

## Services exposed (all authorise at the service layer)

Authorisation is `AuthorizationService.authorize(actor, resource, action, obj?)` inside
every method. No controllers yet — the web module (Sprint 4) binds routes.

| Service.method | resource:action | Who can call (per ROLE_GRANTS) |
|---|---|---|
| `ReceivingService.receivePackages` | `package:create` | china_warehouse, ceo |
| `ReceivingService.resolveVariance` | `package:update` | china_warehouse, venture_manager, ceo |
| `ReleaseService.qcRelease` | `package:update` | china_warehouse, venture_manager, ceo |
| `ReleaseService.allocateDestination` | `package:update` | china_warehouse, venture_manager, ceo |
| `ContainerService.createShipment` | `shipment:create` | venture_manager, ceo |
| `FreightService.recordBilledWeight` | `shipment:create` | venture_manager, ceo |
| `FreightService.allocateFreight` | `shipment:create` | venture_manager, ceo |
| `TrackingService.track` / `.timeline` | `shipment:read` | vm, front_office, customer, logistics_partner, ceo |
| `TrackingService.delayShipment` | `shipment:create` | venture_manager, ceo |
| `DeliveryService.deliver` | `delivery:create` (+shipment scope) | logistics_partner, ceo |
| `PartnerPortalService.readShipment/readPackages/readDelivery` | `shipment/package/delivery:read` (+scope) | logistics_partner (scoped), internal roles |
| `OrderPaymentService.handlePaymentVerified` | (event handler, not authorised) | subscriber only |
| `OrderPaymentService.isPreLoadingPaid / releaseEligibility` | (internal gate reads) | called by container/delivery |
| `QualityGateService.handleInspectionRecorded / handleQualityFailed` | (event handlers) | subscriber only |
| `QualityGateService.assertReleasable` | (internal gate read) | called by release |

### Key behaviours

- **Receiving reconciles measured vs declared** and emits `warehouse.receiptRecorded` in
  the same transaction as the writes. `variance = (measuredCbm − declaredCbm)/declaredCbm`;
  `discrepancy = |variance| > CBM_TOLERANCE`; `hardStop = variance > CBM_HARD_STOP`. On a
  hard stop every package is frozen `varianceHold=true` (CF-013). Offline replay is
  idempotent on a unique `clientRequestId` (François, poor Ningbo signal) — a resync
  returns the existing receipt and emits nothing.
- **`resolveVariance`** records the human decision (`client_pays | uza_absorbs |
  reduce_qty`), clears the commercial hold on the lot's packages ONLY, and emits
  `warehouse.varianceResolved`. It never touches `qcReleased`.
- **`qcRelease`** is the QC half of release: it calls `QualityGateService.assertReleasable`
  (a package on a PO whose latest inspection failed throws `GATE_QC_NOT_RELEASED`), then
  flips `qcReleased=true` + zone `READY_FOR_LOADING` — and touches nothing else. It never
  clears `varianceHold`.
- **Container booking = three independent gates, IN THIS ORDER, each a distinct actionable
  error** (`ContainerService.createShipment`). A QC precondition (`GATE_QC_NOT_RELEASED`
  for unreleased packages) precedes them; then:
  1. `GATE_VARIANCE_UNRESOLVED` — any package with `varianceHold=true` (the COMMERCIAL
     hold, read separately from the QC flag).
  2. `GATE_PRELOADING_UNPAID` — the pre-loading installment not settled, read from the
     `OrderPaymentState` projection.
  3. `GATE_MIXED_DESTINATION` — more than one destination, or any unassigned destination.
     Containers are destination-PURE (CF-018).
  On success it creates the `Shipment` (`status=planned`), links the packages, stamps
  `daysWaitingForConsolidation`, and emits `container.assigned`.
- **Freight allocates PRO-RATA by revenue ton** = `max(cbm, kg/1000)`, NOT by CBM (CF-021).
  Rows are integer minor units summing EXACTLY to `freightPaidMinor` (remainder to the
  last, like `splitInstallments`); persisted as `FreightAllocation` for a per-container
  P&L. `recordBilledWeight` stores the billed numbers alongside measured (never over) and
  emits `shipment.billedWeightRecorded` with a `claimRaised` flag (billed >
  measured·(1+`BILLING_CLAIM_THRESHOLD`)).
- **Tracking declares provenance (CF-022).** `carrier/partner/uza` are confirmed;
  `estimated` is not. Reads return a derived `confirmed` boolean so a customer view can
  never present an estimate as fact.
- **A delay fans out to FIVE distinct parties (CF-023)** — customer, agent, project_owner,
  front_office, logistics_partner — each a role-appropriate message written as its own
  `Notification` row, and emits `shipment.delayed`.
- **Delivery is gated on FULL payment (CF-028), not arrival.** `deliver` reads
  `OrderPaymentService.releaseEligibility` (mirrored from `payment.verified`, never from
  finance's tables); any outstanding balance throws `GATE_BALANCE_OUTSTANDING` and the
  goods stay in the warehouse. On success it records the POD `Delivery`, marks packages
  `delivered`, sets the shipment `delivered`, and emits `delivery.completed`.
- **The Imari partner portal** enforces scope + masking, not DTO omission. `authorize()` +
  `inScope` restrict a `logistics_partner` to its assigned `shipmentRefs`; weight/CBM are
  visible, freight cost is masked (see the contract-request note below).

---

## Events published (real example payloads)

All through the transactional outbox (`OutboxService.emit`), committed in the same
transaction as the state change. Only events logistics OWNS are emitted.

```jsonc
// warehouse.receiptRecorded — on receivePackages (sourcing scores the supplier off it)
{ "lotRef": "LOT-ORD0001-01", "orderRef": "ORD-BULK-2026-0001", "poRef": "PO-CN-2026-0001",
  "declaredCbm": 3.0, "measuredCbm": 4.0, "measuredKg": 1000, "measuredRevenueTon": 4.0,
  "variance": 0.3333, "discrepancy": true, "hardStop": true }

// warehouse.varianceResolved — on resolveVariance
{ "orderRef": "ORD-BULK-2026-0001", "decision": "client_pays", "approverId": "FRANCOIS", "note": "" }

// container.assigned — on createShipment
{ "shipmentRef": "SHP-2026-0001", "container": "MSKU-1234567", "destination": "KIGALI", "packageCount": 2 }

// shipment.billedWeightRecorded — on recordBilledWeight (finance raises the claim, CF-020)
{ "shipmentRef": "SHP-2026-0001", "measuredRevenueTon": 6.0, "billedRevenueTon": 6.5,
  "freightPaidMinor": 900000, "claimRaised": true }

// shipment.delayed — on delayShipment
{ "shipmentRef": "SHP-2026-0001", "oldEta": "2026-09-15", "newEta": "2026-10-01", "reason": "typhoon at origin port" }

// delivery.completed — on deliver
{ "deliveryRef": "DLV-GOM-2026-0001", "orderRef": "ORD-BULK-2026-0001", "shipmentRef": "SHP-2026-0001" }
```

## Events consumed

- **`payment.verified`** (finance). Handler `OrderPaymentService.handlePaymentVerified`
  projects `OrderPaymentState` (paid triggers + cumulative `paidFraction`) for booking gate
  2 and the release gate. Never reads finance's tables. Idempotent (consumer
  `logistics.payment-verified`).
- **`inspection.recorded`** (quality). Handler
  `QualityGateService.handleInspectionRecorded` upserts `InspectionOutcome` per PO;
  `releaseBlocked = result === 'fail'` (a later pass clears it). Idempotent
  (`logistics.inspection-recorded`).
- **`quality.failed`** (quality). Handler `QualityGateService.handleQualityFailed` sets
  `releaseBlocked=true`. Idempotent (`logistics.quality-failed`).

All three are built + unit-tested against SYNTHETIC envelopes; the worker subscriber
fan-out that delivers real events to these handlers is a tracked integration follow-up
(same posture as sourcing/finance's consumers).

---

## Prisma models added (migration `20260725223451_logistics_warehouse_init`)

| Model | Notes |
|---|---|
| `WarehouseReceipt` | lot-level three-way record; `declared*` (factory) + `measured*` (François) + variance/discrepancy/hardStop + human `decision`; unique `lotRef`, unique `clientRequestId` (offline) |
| `Package` | measured `kg`/`cbm`; **separate `qcReleased` + `varianceHold` booleans (CF-014)**; `zone` (WarehouseZone), `destination` (Destination?), `shipmentRef`, `delivered` |
| `Shipment` | the container; destination-pure; `billedRevenueTon`/`measuredRevenueTon`/`freightPaidMinor` (the third number); `daysWaitingForConsolidation` on every row |
| `FreightAllocation` | per-container P&L; one row per order, `amountMinor` sums exactly to freight paid; unique `(shipmentRef, orderRef)` |
| `TrackingEvent` | milestone + `source` (TrackingSource) provenance |
| `Delivery` | POD record; `packageRefs String[]`; created only past the full-payment gate |
| `OrderPaymentState` | projection of `payment.verified` (`paidFraction`, `paidTriggers`) — booking gate 2 + release gate |
| `InspectionOutcome` | projection of `inspection.recorded`/`quality.failed` per PO — the QC gate |

Enums: `WarehouseZone`, `Destination`, `TrackingSource`, `ShipmentStatus`,
`DeliveryStatus` — aligned with the `@uza/contracts` type unions. `VarianceDecision` is
stored as a `String` (contract union), mirroring how trade/finance store trigger strings.
Money is `Int` minor units (`*Minor`); cross-aggregate links are readable refs (String),
no relational FKs, so aggregates stay independently writable/truncatable.

---

## Assumptions taken

- **Booking (`shipment:create`) is a venture_manager/ceo action, not china_warehouse** —
  `china_warehouse` has no `shipment:create` grant in the contract. François receives and
  releases packages; the container is booked by a VM/CEO. `delivery:create` is held by
  `logistics_partner` + `ceo` (Imari delivers; ceo for internal proof capture).
- **Shipment status on booking is `planned`, not `in_transit`** (the reference used
  `in_transit`). A container being assigned/consolidated has not departed; departure is a
  tracking event. Delivery flips it to `delivered`.
- **`allocateDestination` sets `destination` only and leaves `zone`** — the reference set
  `zone = destination`, but the contract `WarehouseZone` enum has no per-city values and
  `destination` is a separate field. Smuggling a destination into the zone would blur the
  CF-014 separation, so it is not done.
- **Full payment = cumulative `paidFraction ≥ 1.0`.** `payment.verified` carries a
  cumulative `paidFraction`; the projection keeps the greatest seen (a late/duplicate lower
  value can't regress it). Booking gate 2 reads the `pre_loading` trigger in the paid set.
- **Consolidation profit residual is computed at reporting, not here.** This module
  allocates the freight PAID pro-rata and reports container utilisation
  (`totalRevenueTon / CONTAINER_RT_CAPACITY`); the residual against what customers were
  QUOTED for freight needs trade's quoted freight_share, which is out of scope — flagged.
- **Readable-id sequences are `count()+1`** inside the insert transaction (same convention
  as trade/sourcing/finance), with the `ref`/`@id` constraint as the hard backstop.

## What is real vs stubbed

**Real (tested against Postgres):** every service op above with service-layer authorisation
(denial audited before throw); the three-way volumetric reconciliation and hard-stop freeze;
the qcReleased/varianceHold separation proven in both directions; the QC release gate off
projected quality state; the three booking gates proven to fire strictly in order plus
destination purity; revenue-ton freight allocation summing exactly; billed-weight recording
with the claim flag; tracking provenance; the five-party delay fan-out; the full-payment
release gate; the Imari partner portal (scope allowed, out-of-scope denied+audited, freight
cost masked, weight/CBM visible); offline-replay idempotency on receiving; and idempotent
consumption of `payment.verified`/`inspection.recorded`/`quality.failed`. All six owned
events emit through the outbox in the state-change transaction.

**Stubbed / deferred (called out honestly):**
- The three event handlers run on SYNTHETIC envelopes; no worker subscriber fan-out is
  wired yet (integration follow-up, same as sourcing/finance).
- Notification delivery (WhatsApp/SMS) is a later sprint; the delay fan-out writes durable
  rows only.
- No controllers/routes (web, Sprint 4).
- The consolidation-profit residual (quoted vs paid freight) is not computed here — needs
  trade's quoted freight_share at reporting time.
- Partner freight-cost masking is enforced locally pending a contract-request (below).

## Conformance assertions now covered (real Vitest, real Postgres)

| ID | Assertion | Test |
|---|---|---|
| CF-013 | Variance beyond CBM_HARD_STOP freezes the goods (`varianceHold`) | `test/logistics.receiving.test.ts` |
| CF-014 | `qcReleased` and `varianceHold` never collapse (both directions) | `test/logistics.release.test.ts` |
| CF-016/017 | Booking gate 1 — volumetric variance resolved | `test/logistics.container.test.ts` |
| CF-018 | Booking gate 3 / destination purity — one container, one destination | `test/logistics.container.test.ts` |
| CF-019 | Booking gate 2 — pre-loading installment paid; gates fire in order | `test/logistics.container.test.ts` |
| CF-021 | Freight allocates pro-rata by revenue ton, sums exactly | `test/logistics.freight.test.ts` |
| CF-022 | Tracking separates confirmed from estimated | `test/logistics.tracking.test.ts` |
| CF-023 | A delay notifies five distinct parties, each role-appropriate | `test/logistics.tracking.test.ts` |
| CF-028 | Goods release requires full payment | `test/logistics.delivery.test.ts` |

> Note on the CF-016–019 numbering: the charter lists three booking gates (variance →
> pre-loading → single destination) across CF-016/017/018/019. All three are covered, in
> order, with distinct error codes, in `test/logistics.container.test.ts`. Map to the
> conformance suite's exact numbering during the conformance run.

Plus guarantees beyond the numbered set: service-layer role/scope denial audited before
throw; the Imari partner portal (scope + cost mask); offline-replay idempotency on
receiving; idempotent consumer projections; and all six owned events emitted through the
transactional outbox.

## Founder decision flagged

**Container utilisation (CLAUDE.md §7).** `daysWaitingForConsolidation` is stamped on every
`Shipment` from day one (from the earliest lot receipt among its packages to booking), and
`FreightService.allocateFreight` reports container utilisation
(`totalRevenueTon / CONTAINER_RT_CAPACITY`, capacity 28.0 RT). Destination-pure containers
sailed ~66% full in the reference; these two series are what the founder needs to judge
whether the destination-pure policy costs more than it saves. `CONTAINER_RT_CAPACITY` is a
local constant pending a contract-request (below).

## Contract-requests filed

- `docs/contract-requests/2026-07-26-tracking-id.md` — add `tracking: 'TRK-{year}-{seq:4}'`
  to `ID_PATTERNS`. Rendered locally meanwhile.
- `docs/contract-requests/2026-07-26-partner-freight-mask.md` — add `freightPaidMinor` /
  `billedRevenueTon` / `measuredRevenueTon` to `CONFIDENTIAL_FIELDS` so a `logistics_partner`
  never sees freight cost through `maskFields`. Enforced locally
  (`PartnerPortalService.LOGISTICS_CONFIDENTIAL`) meanwhile.
- `docs/contract-requests/2026-07-26-container-capacity.md` — add
  `CONTAINER_RT_CAPACITY = 28.0` to `policy.ts` (ties to the container-utilisation founder
  decision). Rendered locally meanwhile.
