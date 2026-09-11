# Deployment reference — every piece, any host

This is the complete, host-agnostic picture: what ships, what each piece needs, and how to
run it on whatever you pick — a single VPS, Railway, Render, Fly.io, Vercel, or bare metal.
`deploy/README.md` remains the fastest concrete path (one VPS, Docker Compose, Caddy for
TLS) — this document is what you read to go anywhere else, or to understand what that path
is actually doing underneath.

Nothing here is provider-specific. Every piece is a plain Docker image (or, for the web
app, a plain Next.js build) that reads its configuration from environment variables. Move
any of them to any host that can run a container and reach Postgres + Redis over the
network, and it works identically.

---

## 1. What actually ships

Five things. Miss the fourth and the system runs, looks fine, and silently does nothing
async — see the callout below.

| # | Process | What it is | Talks to |
|---|---|---|---|
| 1 | **Postgres 16** | The one copy of the register. Everything. | — |
| 2 | **Redis 7** | The BullMQ event queue. | — |
| 3 | **`apps/api`** (NestJS) | HTTP API + the event **consumer** (fans a published event out to services — commission accrual, invoice creation, notifications). | Postgres, Redis |
| 4 | **`apps/worker`** | The outbox **publisher**. Polls Postgres for committed `OutboxEvent` rows and publishes each to the Redis/BullMQ queue exactly once. | Postgres, Redis |
| 5 | **`apps/web`** (Next.js) | The browser-facing app. Server components call `apps/api` over plain HTTP; the browser never talks to the API directly. | `apps/api` |

### The rule that isn't obvious from the code: run #3 *and* #4, always

`apps/api`'s `EventConsumer` only ever reads from the BullMQ queue — it never touches the
outbox table. `apps/worker` is the *only* process that calls `drainOutbox()` (see its own
doc comment in `apps/worker/src/main.ts`). If `apps/worker` isn't running, every
`OutboxEvent` row sits `status = pending` in Postgres forever, `EventConsumer` never
receives anything, and nothing that depends on an event fires — no commission accrual on
order confirmation, no invoice created from `order.created`, no notification. The API
itself looks completely healthy the whole time; there is no error, just silence.

**This was missing from `docker-compose.prod.yml` until this change** — the single-VPS
path now runs it correctly as a fifth container (`worker`), with its own `Dockerfile`
alongside `apps/api` and `apps/web`'s. If you deploy by hand to a different host, add
`apps/worker` as its own always-on process (a second Railway/Render service, a second Fly
machine, a second systemd unit — whatever your host calls "one more long-running
process"). It needs no public port and no health-check endpoint of its own; it either
connects to Postgres and Redis or it doesn't.

---

## 2. Environment variables — the complete reference

Every variable actually read by the code, cross-checked against `apps/api/src`,
`apps/worker/src`, and `apps/web/src` directly (not just against what an example file
happens to list). **Bold** = the process refuses to do its job correctly without it.

### `apps/api`

| Variable | Required | Generate with | Used for |
|---|---|---|---|
| **`DATABASE_URL`** | Yes | — (your Postgres connection string) | Everything. `postgresql://user:pass@host:5432/dbname?schema=public` |
| **`JWT_SECRET`** | Yes | `openssl rand -base64 48` | Signs session tokens. Rotating it signs everyone out — not a casual rotation. |
| **`UZA_ID_PEPPER`** | Yes | `openssl rand -base64 48` | Peppers the UZA ID hash. The API refuses to hash-match a person without it. |
| **`MFA_ENCRYPTION_KEY`** | Yes | `openssl rand -base64 48` | Encrypts TOTP secrets at rest. Refuses to enroll/verify MFA without it. |
| `PORT` | No (default `3000`) | — | HTTP listen port |
| `JWT_TTL` | No (default `3600s`) | — | Session token lifetime |
| `REDIS_URL` | Yes | — | `redis://host:6379`. Without it the API still serves, but logs `ECONNREFUSED` continuously trying to open its BullMQ connection. |
| `DISABLE_EVENT_CONSUMER` | No | — | Set to disable the in-process `EventConsumer` (fan-out). Leave unset in every normal deployment — see §1. |
| `ANTHROPIC_API_KEY` | No | — | Powers the two AI advisor routes and intake triage. Absent ≠ boot failure; those routes return `503` instead. |
| `WEB_ORIGIN` | Only if Google sign-in is enabled | — | Where the browser lands after Google auth succeeds — the web app's own origin, e.g. `https://nexus.example.com` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Only for Google sign-in | Google Cloud Console → Credentials → OAuth 2.0 Client ID (Web application) | Enables `/auth/google/*`. All blank → those routes answer `503 google_signin_not_configured`, everything else works. |
| `GOOGLE_CALLBACK_URL` | Only for Google sign-in | — | Must equal, byte-for-byte, the web app's `/auth/google/return` route — this exact value is what you register in Google Cloud Console. |
| `UZA_DOCS_DIR` | No | — | Intake source: a local documents folder. Leave blank on any real server — this points at the founder's own laptop, not infrastructure. |
| `CLAUDE_PROJECTS_DIR` | No | — | Intake source: local Claude Code transcripts. Same reasoning — leave blank on a server. |
| `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` / `GMAIL_REFRESH_TOKEN` / `GMAIL_QUERY` | No | — | Intake's read-only Gmail source. All four blank = skipped, reported as unconfigured. |
| `SEED_PASSWORD` | First run only | Choose your own — never invent a default | Passed as a one-off `-e` to the seed scripts, not a standing service env var. |

### `apps/worker`

| Variable | Required | Notes |
|---|---|---|
| **`DATABASE_URL`** | Yes | Same database as `apps/api` — the outbox table lives there. |
| `REDIS_URL` | No (default `redis://localhost:6379`) | Same Redis as `apps/api`. |
| `OUTBOX_POLL_MS` | No (default `2000`) | How often it checks Postgres for newly-committed events. |

### `apps/web`

| Variable | Required | Notes |
|---|---|---|
| **`UZA_API_URL`** | Yes | The one variable that matters. Points at wherever `apps/api` is reachable — e.g. `http://api:3000` inside a compose network, or a public `https://api.example.com` if `apps/web` and `apps/api` live on different hosts. **Baked in at build time** (`next.config.mjs` uses `env:`, which inlines rather than reading live) — pass it as a Docker build arg, or as the host's build-time env var (Vercel, Railway, etc. all support this). Changing it means rebuilding, not just restarting. |
| `UZA_SEED_AGENT_EMAIL` / `UZA_SEED_AGENT_PASSWORD` | No | Optional convenience for a demo-seeding dashboard action. Leave unset in production. |

Every one of these was found by grepping `process.env` directly in each app's `src/`
(not copied from an example file), so this table won't silently miss one the code
actually reads.

---

## 3. Build once, run anywhere

Each app is a standard multi-stage Docker build with no host-specific assumptions.
From the **repo root** (the build context matters — each Dockerfile reaches back into
`packages/contracts`):

```bash
docker build -f apps/api/Dockerfile    -t uza-api    .
docker build -f apps/worker/Dockerfile -t uza-worker .
docker build -f apps/web/Dockerfile    -t uza-web    --build-arg UZA_API_URL=https://api.example.com .
```

Run them with the env vars from §2 however your host wants them (compose file, dashboard
env-var UI, `docker run -e`, a Kubernetes `Secret`/`ConfigMap` — the images don't care):

```bash
docker run -p 3000:3000 --env-file api.env    uza-api
docker run                --env-file worker.env uza-worker
docker run -p 3100:3100 --env-file web.env    uza-web
```

This is exactly what `docker-compose.prod.yml` does, wired together on one machine's
internal network. Point the same three images at a managed Postgres and Redis instead of
the `postgres`/`redis` containers, and they run identically split across three different
hosts.

### Migrations

`apps/api`'s own container runs `prisma migrate deploy` on every start, before the server
comes up (see its `Dockerfile`'s `CMD`) — committed migrations only, never prompts, never
resets. If you'd rather run migrations as a separate release step (common on Railway/
Render/Fly), the command is:

```bash
DATABASE_URL=<your prod URL> pnpm --filter @uza/api exec prisma migrate deploy
```

### Seeding (first run only)

```bash
pnpm exec tsx prisma/seed-org.ts          # order matters: org before pipeline before register
pnpm exec tsx prisma/seed-bulk-pipeline.ts
pnpm exec tsx prisma/seed-register.ts
SEED_PASSWORD='<choose one>' pnpm exec tsx prisma/seed-users.ts
```

Ten accounts, `firstname@uzasolutions.rw`. Re-running never resets a password someone has
already changed — if the temporary one was wrong, delete the user row and reseed.

---

## 4. Datastore requirements

| | Version | Connection shape | Notes |
|---|---|---|---|
| **Postgres** | 16 (matches dev and the reference deploy — see `docs/TOOLING.md`) | `postgresql://user:pass@host:5432/db?schema=public` | Any managed Postgres works — Neon, Supabase, RDS, Railway's own, a VPS's own container. Nothing in the schema is provider-specific. |
| **Redis** | 7 | `redis://host:6379` (add `rediss://` + auth for TLS-enabled managed Redis) | Any managed Redis works — Upstash, Railway's own, a VPS's own container. |

---

## 5. Ports and health

| Process | Port | Health check |
|---|---|---|
| `apps/api` | `3000` (configurable via `PORT`) | `GET /health` → `{"status":"ok"}` |
| `apps/worker` | none — no server | Check its logs: `UZA outbox publisher up. Polling outbox every …` on start, and no repeating errors |
| `apps/web` | `3100` | `GET /login` should render (redirects to `/` → `/login` when signed out) |
| `postgres` | `5432` | `pg_isready` |
| `redis` | `6379` | `redis-cli ping` |

---

## 6. Two concrete paths already set up in this repo

**One VPS, everything together** — `deploy/README.md` + `docker-compose.prod.yml`. Caddy
terminates TLS and is the only exposed port; Postgres, the API, the worker and the web app
publish nothing to the host. Right-sized for where UZA is today (ten people); the
deliberate tradeoff is documented in that file's own "what is deliberately not here"
section.

**Web on Vercel, everything else wherever you pick** — `apps/web`'s `Root Directory` set
to `apps/web` in the Vercel dashboard, `UZA_API_URL` set to wherever you deploy
`apps/api`. Vercel is a strong fit for the Next.js app specifically; it is **not** a fit
for `apps/api` or `apps/worker` as they're built today — both are long-running processes
(a live DB connection pool, a polling loop), not request/response serverless functions.
Put those two on Railway, Render, Fly.io, or the same VPS approach above, and point
`UZA_API_URL` at whichever one you choose.

Either way, the environment variable table in §2 is the same — nothing about a variable's
name or purpose changes based on where the container runs.

---

## 7. What never moves from dev to prod

Every value currently in `apps/api/.env` on a laptop (`dev-only-change-me`,
`uza_dev_pw`, `test-pepper-not-a-real-secret`) is a placeholder that says so in its own
name. Generate fresh values for `JWT_SECRET`, `UZA_ID_PEPPER`, `MFA_ENCRYPTION_KEY`, and
the Postgres password with the `openssl rand -base64 48` commands above — reusing a dev
secret in production is the same as not having one.
