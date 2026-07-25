# Tracked follow-ups

Items surfaced during sprint reviews that are intentionally deferred, so they are
not forgotten. Each names the sprint that must close it.

| # | Item | Raised by | Owner sprint | Notes |
|---|------|-----------|--------------|-------|
| 1 | Bind an auth guard on `/identity/*` admin routes (`organisations`, `offices`, `employees`, `partners`, `users/:id/roles`). Today they carry no route guard or service-layer `authorize()` call. | contracts-guardian, Sprint 0 review | Sprint 4 (frontend-mobile / web auth flow) | Non-blocking now: no dependent data or module exists. Authorisation *rules* are already enforceable via `AuthorizationService.authorize()`; only the route binding is deferred. Documented in `docs/handoff/platform.md`. |
| 2 | Replace MFA verification placeholder (`verifyMfaCode`) with real TOTP (`otplib`). | platform-core handoff, Sprint 0 | Any sprint; no schema change | Structure/columns are MFA-ready; only verification logic is stubbed. |
| 3 | Wire notification *delivery* transport + subscriber fan-out. | platform-core handoff, Sprint 0 | When first consumer subscribes | Dispatch records are durable today; nothing subscribes yet. |
| 4 | Wire the worker's outbox subscriber fan-out so published events actually reach consumer modules: `order.created`/`order.cancelled` → finance; `payment.verified` → trade; `warehouse.receiptRecorded` → sourcing; `shipment.billedWeightRecorded` → finance claims. | Sprints 1–2 handoffs | Sprint 3 / integration | All consumer handlers exist and are idempotent, tested with synthetic envelopes; only the real worker delivery is unwired. |
| 5 | Drop or wire the dead `InvoiceInstallment.settledEventId` column (service writes `settledByPaymentRef` instead). | contracts-guardian, Sprint 2 review | Any sprint; needs a small migration | Cosmetic schema debt; not drift. |
| 6 | Enforce the signed **agent-agreement** gate before `CommissionService.recordPayout` writes a payout row. | finance-commission, Sprint 2 | Before first commission payout | Legal/business gate, not pure code — depends on the founder decision. |
