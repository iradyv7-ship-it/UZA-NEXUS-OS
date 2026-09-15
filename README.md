# UZA Nexus

The operating layer for UZA Solutions: the register of what the company is doing, who owes
what, what was decided, and where the money is.

## How it works

Five processes make up the platform:

| Process | Role |
|---|---|
| `backend/api` | HTTP API. Every business rule, authorisation check and database write lives here. Also consumes events from the queue. |
| `backend/worker` | Outbox publisher. Moves committed events from Postgres to the Redis queue, exactly once. |
| `frontend/web` | The operator app. Its server calls the API over HTTP; the browser never talks to the API directly. |
| PostgreSQL 16 | The one copy of the register. |
| Redis 7 | The event queue (BullMQ). |

Modules inside the API never import each other. A module writes an `OutboxEvent` in the same
transaction as its data; the worker publishes it; the API's consumer hands it to whichever
modules subscribed. `backend/contracts` holds the types, event names, roles and policy
constants every module agrees on.

The two Vite apps (`uza-move`, `empower-academy`) are standalone React apps backed by
Supabase; their database migrations live in `backend/supabase/`.

## Stack

| | |
|---|---|
| Language | TypeScript everywhere, Node 20+, pnpm workspaces |
| Backend | NestJS · Prisma · BullMQ · PostgreSQL · Redis |
| Frontend | React 19 — Next.js 15 (`web`), Vite + TanStack Router (`uza-move`, `empower-academy`) · Tailwind CSS |
| Tests | Vitest · `node:test` for the contract conformance suite |
| Deploy | Docker Compose behind Caddy, one host |

## Code structure

`backend/` and `frontend/` are independent pnpm workspaces. Each has its own `package.json`,
lockfile, ESLint and Prettier config, and is installed, tested and built from inside its own
folder. Only `.github/` (CI, which GitHub requires at the root) and this file sit above them.

```
backend/
  api/                 NestJS
    prisma/            schema, migrations, seeds
    src/
      platform/        auth, authorization, audit, identity, uza-id, outbox
      planning/        the register: initiatives, decisions, responsibilities, funding
      umurimo/         the weekly loop: my-week, digest, blockers
      command/         tasks, grants, departments
      trade/ finance/ logistics/ quality/ sourcing/
      intake/          inbound signals and counterparty walls
      empower/         read-only bridge to the Mobility API
      integration/     event bus and the dispatch map (the only file that knows every module)
    test/              service-level tests against a real Postgres
  worker/              outbox publisher
  contracts/           shared kernel: types, IDs, roles, permissions, policy
  conformance/         contract assertions, no database
  supabase/            migrations for the two Supabase-backed apps
  tools/               operational scripts
  docker-compose.yml        local Postgres + Redis
  docker-compose.prod.yml   production stack
  deploy/Caddyfile

frontend/
  web/                 Next.js (App Router)
    src/app/           routes
    src/lib/           api client, session, permission mirrors, formatting
  uza-move/            Vite + React — UZA Drive & Earn
  empower-academy/     Vite + React — Urugendo Empower Academy
    src/routes/        file-based routes
    src/components/    UI
    src/integrations/  Supabase client
```

## Commands

```bash
cd backend && pnpm install && docker compose up -d && pnpm dev     # API on :3000
cd frontend && pnpm install && pnpm dev                              # web on :3100
pnpm verify                                                          # in either folder: typecheck, lint, tests
```

`backend/api/.env.example` lists the API's environment; `DATABASE_URL`, `UZA_ID_PEPPER` and
`MFA_ENCRYPTION_KEY` are mandatory.
