# Sprint 1 Plan — trade-flow ‖ sourcing-quality

Approved decisions carried into the build. Both modules build on `docs/handoff/platform.md`,
authorise at the service layer via `AuthorizationService.authorize()`, publish only their
owned events (`EVENT_OWNERS`) through the transactional outbox, and keep `packages/contracts`
untouched (file `docs/contract-requests/` entries instead).

## Locked decisions
- **Invoice ownership:** Finance owns it (Sprint 2). trade-flow stops at `order.created` +
  installment-schedule generation. Finance later subscribes to `order.created`, creates the
  Invoice, and drives `payment.verified`; trade subscribes back to mark installments paid and
  flip the order to `procurement_active` on the `confirmation` trigger.
- **Money:** `Minor` integers everywhere (reference uses floats — translate).

## Module A — trade-flow (`apps/api/src/trade/`)
Models: Customer, Lead (raw WhatsApp text + `clarified`), Request, Project, Task (RACI
accountable/responsible), Quotation (versioned; embeds CostLadder; `marginPct` locked at
approval; separate nullable `realizedMargin`), Order, Installment.
Publishes: `lead.created`, `request.created`, `quotation.approved`, `order.created`,
`order.cancelled`. Consumes (handlers built now, tested with synthetic envelopes):
`payment.verified`.
Rules: price at sell incoterm + always expose `dapMargin`; apply `FREIGHT_CONTINGENCY`;
installments from `scheduleFor` + `splitInstallments`, deposit ≥ `MIN_DEPOSIT`; `maskFields`
on every read path.
Conformance: CF-002, CF-003, CF-005, CF-006, CF-029 (elevate to API tests) + CF-004 (new).
Likely contract-request: `targetPrice`/`walkaway` factors (reference `0.92`/`1.05`) → policy.ts.

## Module B — sourcing-quality (`apps/api/src/sourcing/` + `apps/api/src/quality/`)
Models: Supplier (EN+CN names, lifecycle, certifications, price/quality history, score), Rfq,
SupplierQuote (`inlandSeparable` + `basis`), PurchaseOrder (declaredCbm/Kg), Visit, Inspection
(stages pre-production/during-production/pre-shipment/warehouse; critical/major/minor; evidence
bound to lot + package refs), CAPA.
Publishes: `po.issued`, `inspection.recorded`, `quality.failed`, `capa.closed`. Consumes
(built now, synthetic-tested): `warehouse.receiptRecorded` → supplier-score adjustment.
Rules: critical defect fails inspection + auto-opens CAPA + project red, no override; CAPA
closes only on human-approved passing reinspection; score moves only on logged evidence;
evidence attached to lot/package refs; every write path tolerates offline capture + later sync
(client idempotency key).
Conformance: CF-011, CF-012; CF-015 mechanism-ready (full coverage when warehouse lands).
Likely contract-request: `INSPECTION_THRESHOLDS` (reference's `major > 2 ⇒ conditional`) → policy.ts.

## Orchestration
Each agent works on its own branch (`sprint-1-trade-flow`, `sprint-1-sourcing-quality`), touches
only its own directories, adds models in its own migration, registers its own Nest feature module,
and does NOT edit the other's files or the shared `AppModule`. The CTO owns the integration commit:
merge trade first, then sourcing, resolve `schema.prisma` / `AppModule` seams, run one combined
migration, and get the full suite green before the review gate.

## Definition of done
Migrations exist · every new service op authorised + tested · module conformance assertions pass
against real Postgres · oracle still 30/30 · both handoffs written · contracts-guardian (no
Criticals) + conformance-runner (clean) · merged to master.
