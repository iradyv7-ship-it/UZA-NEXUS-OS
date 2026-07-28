# Tracked follow-ups

Items surfaced during sprint reviews that are intentionally deferred, so they are
not forgotten. Each names the sprint that must close it.

| # | Item | Raised by | Owner sprint | Notes |
|---|------|-----------|--------------|-------|
| 1 | Bind an auth guard on `/identity/*` admin routes (`organisations`, `offices`, `employees`, `partners`, `users/:id/roles`). Today they carry no route guard or service-layer `authorize()` call. | contracts-guardian, Sprint 0 review | Sprint 4 (frontend-mobile / web auth flow) | Non-blocking now: no dependent data or module exists. Authorisation *rules* are already enforceable via `AuthorizationService.authorize()`; only the route binding is deferred. Documented in `docs/handoff/platform.md`. |
| 2 | Replace MFA verification placeholder (`verifyMfaCode`) with real TOTP (`otplib`). | platform-core handoff, Sprint 0 | Any sprint; no schema change | Structure/columns are MFA-ready; only verification logic is stubbed. |
| 3 | Wire notification *delivery* transport + subscriber fan-out. | platform-core handoff, Sprint 0 | When first consumer subscribes | Dispatch records are durable today; nothing subscribes yet. |
| 4 | ~~Wire the worker's outbox subscriber fan-out so published events actually reach consumer modules.~~ **DONE** (2026-07-28, merge `a670427`). Fan-out lives in `apps/api/src/integration/` (composition root); worker is publisher-only; BullMQ retry + dead-letter failure policy; end-to-end integration test. | Sprints 1–2 handoffs | ✅ done | — |
| 7 | Build a dead-letter drain/replay tool for outbox events whose fan-out exhausted its BullMQ retries (`removeOnFail: false` keeps them). | fan-out integration, 2026-07-28 | later | The events sit durably in the failed set; no operator tooling to inspect/replay them yet. |
| 8 | Replace the `count()+1` readable-id convention with a monotonic per-(kind,year) DB sequence. | noted across module handoffs | later | Collision-free under the single-writer model today; a real sequence is needed before concurrent writers. |
| 5 | Drop or wire the dead `InvoiceInstallment.settledEventId` column (service writes `settledByPaymentRef` instead). | contracts-guardian, Sprint 2 review | Any sprint; needs a small migration | Cosmetic schema debt; not drift. |
| 6 | Enforce the signed **agent-agreement** gate before `CommissionService.recordPayout` writes a payout row. | finance-commission, Sprint 2 | Before first commission payout | Legal/business gate, not pure code — depends on the founder decision. |
