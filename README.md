# UZA Nexus

The operating layer for UZA Solutions: the register of what the company is doing, who owes
what, what was decided, and where the money is.

TypeScript end to end, in a pnpm workspace. React on the frontend (Next.js and Vite), NestJS
on the backend, PostgreSQL + Prisma, Redis + BullMQ. Node 20+.

---

## Layout

```
backend/
  api/               NestJS HTTP API and the event consumer          → :3000, OpenAPI at /docs
  worker/            Outbox publisher: Postgres → Redis/BullMQ
  contracts/         Shared kernel: types, IDs, roles, permissions, policy constants
  conformance/       Contract-level assertions, no database needed
  supabase/          Database config and migrations for the two Supabase-backed apps
  tools/             Operational scripts (workspace → Nexus task push)
frontend/
  web/               Next.js — the Nexus operator app                  → :3100
  uza-move/          Vite + React — UZA Drive & Earn (mobility)
  empower-academy/   Vite + React — Urugendo Empower Academy
deploy/              Caddyfile for the single-VPS deployment
docker-compose.yml       Local Postgres 16 + Redis 7
docker-compose.prod.yml  Production: postgres, redis, api, worker, web, caddy
```

`backend/contracts` is the only package both sides import. Everything else is strictly one
side or the other.

---

## Running it locally

You need **Node 20+**, **pnpm** (`corepack enable`) and **Docker**.

```bash
pnpm install
docker compose up -d                                    # Postgres + Redis
cp backend/api/.env.example backend/api/.env            # then fill in the three values below
pnpm --filter @uza/api exec prisma migrate deploy
pnpm --filter @uza/api seed:all                         # ONCE, on an empty database only
pnpm dev                                                # api :3000 + web :3100
```

Three values in `backend/api/.env` are mandatory — the API refuses to run parts of itself
without them:

| Variable             | What it does                                                             |
| -------------------- | ------------------------------------------------------------------------ |
| `DATABASE_URL`       | Matches `docker-compose.yml` as shipped                                  |
| `UZA_ID_PEPPER`      | Any non-empty string locally. Person matching refuses to hash without it |
| `MFA_ENCRYPTION_KEY` | Any non-empty string locally. TOTP secrets are encrypted with it         |

`seed:all` is not idempotent. To start over: `pnpm --filter @uza/api db:reset`.

The two Vite apps run on their own: `pnpm --filter @uza/move dev`,
`pnpm --filter @uza/empower-academy dev`. Each reads its Supabase URL and key from its own
`.env` (see `frontend/empower-academy/env-template.txt`).

### Verifying

```bash
pnpm verify        # typecheck + lint + contract conformance + every test suite. Same as CI
curl localhost:3000/health
```

The API suite runs real SQL against a **separate database** named `<your db>_test`, and a
guard refuses to run against any database whose name does not contain `test`, because the
suite truncates tables between files. Set `DATABASE_URL` accordingly, or let the guard derive
it from your `.env`.

CI (`.github/workflows/verify.yml`) runs the same command plus a production build of
`frontend/web`. The build is CI-only because Next's standalone output writes symlinks, which
need Developer Mode on Windows.

---

## Business rules the code must never contradict

These were validated in an executable spike before the first line of TypeScript. Code that
contradicts them is wrong, however elegant.

1. **Payment gates procurement.** An order activates only when the confirmation installment is
   verified by Finance. Never by an agent, never by AI.
2. **Deposit floor is 30%.** New clients 50/50, established clients 30/40/30. Established =
   3 delivered orders. Configured in `policy.ts`, never inline.
3. **Three independent gates block container booking**, in this order: volumetric variance
   resolved → pre-loading installment paid → single destination.
4. **Goods release requires full payment.** Not delivery. Release.
5. **QC state and commercial holds are separate fields.** `qcReleased` and `varianceHold` are
   never collapsed into one status. A conformance test guards this.
6. **Volumetrics are three numbers, never one:** `declared` (factory), `measured` (warehouse),
   `billed` (forwarder). Never overwrite one with another.
7. **Containers are destination-pure.** One container, one destination.
8. **Freight allocates by revenue ton**, `max(cbm, kg/1000)`, not CBM.
9. **Agent commission is 2% on confirmed orders**, reversible by clawback. Every movement is a
   ledger row, never a silent balance edit.
10. **Quoted margin is locked at approval; realized margin is computed from actuals.** Both are
    stored. The quoted figure is never overwritten.
11. **Cost is a ladder, not a number:** EXW → FOB → CIF → DAP, each rung holding an estimate and
    an actual. Margin is reported at the sell incoterm _and_ at DAP.
12. **Confidential fields are masked on read, not filtered in the UI:** supplier cost, PO total,
    target/walkaway price, margin. See `CONFIDENTIAL_FIELDS` in `backend/contracts`.

---

## Architecture rules

- **Contracts first.** Types, event names and payloads, permission grants and policy constants
  live in `backend/contracts` and nowhere else. Duplicating a type locally is the failure mode
  this structure exists to prevent.
- **A feature module never imports another feature module.** `finance` does not import
  `logistics`. Modules communicate by publishing events; the only place allowed to know every
  module at once is the composition root, `backend/api/src/integration/dispatch-map.ts`.
  `platform/*` is the exception in the other direction: everything may import it, and it
  imports no feature module.
- **Authorise at the service layer**, not the route layer. A controller is one way in; events
  and seeds are others, and only the service sees them all.
- **Money is integer minor units.** Never floats. `1234` is $12.34.
- **Financial and event handlers are idempotent**, keyed by event ID.
- **The audit log is append-only.** On a refusal, write the audit row _first_ and outside the
  transaction, so the denial survives the exception about to be raised.
- **Refs come from the highest existing ref, not `count() + 1`.** Use `nextSequence()`.
  Counting collides the moment a row is deleted.
- **Some comments are load-bearing.** The confidentiality rules in `intake/intake-lanes.ts` and
  `platform/lender-view/lender-view-access.ts`, and the pepper note in `uza-id.hash.ts`, encode
  constraints with legal consequences. Keep the constraint if you shorten the prose.

### API module map

```
backend/api/src/
  platform/     auth, authorization, audit, identity, uza-id, lender-view, outbox
  planning/     the register: initiatives, decisions, responsibilities, funding
  umurimo/      the weekly loop: my-week, digest, blockers, comments
  command/      tasks, grants, departments
  trade/ finance/ logistics/ quality/ sourcing/
  intake/       inbound signals and the counterparty walls
  empower/      read-only bridge to the Mobility API
  integration/  the internal event bus and dispatch map
```

### Adding a feature

1. Model it in `backend/api/prisma/schema.prisma`, then
   `pnpm --filter @uza/api exec prisma migrate dev --name <feature>`.
2. Give it a readable ref pattern in `backend/contracts/src/ids.ts`.
3. Write the service. Authorise in it; generate refs with `nextSequence()`.
4. Controller: validate with `class-validator`, call the service, return. No business logic.
5. Register the service in its module and the module in `app.module.ts`.
6. Test it in `backend/api/test/`. Tests instantiate services directly rather than booting
   Nest. `command.test.ts` is the reference shape.

---

## Deployment

### Single VPS (the reference path)

```bash
cp .env.prod.example .env.prod          # fill in on the server; it is gitignored
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.prod exec api \
  sh -c 'SEED_PASSWORD=<choose one> pnpm seed:all'                 # first run only
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
```

Caddy terminates TLS for `NEXUS_DOMAIN`; point an A record at the server before the first
start or certificate issuance fails. Updating is `git pull` and the same `up -d --build`.

Back up nightly and keep 30 days:

```sh
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T postgres \
  pg_dump -U uza uza_nexus | gzip > "backups/uza_nexus_$(date +%F).sql.gz"
find backups -name 'uza_nexus_*.sql.gz' -mtime +30 -delete
```

### Any host

Five processes ship: **Postgres 16**, **Redis 7**, `backend/api`, `backend/worker`,
`frontend/web`. Run the api _and_ the worker, always: the api consumes events, the worker is
the only thing that publishes them. Each has a `Dockerfile`; build from the repository root.

| Process          | Required env                                                                     | Optional env                                                                                                                                                                                                                                         |
| ---------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/api`    | `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `UZA_ID_PEPPER`, `MFA_ENCRYPTION_KEY` | `PORT` (3000), `JWT_TTL` (3600s), `ANTHROPIC_API_KEY` (advisor routes 503 without it), `WEB_ORIGIN` + `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` + `GOOGLE_CALLBACK_URL` (Google sign-in), `GMAIL_*` (intake source), `MOBILITY_*` (Empower bridge) |
| `backend/worker` | `DATABASE_URL`                                                                   | `REDIS_URL`, `OUTBOX_POLL_MS` (2000)                                                                                                                                                                                                                 |
| `frontend/web`   | `UZA_API_URL` — **baked in at build time**; changing it means rebuilding         |                                                                                                                                                                                                                                                      |

Generate secrets with `openssl rand -base64 48`. Rotating `JWT_SECRET` signs everyone out.
Leave `UZA_DOCS_DIR` and `CLAUDE_PROJECTS_DIR` blank on any server; they point at a laptop.

Health: `GET /health` on the api, `GET /login` on the web app, `pg_isready` for Postgres. The
worker has no port — its start log reads `UZA outbox publisher up`.

---

## Known gaps

- Web app test coverage is thin: 23 tests on the pure logic where a mistake is silent
  (masked fields, permission mirrors). Component rendering is untested.
- 29 `count() + 1` ref sites remain in `command`, `finance`, `intake`, `logistics` and
  `quality`. Fixing one is a good first contribution.
- Two founder decisions are still open and surfaced rather than decided: the sell incoterm
  (quotes show both the CIF and DAP margins) and container utilisation (every shipment logs
  `daysWaitingForConsolidation`).
