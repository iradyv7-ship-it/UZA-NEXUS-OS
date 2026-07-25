# Handoff — platform-core (Sprint 0)

Written for an agent with no context. This is the foundation every other module builds
on: identity, the single authorisation enforcement point, the append-only audit log,
notification dispatch, and the transactional outbox event bus. Read this instead of the
code.

Branch: `sprint-0-platform-core`. Stack: NestJS + Prisma + PostgreSQL (`apps/api`),
BullMQ + Redis (`apps/worker`).

---

## How `@uza/contracts` is consumed (the integration wrinkle)

`packages/contracts` ships raw `.ts` whose re-exports use explicit `.ts` extensions
(NodeNext/ESM) and is compiled with `allowImportingTsExtensions` (so it cannot emit a
`dist/`). It is left **unchanged**.

Decision: **tsconfig path alias**, not a build step.
`apps/api/tsconfig.json` maps `@uza/contracts` → `../../packages/contracts/src/index.ts`
with `moduleResolution: bundler` + `allowImportingTsExtensions`. Justification: emitting a
`dist/` would require rewriting the `.ts` extensions (TS 5.6 refuses to emit with
`allowImportingTsExtensions`), i.e. touching the package — forbidden by the guardrails.
The alias keeps contracts pristine, single-source, with zero build-artifact drift.

Runtime uses **SWC** (`node -r @swc-node/register`) because NestJS DI needs
`emitDecoratorMetadata`, which the esbuild-based `tsx` does **not** emit (verified: under
tsx the app boots and maps routes but constructor injection yields `undefined`). SWC
emits the metadata; the server then works. Tests use **Vitest** with
`vite-tsconfig-paths` and instantiate services directly (no DI container needed).

---

## Bring it up

```bash
docker compose up -d                       # Postgres 16 + Redis 7 (root of repo)
pnpm install
cd apps/api
cp .env.example .env                        # values already match docker-compose
node node_modules/prisma/build/index.js migrate deploy   # or: pnpm prisma:migrate
node node_modules/prisma/build/index.js generate
pnpm start                                  # API on :3000  (node -r @swc-node/register)
cd ../worker && pnpm start                  # outbox publisher + BullMQ consumer
```

Run the tests (real Postgres): from `apps/api`, `node node_modules/vitest/vitest.mjs run`.

> Note on this environment: `pnpm exec`/`pnpm run` trigger a pre-run dependency check that
> collides with an auto-generated `allowBuilds:` stub in `pnpm-workspace.yaml`; the
> commands above call the tool binaries directly to avoid it. `.npmrc` sets
> `verify-deps-before-run=false`. The package.json scripts (`pnpm start`, `pnpm test`,
> `pnpm prisma:migrate`) are the intended interface once that stub is removed.

---

## Endpoints exposed (with auth requirements)

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET  | `/health` | liveness + DB ping | none |
| POST | `/auth/login` | email+password (+`mfaCode` when enabled) → `{ accessToken, actor, mfaRequired }` | none (this IS the login) |
| POST | `/identity/organisations` | create organisation | admin (CEO/venture_manager) — guard binding lands with web auth |
| POST | `/identity/offices` | create office | admin |
| POST | `/identity/employees` | create internal employee | admin |
| POST | `/identity/partners` | create partner account (requires future `expiresAt`) | admin |
| POST | `/identity/users/:id/roles` | assign role (append-only history) | admin |

Login returns an `Actor` in the exact `@uza/contracts` shape
(`{ userId, role, office, scope }`). **Assumption:** `Actor.userId` is the readable ref
(e.g. `AGT-GOM-0021`), because that is what other modules carry as `agentId` on orders and
leads, and `inScope` for a sales_agent compares `obj.agentId === actor.userId`.

The JWT guard + `@CurrentActor()` decorator that would protect the `/identity/*` routes
are intentionally **not bound yet** — the web module owns the end-to-end auth flow
(Sprint 4). The authorisation *rules* are already enforceable today via the service below.

## The authorisation service (single enforcement point)

`AuthorizationService.authorize(actor, resource, action, obj?)` — `apps/api/src/platform/authorization/authorization.service.ts`.

- Imports `can`, `inScope`, `maskFields` from `@uza/contracts` (not reimplemented).
- **Throws** `UzaError` on denial; never returns `false`.
  - missing role grant → `ACCESS_DENIED_ROLE`
  - object out of scope → `ACCESS_DENIED_SCOPE`
- **Every denial writes an audit row BEFORE the throw.** Allows are audited too.
- `.mask(actor, record)` applies confidential-field masking on read.

Every other module MUST authorise at its service layer by calling this. Do not put
authorisation in controllers.

## Events published / consumed

Platform-core is infrastructure: it **publishes no business events of its own**
(`EVENT_OWNERS` in contracts assigns none to `platform`). It provides the transactional
outbox that every other module uses to publish, and the worker that drains it.

- `OutboxService.enqueue(tx, name, payload, actorId)` — writes an event row **inside the
  caller's Prisma transaction**. There is no path to publish outside a transaction.
- `OutboxService.emit(actorId, work)` — opens one transaction and gives `work` a bound
  `emit`; state change and events commit or roll back together.

Example envelope written to the outbox (and later delivered to subscribers):

```json
{
  "eventId": "9b1f...uuid",
  "name": "order.created",
  "actorId": "AGT-GOM-0021",
  "occurredAt": "2026-07-24T14:32:02.320Z",
  "payload": {
    "orderRef": "ORD-BULK-2026-0001",
    "customerRef": "CUS-CD-000001",
    "agentId": "AGT-GOM-0021",
    "totalMinor": 100000,
    "tier": "new"
  }
}
```

The worker (`apps/worker`) polls `OutboxEvent(status=pending)`, publishes each to the
BullMQ queue `uza.events`, and marks it `published`. Consumers are **idempotent on
`eventId`**: `processOutboxEvent` claims `(eventId, consumer)` in `ProcessedEvent` before
running the handler, so a redelivered event runs the handler at most once. Subscriber
fan-out to other modules is a no-op today (they don't exist yet); the durable record
already exists in `OutboxEvent` + `ProcessedEvent`.

## Prisma models added (migration `20260724142706_init_platform_core`)

| Model | Notes |
|---|---|
| `Organisation`, `Office` | tenancy + offices; multi-org from day one |
| `User` | employees, customers, partners (`kind`); scope columns mirror `Actor.scope`; `mfaEnabled`/`mfaSecret` (MFA-ready); `expiresAt` (partner/customer expiry); `disabledAt` |
| `RoleAssignment` | append-only role history; revocation stamps `revokedAt` |
| `AuditLog` | **append-only** (`allow`/`deny`); the service exposes inserts only |
| `OutboxEvent` | transactional outbox; `pending`→`published`; unique `eventId` |
| `ProcessedEvent` | idempotency ledger, unique `(eventId, consumer)` |
| `Notification` | dispatch record; one row per recipient for exception fan-out |

## What is real vs stubbed

**Real (tested against Postgres):** the authorisation service (role + scope + audit-before-
throw), the append-only audit log, the transactional outbox (commit + rollback proven),
worker idempotency, identity CRUD, JWT login, partner-account expiry enforcement, role
assignment history, readable-ID formatting, field masking. The API server and worker both
run and were exercised end-to-end over HTTP/Redis.

**Stubbed / deferred (called out honestly):**
- **MFA verification** — columns, the enforcement branch and the `mfaRequired` handshake
  exist; `verifyMfaCode` is a documented placeholder (6-digit check), not real TOTP.
  Swap in `otplib` when MFA rolls out — no schema change needed.
- **JWT guard / `@CurrentActor()` route protection** — not bound; owned by the web auth
  flow. `/identity/*` are admin routes that will sit behind it.
- **Notification delivery** — persists the record + channel; WhatsApp/SMS/web-push
  transport is a later sprint.
- **Subscriber fan-out** — the worker publishes and dedupes; no module subscribes yet.

## Conformance assertions now covered

| ID | Assertion | Where |
|---|---|---|
| CF-001 | Readable IDs follow documented patterns | `test/identity.auth.test.ts` |
| CF-024 | A sales agent cannot read supplier records (denial audited) | `test/authorize.audit.test.ts`, matrix |
| CF-025 | Agent sees customer price, never cost/margin | `test/authorize.audit.test.ts` |
| CF-026 | Partner sees volumetrics, never cost | `test/authorize.audit.test.ts` |
| CF-027 | Customer cannot read another customer's project (scope denial audited) | `test/authorize.audit.test.ts` |

Plus platform-infrastructure guarantees the charter requires (not numbered CF items):
full role×resource authorisation matrix, denial-audited-before-throw, outbox
not-published-on-rollback, worker idempotency.

## Founder decisions (untouched, flagged per guardrails)

Platform-core implements neither. Both live in `policy.ts` defaults and belong to
trade/logistics: **sell incoterm** (quotations surface both CIF and DAP margins until
Badiane decides) and **container utilisation logging** (`daysWaitingForConsolidation`
exists on the `Shipment` contract for logistics to populate). No contract change was
needed for Sprint 0, so no `docs/contract-requests/` entry was filed.
