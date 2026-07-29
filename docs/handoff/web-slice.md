# Handoff — web vertical slice (Sprint 4b)

Written for the next frontend agent. This is a **thin vertical slice** proving the full
stack (browser → Next server → live API → services → Postgres) for one real flow. It is
**not** all 8 dashboards. Build the rest against the same patterns.

Branch: `sprint-4b-web-slice`. App: `apps/web` (Next.js 15 App Router, React 19, Tailwind 3,
PWA-ready). Runs on **:3100**; the API runs on **:3000**.

---

## What exists (screens + the endpoint each calls)

| Route | Purpose | API calls (all live) |
|---|---|---|
| `/login` | Email/password sign-in | `POST /auth/login` |
| `/` | Redirects to `/dashboard` or `/login` by session | — |
| `/dashboard` | venture_manager work queue; one card per tracked quotation/order with **stage · next action · owner** and secondary readable ref | `GET /quotations/:ref`, `GET /orders/:ref` (one per worklist entry); toolbar actions call `POST /customers`, `/leads`, `/leads/:ref/clarify`, `/projects`, `/quotations` (seed) |
| `/quotations/[ref]` | Quotation detail: qty, incoterm, customer price, **both quoted margin (at sell incoterm) AND DAP margin**, supplier cost / target / walk-away — masked `***` where the API masks; approve + create-order actions | `GET /quotations/:ref`, `POST /quotations/:ref/approve`, `POST /orders` |
| `/orders/[ref]` | Order detail: total, tier, **installment schedule**, next action + owner | `GET /orders/:ref` |

Every screen handles **loading** (`loading.tsx` + skeletons), **empty** (dashboard), **error**,
**permission-denied (403)** and **not-found (404)** — see `src/components/States.tsx`. All laid
out mobile-first in a `max-w-md` column; verified rendering at a **375×812** viewport.

The **next-action + owner** derivation (the product promise) is centralised in
`src/lib/promise.ts` — one place maps lifecycle state → `{stage, next action, responsible role}`.

---

## Auth / token approach

- `POST /auth/login` returns `{ accessToken, actor }`. A **server action** (`src/app/login/actions.ts`)
  sets **two httpOnly cookies**: `uza_token` (the JWT) and `uza_actor` (the `Actor` JSON).
  **No localStorage** — the token is never exposed to client JS (charter rule).
- Cookies are `httpOnly`, `sameSite=lax`, `secure` in production, `maxAge` 1h (mirrors the API's
  `JWT_TTL`). `getSession()` (`src/lib/session.ts`) reads them in server components/actions.
- The API remains the security boundary. The client-side `Actor` is used only to render labels
  and choose screens — **never** to authorise. Masking is rendered from what the API returns
  (`"***"`), never hidden client-side.
- Logout (`src/app/actions.ts`) clears all three cookies. A 401 from any call redirects to `/login`.

## i18n

- EN + FR complete (`src/i18n/messages/{en,fr}.json`); RW + ZH are **key-ready** with English
  fallback in the loader (`src/i18n/index.ts`). Locale lives in the `uza_locale` cookie, switchable
  in the header. Money renders from integer **minor** units ÷100 via `Intl.NumberFormat`
  (`src/lib/format.ts`); stored commercial meaning is never translated, only labels.

---

## Real vs stubbed — read this before trusting anything

**Real (exercised against the live API + Postgres, evidence captured):**
- Login → httpOnly cookie → authenticated reads. Auth gate (unauthenticated `/` and `/dashboard`
  → 307 `/login`).
- Quotation read showing **both margins**; masking proven through the web layer: as `venture_manager`
  the margin renders `20%` and supplier cost `$100.00`; as `sales_agent` (in scope) every
  confidential field renders `***` and `20%` never appears in the HTML.
- The full **write flow in a real Chrome** (puppeteer-core against installed Chrome, 375px):
  login → generate deal → open quotation → **approve** (`POST /quotations/:ref/approve`) →
  **create order** (`POST /orders`) → order screen with the **50/50 installment schedule**.
  All server actions hit the live API; state changes were confirmed back through the API.
- 403 (finance reading a quotation → "Not permitted") and 404 (bogus ref → "Not found").

**Stubbed / worked around (honest):**
- **No list endpoints exist.** `api-surface.md` exposes GET-by-ref only — there is no
  `GET /quotations`, `GET /orders`, or `GET /projects` list. The dashboard therefore keeps a
  per-user **worklist** in an httpOnly cookie (`uza_worklist`: readable refs + display labels
  only, no figures) and fetches each record **live**. This is a genuine limitation, not a mock —
  see the contract request below. A real "my work" list needs a backend endpoint.
- **"Generate demo deal" is dev scaffolding.** The venture_manager cannot create a customer/lead
  (that is a `sales_agent` grant, upstream of this slice), so the seed button logs in as a seeded
  agent (env `UZA_SEED_AGENT_*`, default `agent@uza.rw`) to build customer+lead, then runs the
  venture-manager half (clarify → project → quotation) with the **logged-in user's own token**.
  The approve/create-order actions the slice is really about use only the session token. Not part
  of the production auth story.
- **Project name** is captured at seed time into the worklist because there is no `GET /project/:ref`.
  Tracking a bare quotation/order ref shows the record type instead of a project name until a
  project read endpoint exists.

## How to run it

```bash
docker compose up -d                     # Postgres + Redis (repo root)
cd apps/api
node node_modules/prisma/build/index.js migrate deploy
PORT=3000 node -r @swc-node/register src/main.ts        # API on :3000, docs at /docs
node -r @swc-node/register seed-web.ts                  # seed ceo/vm/agent/finance users (idempotent)
# in another shell:
cd apps/web
UZA_API_URL=http://127.0.0.1:3000 pnpm dev              # web on :3100  (or: next dev -p 3100)
```

Sign in as **vm@uza.rw / password1**, click **Generate demo deal**, open the quotation, approve,
create the order. Seeded users: `ceo@uza.rw`, `vm@uza.rw`, `agent@uza.rw`, `finance@uza.rw`
(all `password1`).

## Next screens to build (suggested order)

1. **A list/work-queue endpoint** (contract request) so the dashboard stops relying on the
   worklist cookie — `GET /quotations?owner=…`, `GET /orders?…`, scoped + masked like the reads.
2. **Payment capture** (`POST /payments`, `/payments/:ref/verify`) so the awaiting_payment →
   procurement_active transition is visible in the UI (currently the order's honest next step).
3. **Quotation revise** (`POST /quotations/:ref/revise`) — the versioning UI (supersede chain).
4. **The offline-first inspection/receiving screens** (François) — queue writes locally, honest
   sync state. Different role, different device story; start from `/receiving` and `/inspections`.
5. **Provenance on tracking milestones** (`GET /tracking/:shipmentRef/timeline`) — the
   carrier-confirmed vs estimated distinction; a `Provenance` chip already exists in `components/ui.tsx`.

## Contract request to file

`GET` list endpoints for a user's projects / quotations / orders (scoped + masked), and a
`GET /projects/:ref`. Without them the dashboard cannot show a real "everything I own" queue —
only records whose refs the client already knows.
