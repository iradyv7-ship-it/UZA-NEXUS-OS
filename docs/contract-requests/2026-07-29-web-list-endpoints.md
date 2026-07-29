# Contract request — list/work-queue read endpoints for the web dashboards

**Date:** 2026-07-29
**From:** frontend (Sprint 4b web vertical slice)
**Status:** IMPLEMENTED (2026-07-29, branch `web2-list-endpoints`)

> **Implementation note.** Delivered as new trade service methods + controller routes only —
> **no `packages/contracts` change**. Added `GET /projects` (+ `?customerRef=&stage=`),
> `GET /projects/:ref`, `GET /quotations` (+ `?projectRef=&status=`), `GET /orders`
> (+ `?status=&customerRef=`), each authorised at the service layer and masked per row.
> Object-scope is a Prisma WHERE predicate (`apps/api/src/trade/list-scope.ts`) that mirrors
> `inScope` exactly, verified by an agreement test. Pagination is `limit` (default 20,
> max 100) + `offset` with a stable `updatedAt desc` sort. The requested `?owner=` project
> filter was not added (not needed by the dashboard; `stage` + `customerRef` suffice); it can
> be added as another AND-composed filter if required. See `docs/handoff/api-surface.md`.
> The web slice can now drop the worklist-cookie workaround.

## Problem

The API surface (`docs/handoff/api-surface.md`) exposes **GET-by-ref only**. There is no
`GET /quotations`, `GET /orders`, or `GET /projects` list, and no `GET /projects/:ref`.

The venture_manager dashboard's core job is to show **the records a user owns** with each
one's stage, next action and responsible owner. With only GET-by-ref, the client cannot
discover which records exist — it can only re-read refs it already knows. The 4b slice
works around this with a per-user "worklist" cookie of refs the user has created/tracked,
fetching each live. That is a stopgap, not a real work queue: a manager who logs in on a
new device sees nothing until they paste refs.

## Requested

Scoped, masked list endpoints mirroring the existing read authorisation/masking:

- `GET /projects?owner=&customerRef=&stage=` → the caller's in-scope projects.
- `GET /quotations?projectRef=&status=` → in-scope quotations (cost/margins masked as today).
- `GET /orders?status=&customerRef=` → in-scope orders.
- `GET /projects/:ref` → a single project read (name/owner/stage), so a tracked ref can
  render a project name instead of only a record type.

All must enforce the same object-scope and `maskFields` as the by-ref reads — the list is a
different query, not a different security posture. Pagination (cursor or limit/offset) and a
stable default sort (most-recently-updated) would let the dashboard drop the worklist cookie
entirely.

## Meanwhile

The web slice proceeds against the worklist-cookie workaround, clearly flagged as stubbed in
`docs/handoff/web-slice.md`. No `packages/contracts` change was made.
