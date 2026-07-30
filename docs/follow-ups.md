# Tracked follow-ups

Items surfaced during sprint reviews that are intentionally deferred, so they are
not forgotten. Each names the sprint that must close it.

| # | Item | Raised by | Owner sprint | Notes |
|---|------|-----------|--------------|-------|
| 1 | ~~Bind an auth guard on `/identity/*` admin routes and role-gate them.~~ **DONE** (Sprint 4a, commit `5ff4394`). Global JWT guard + `@CurrentActor`; `IdentityService` now calls `authorize(actor, ...)` on every mutation (ceo-only), denials audited before throw, role assigner is the authenticated actor. | contracts-guardian, Sprint 0 review | ✅ done | — |
| 2 | Replace MFA verification placeholder (`verifyMfaCode`) with real TOTP (`otplib`). | platform-core handoff, Sprint 0 | Any sprint; no schema change | Structure/columns are MFA-ready; only verification logic is stubbed. |
| 3 | Wire notification *delivery* transport + subscriber fan-out. | platform-core handoff, Sprint 0 | When first consumer subscribes | Dispatch records are durable today; nothing subscribes yet. |
| 4 | ~~Wire the worker's outbox subscriber fan-out so published events actually reach consumer modules.~~ **DONE** (2026-07-28, merge `a670427`). Fan-out lives in `apps/api/src/integration/` (composition root); worker is publisher-only; BullMQ retry + dead-letter failure policy; end-to-end integration test. | Sprints 1–2 handoffs | ✅ done | — |
| 7 | Build a dead-letter drain/replay tool for outbox events whose fan-out exhausted its BullMQ retries (`removeOnFail: false` keeps them). | fan-out integration, 2026-07-28 | later | The events sit durably in the failed set; no operator tooling to inspect/replay them yet. |
| 8 | Replace the `count()+1` readable-id convention with a monotonic per-(kind,year) DB sequence. | noted across module handoffs | later | Collision-free under the single-writer model today; a real sequence is needed before concurrent writers. |
| 9 | ~~Add `GET` list/work-queue endpoints (scoped + masked).~~ **DONE** (Web Sprint 2, merges `ebbecfb` backend + `70db070` dashboard). `GET /projects`, `/quotations`, `/orders`, `/projects/:ref` — scope predicate mirrors `inScope`, per-row masking, pagination; dashboard rewired to a live queue, worklist cookie retired. | frontend web slice, 2026-07-29 | ✅ done | Remaining nicety: offset paging + status-filter chips beyond the first 100 rows. |
| 10 | Web: remaining role dashboards. **Customer portal + Imari partner portal DONE** (2026-07-30, merge `acb259a`); payment-capture UI DONE (`afba64c`). Still to build: Cecilia (sourcing), Adeline (front office) dashboards, quotation-revise UI, and the offline inspection/receiving flow. | web slice handoff | ongoing | `docs/handoff/web-slice.md` lists the build order. |
| 11 | Harden cross-role portal isolation to a hard redirect (currently a soft in-page redirect: HTTP 200 + client redirect, no data leak since the API scopes non-owners to empty). Move the role guard to middleware/layout for a 3xx. | portals-web, 2026-07-30 | later | Non-urgent: no data leaks today; the API is the boundary. |
| 12 | Add a customer-facing `GET /projects/:ref` project-detail route + web screen (customer projects are currently read-only name/stage/owner). | portals-web, 2026-07-30 | later | — |
| 5 | Drop or wire the dead `InvoiceInstallment.settledEventId` column (service writes `settledByPaymentRef` instead). | contracts-guardian, Sprint 2 review | Any sprint; needs a small migration | Cosmetic schema debt; not drift. |
| 6 | Enforce the signed **agent-agreement** gate before `CommissionService.recordPayout` writes a payout row. | finance-commission, Sprint 2 | Before first commission payout | Legal/business gate, not pure code — depends on the founder decision. |
