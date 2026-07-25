# Tracked follow-ups

Items surfaced during sprint reviews that are intentionally deferred, so they are
not forgotten. Each names the sprint that must close it.

| # | Item | Raised by | Owner sprint | Notes |
|---|------|-----------|--------------|-------|
| 1 | Bind an auth guard on `/identity/*` admin routes (`organisations`, `offices`, `employees`, `partners`, `users/:id/roles`). Today they carry no route guard or service-layer `authorize()` call. | contracts-guardian, Sprint 0 review | Sprint 4 (frontend-mobile / web auth flow) | Non-blocking now: no dependent data or module exists. Authorisation *rules* are already enforceable via `AuthorizationService.authorize()`; only the route binding is deferred. Documented in `docs/handoff/platform.md`. |
| 2 | Replace MFA verification placeholder (`verifyMfaCode`) with real TOTP (`otplib`). | platform-core handoff, Sprint 0 | Any sprint; no schema change | Structure/columns are MFA-ready; only verification logic is stubbed. |
| 3 | Wire notification *delivery* transport + subscriber fan-out. | platform-core handoff, Sprint 0 | When first consumer subscribes | Dispatch records are durable today; nothing subscribes yet. |
