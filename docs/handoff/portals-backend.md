# Portals backend — customer + Imari partner

Enables the two external portals with one new backend endpoint plus dev seed data.
Branch `portals-backend`.

## New endpoint

`GET /partner-portal/shipments?limit=&offset=` → the caller's in-scope shipments
(`ref ∈ actor.scope.shipmentRefs`), masked exactly like the by-ref partner read
(freight cost fields `freightPaidMinor`, `billedRevenueTon`, `measuredRevenueTon` → `***`).

- Authorised at the service layer: `authorize(actor, 'shipment', 'read')` (role grant, no
  object → 403 if the role lacks `shipment:read`), then object-scope via a WHERE predicate.
- Object-scope predicate: `shipmentScopeWhere` in `apps/api/src/logistics/list-scope.ts`,
  a mechanical MIRROR of `inScope` for a `Shipment` (which is scoped by its own `ref`).
  A `Shipment` carries no `customerRef`/`agentId`, so the `customer`/`sales_agent` branches
  admit nothing; the `logistics_partner` branch is `ref ∈ scope.shipmentRefs`. The
  `partner shipments list agrees with inScope` test pins the predicate to `inScope`.
- Sort `updatedAt desc`; `limit` default 20, max 100; `offset` default 0. Validated DTO.
- The list route is declared BEFORE `shipments/:ref` in the controller.

## Seeded portal users (`apps/api/seed-web.ts`, idempotent)

| Email | Password | Role | Scope | Sees |
|---|---|---|---|---|
| `customer@uza.rw` | `password1` | `customer` | `scope.customerId = CUS-WEB-000001` | their project/quotation/order (`ORD-WEB-2026-0001`) + invoice (`INV-WEB-2026-0001`), can pay |
| `partner@uza.rw` | `password1` | `logistics_partner` | `scope.shipmentRefs = [SHP-WEB-2026-0001]` | that shipment, its 2 packages (kg/CBM), a delivery; freight cost masked |

Demo data created behind them (fixed `*-WEB-*` refs, so re-runs are no-ops):

- Commercial chain: customer → lead → request → project → approved quotation → order
  (+ 50/30/20 installments) → issued invoice (+ installments). Order status
  `awaiting_payment` so the customer can pay.
- Logistics chain: shipment `SHP-WEB-2026-0001` (KIGALI, partner `PARTNER-IMARI`,
  freight figures present in the DB but masked on read) + warehouse receipt + 2 received
  packages (destination-pure KIGALI, `qcReleased`, no `varianceHold`) + a delivery.

The partner account is a `createPartnerAccount` (expires 2030-01-01, per the
partner-accounts-expire rule). All demo data is written by direct Prisma upsert so the
seed is deterministic and idempotent.

## Note

The dev DB (`uza_nexus`) is shared with the Vitest suite, which TRUNCATEs tables in
`resetDb()`. Re-run `node -r @swc-node/register seed-web.ts` after running the test suite
to restore portal data.
