# UZA Nexus

The operating layer for UZA Solutions: the register of what the company is doing, who owes
what, what was decided, and where the money is. NestJS API + Next.js web app + Postgres +
Redis, in a pnpm monorepo.

**New here? Read this page top to bottom.** It is written to get you productive in an hour,
not to describe the architecture in the abstract.

---

## Running it, in five minutes

You need **Node 20+**, **pnpm** and **Docker**.

```bash
pnpm install
docker compose up -d                                  # Postgres + Redis
cp apps/api/.env.example apps/api/.env                # then open it, see below
pnpm --filter @uza/api exec prisma migrate deploy
pnpm --filter @uza/api seed:all                       # ONCE, on an empty database only
pnpm dev
```

- API → <http://localhost:3000>, OpenAPI docs at **`/docs`**
- Web → <http://localhost:3100>

Two things in `apps/api/.env` that are not optional:

| | |
|---|---|
| `DATABASE_URL` | Matches `docker-compose.yml`. Usually correct as shipped |
| `UZA_ID_PEPPER` | **Any non-empty string locally.** The UZA ID refuses to hash without one, and the failure message is not obvious |
| `MFA_ENCRYPTION_KEY` | **Any non-empty string locally.** TOTP secrets are encrypted with it, and a missing key now throws rather than failing quietly |

**`seed:all` is not idempotent.** Run it on an empty database only. To start over:
`pnpm --filter @uza/api db:reset`.

### Check it actually works

```bash
pnpm verify        # typecheck + every test, both apps. The same command CI runs
curl localhost:3000/health
```

**340 tests: 317 on the API, 23 on the web app.** `pnpm verify` is deliberately identical
to the CI job, so a red pipeline reproduces locally with one command instead of guessing
which flags it used.

Tests need Postgres running. They use a **separate database** (`<your db>_test`), and a guard
refuses to run against anything whose name does not contain `test` — because the suite
truncates tables, and it once emptied the development database twice before anyone worked out
why.

---

## How the code is organised

```
apps/api/src/
  platform/     foundation: auth, authorization, audit, identity, uza-id, lender-view
  planning/     the register: initiatives, decisions, responsibilities, funding
  umurimo/      the weekly loop: my-week, digest, blockers, comments
  command/      tasks, grants, departments
  trade/  finance/  logistics/  quality/  sourcing/
  intake/       inbound signals, and the counterparty walls
  integration/  the internal event bus
packages/contracts/       shared types, ID patterns, roles, permissions
apps/web/src/app/(app)/   18 pages
```

**One rule explains the whole layout, and breaking it is the main way to make a mess here:**

> **A feature module never imports another feature module.**
>
> `finance` does not import `logistics`. They communicate by publishing events, and the only
> place allowed to know every module at once is the composition root,
> `integration/dispatch-map.ts`.
>
> `platform/*` is the exception in the other direction: everything may import it, and it
> imports no feature module.

If you find yourself writing `import { OrderService } from '../trade/...'` inside `finance`,
that is the signal to publish an event instead.

---

## Adding a feature — a worked example

Say you are adding **vehicle inspections** to the register.

**1 · Model it** in `apps/api/prisma/schema.prisma`, then:

```bash
pnpm --filter @uza/api exec prisma migrate dev --name inspections
```

**2 · Give it a readable ref** in `packages/contracts/src/ids.ts`:

```ts
inspectionRecord: 'INSP-{year}-{seq:4}',
```

**3 · Write the service** — `apps/api/src/planning/inspection/inspection.service.ts`. Two
things every service here does:

```ts
// Authorise at the SERVICE layer, not only in the controller. A controller is one way in;
// events and seeds are others, and only the service sees them all.
await this.access.require(actor, 'inspection:create');

// Generate the ref from the HIGHEST EXISTING REF, never count() + 1. See below.
const seq = await nextSequence(this.prisma.inspectionRecord, refPrefix('INSP'));
```

**4 · Controller.** Thin: validate with `class-validator`, call the service, return. No
business logic.

**5 · Register** the service in its module, and the module in `app.module.ts`.

**6 · Test it** — `apps/api/test/inspection.test.ts`. Copy the shape of `command.test.ts`.
Tests instantiate services directly rather than booting Nest, which keeps them fast and makes
the dependencies obvious.

```bash
pnpm --filter @uza/api test inspection
```

---

## Conventions that will bite you if you do not know them

**Refs come from the highest existing ref, not `count() + 1`.** Use `nextSequence()` in
`planning-ids.ts`. Counting breaks the moment a row is deleted: 32 decisions once existed while
the highest ref was `DEC-2026-0033`, and every insert returned a 500 until somebody found it.
**29 sites still use the old pattern — fixing one is a good first contribution.**

**Authorise in the service, not the controller.**

**The audit log is append-only.** `AuditService` exposes inserts and nothing else — no update,
no delete, deliberately.

**Deny before you throw.** On a refusal, write the audit row *first*, and without a transaction
handle, so the denial survives the exception that is about to be raised.

**Some things must never travel.** `intake/intake-lanes.ts` and
`platform/lender-view/lender-view-access.ts` encode confidentiality rules as code, with tests
naming specific counterparties. **Read those two files before touching anything lender-facing
or intake-related.** They are not style — breaking one has legal consequences.

**`packages/contracts` is the shared kernel.** A change there ripples into both apps; run
`pnpm typecheck` at the root afterwards.

**Test the pure logic first.** `apps/web/src/lib/format.test.ts` and the API's
`listing-pricing.util.spec.ts` equivalent are the reference shapes — no database, no
rendering, milliseconds, and they fail for exactly one reason. Reach for jsdom only when the
risk genuinely lives in the markup.

---

## Where things are

| I want to… | Go to |
|---|---|
| See every endpoint | `/docs` on the running API — it cannot go stale |
| Understand the business rules | `CLAUDE.md`, in this repo |
| Understand the wider estate | The `UZA-SOLUTIONS-GUIDE` repo, `00-group/` |
| Know how modules stay compatible | `docs/integration-contract.md` |
| Deploy it | `deploy/README.md` and `docker-compose.prod.yml` |

---

## Known issues — so they do not surprise you

**Web app coverage is thin.** 23 tests, on the pure logic where a mistake is silent and
expensive — masked fields and permission mirrors. Component rendering is untested; adding
jsdom and testing-library is the next step, not a rewrite.

**29 `count() + 1` ref sites remain**, in `command`, `finance`, `intake`, `logistics` and
`quality`.

**There is no impact module.** The measurement framework is written in the documents repo; the
computation is not built.

---

## House style — comments

Much of this codebase was written with AI assistance, and **the comments are denser than a
hand-written codebase**. Measured: 42% comment lines in the most recently added files against
21% elsewhere, where a typical NestJS project sits nearer 5–10%.

That is too much, and it is being corrected rather than defended. **The standard going
forward:**

| Belongs in the code | Belongs in `docs/` |
|---|---|
| What a non-obvious line does | Why an approach was chosen over another |
| A trap that will bite the next person, in one or two lines | A diagnosis, an investigation, a history |
| Why a constant has that value | Anything longer than about five lines |

```ts
// Reads the highest existing ref, not count()+1 — counting collides after a delete.
const seq = await nextSequence(model, prefix);
```

not fifteen lines recounting the incident. **Link instead:** `// see docs/PORTALS.md`.

**Some comments are load-bearing and must not be trimmed away.** The confidentiality rules in
`intake-lanes.ts` and `lender-view-access.ts`, and the `UZA_ID_PEPPER` note in
`uza-id.hash.ts`, explain constraints with legal consequences. If you shorten those, keep the
constraint and move the reasoning to a document you link to.

**Everything else is yours.** If a comment is noise, delete it. If code is wrong, change it.
Nothing here is sacred, and the tests exist so you can change things confidently.
