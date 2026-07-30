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
| `/dashboard` | venture_manager work queue; **one card per live-listed quotation/order** with **stage · next action · owner** and secondary readable ref. Scoped + masked server-side; paginated via Load more | `GET /quotations?limit=`, `GET /orders?limit=`, `GET /projects?limit=100` (names/owners, best-effort); toolbar seed action calls `POST /customers`, `/leads`, `/leads/:ref/clarify`, `/projects`, `/quotations` |
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

**Dashboard now runs on the live list endpoints (worklist cookie retired).**
- The `GET /quotations`, `GET /orders`, `GET /projects` list endpoints now exist (scoped +
  masked, `updatedAt desc`, `limit`/`offset`). The dashboard queue is built directly from them
  in `src/lib/queue.ts` — **no `uza_worklist` cookie**. The cookie, `src/lib/worklist.ts` and the
  add/remove/track-into-worklist actions are **deleted**. Each endpoint is scoped to the caller
  server-side, so the queue is genuinely "everything I own": a VM sees all rows with margins; a
  `sales_agent` sees only their own rows with confidential fields masked `***`; `finance` (no
  `quotation:read`) gets the Quotations section replaced by an inline "your role cannot view
  these" notice while its Orders section still renders. Projects are fetched **best-effort** for
  names/owners — a role denied `project:read` (sales_agent) still gets a full queue, just without
  project names (falls back to the record-type label).
- **Pagination.** Page size 20 via a `?count=` search param; "Load more" grows the window
  (`count += 20`, re-fetched from offset 0 so a server-rendered, freshly-sorted set is always
  consistent), capped at the API's `limit` max of 100. Quotations and Orders render as two
  labelled sections within the one queue (a merged time-sort isn't possible — the masked
  quotation projection carries no `updatedAt`).
- **"Track by reference"** is retained only as a secondary jump-to-record utility: it now
  redirects straight to `/quotations/:ref` or `/orders/:ref` (which enforce their own
  auth/masking) instead of writing to any worklist.

**Stubbed / worked around (honest):**
- **"Generate demo deal" is dev scaffolding.** The venture_manager cannot create a customer/lead
  (that is a `sales_agent` grant, upstream of this slice), so the seed button logs in as a seeded
  agent (env `UZA_SEED_AGENT_*`, default `agent@uza.rw`) to build customer+lead, then runs the
  venture-manager half (clarify → project → quotation) with the **logged-in user's own token**.
  The approve/create-order actions the slice is really about use only the session token. Not part
  of the production auth story. The queue no longer depends on it — seeded records simply appear
  in the live lists on the next dashboard load.

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

Sign in as **vm@uza.rw / password1**. Click **Generate demo deal** a few times (or POST via the
API) to populate data, then watch the queue list the real quotations/orders — no worklist cookie.
Open a quotation, approve, create the order; the new order surfaces in the queue on the next load.
Seeded users: `ceo@uza.rw`, `vm@uza.rw`, `agent@uza.rw`, `finance@uza.rw` (all `password1`).
Sign in as `agent@uza.rw` to see the same list **scoped to the agent's own records with margins
masked**; as `finance@uza.rw` to see the Quotations section denied while Orders still render.

## External portals — Customer + Imari partner (branch `portals-web`)

Two role-scoped external portals, built on the same session/api/promise/States helpers.
**Role-aware navigation** is centralised in `src/lib/permissions.ts`: `homePathFor(actor)`
sends a `logistics_partner` to `/partner/shipments` and everyone else to `/dashboard`;
`isPartner()` gates the partner routes; `showSeedTools()` hides the VM dev toolbar from
external personas. Login, the index redirect and the app-shell logo all route through
`homePathFor` so each persona lands only in its own area. The API remains the security
boundary — these are UI conveniences; every read is scoped + masked server-side.

### Customer portal (reuses the scoped commercial endpoints)
| Route | Purpose | API calls (all live, scoped to the customer) |
|---|---|---|
| `/dashboard` (customer-framed) | Home: the customer's **projects, quotations and orders** with stage · next action · owner. VM toolbar (seed / track) hidden. | `GET /projects`, `/quotations`, `/orders` (all scoped to `scope.customerId`) via `lib/queue.ts` |
| `/orders/[ref]` | Existing order screen, reused unchanged. A `customer` holds `payment:create`, so a due installment shows the **upload-payment-proof** form → `POST /payments` (pending Finance verify). | `GET /orders/:ref`, `GET /invoices/order/:orderRef`, `POST /payments` |

The dashboard now loads the session, redirects a partner out, and — for a `customer` —
retitles to "Your orders", renders a read-only **Projects** section (from the same
best-effort `GET /projects`, since there is no project-detail route yet) and hides the
seed/track toolbar. Confidential fields already render `***` for a customer (API-enforced);
the customer's own quotation shows margins masked.

### Imari partner portal (read-only, scoped + masked) — new
| Route | Purpose | API calls |
|---|---|---|
| `/partner/shipments` | The partner's assigned shipments (destination, carrier, container, ETD/ETA, status) with stage · next action · owner (`shipmentPromise`). | `GET /partner-portal/shipments?limit=100` |
| `/partner/shipments/[ref]` | Shipment detail: carrier/container/ETD/ETA/days-waiting + **freight cost rendered `***`**; **Packages** (kg/CBM, QC state) ; **Delivery** (POD + status, 404 → "not delivered yet"); **Tracking timeline** with a **provenance chip** (carrier/partner/uza = confirmed ● vs estimated ◌, CF-022). | `GET /partner-portal/shipments/:ref`, `/:ref/packages`, `/:ref/delivery`, `GET /tracking/:ref/timeline` |

Freight cost (`freightPaidMinor`/`billedRevenueTon`/`measuredRevenueTon`) arrives masked
`***` from the API; the freight row renders `<Masked/>` (honest, not omitted) with a note
that freight is not shared with partners. Weight/CBM are shown. New shipment promise mapping
in `lib/promise.ts`; new partner-portal read-types in `lib/types.ts`.

### Verified (live stack, cookie method — see run instructions)
Minted real sessions via `POST /auth/login`, curled the web server with `uza_token` +
`uza_actor` cookies, grepped the server-rendered HTML:
- `partner@uza.rw` → `/partner/shipments` lists `SHP-WEB-2026-0001`; detail shows packages
  (kg/CBM), delivery (`DEL-WEB-2026-0001` POD), tracking timeline, and freight `***`.
- `customer@uza.rw` → `/dashboard` shows `ORD-WEB-2026-0001` + Projects, no seed toolbar;
  `/orders/ORD-WEB-2026-0001` shows invoice `INV-WEB-2026-0001` and the upload-proof form.
- **Isolation:** a `customer` hitting `/partner/shipments` is redirected to `/dashboard`
  (soft/streaming redirect — 200 with `meta refresh` + RSC `NEXT_REDIRECT` to `/dashboard`;
  **zero** shipment data in the body); a `logistics_partner` hitting `/dashboard` is
  redirected to `/partner/shipments`; a partner on `/orders/:ref` gets the 403 denied panel.
- FR locale renders (e.g. "Mes expéditions"). `next build` passes with both partner routes.

### Stubbed / honest notes for the portals
- **Soft redirect, not a hard 3xx.** The partner/customer route guards run inside the page
  (after the shared layout shell has streamed), so cross-role access returns HTTP 200 with a
  client redirect (meta-refresh + RSC directive), not a 307. It navigates the user away and
  leaks no data; if a hard status is required, move the guard to `middleware` or the layout.
- **No project-detail route** — customer projects render read-only (name · stage · owner).
- **Payment proof is a text reference**, not a file upload (same as the existing order screen).
- **RW/ZH** partner/portal strings fall back to EN via the i18n loader (key-ready, not translated).

## Responsive layout system (branch `web-responsive`)

The app was previously locked to a single `max-w-md` (~448px) column on every screen — right
on a phone, a thin wasted strip on tablet/desktop. It now scales up while keeping 375px as the
primary, mobile-first target. **Layout/CSS only** — no data wiring, masking, role-gating or API
changes. Tailwind breakpoints only, no new deps.

**Shared primitives live in `src/components/ui.tsx`** so breakpoints are defined once, not copied
per page:
- `SHELL_WIDTH` = `max-w-md sm:max-w-2xl lg:max-w-5xl xl:max-w-6xl` — the one width the whole app
  grows through. `SHELL_PADDING_X` = `px-4 sm:px-6 lg:px-8` gutters that grow with it.
- `CardGrid` — a `<ul>` that is **1 column on mobile, 2 on `md`, 3 on `lg`**
  (`grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3`). Keeps `<li>` list semantics.
- `DetailShell` — a `mx-auto w-full max-w-3xl` wrapper for single-record reading pages, so
  content uses more than a phone's width but never sprawls edge-to-edge on a 1440px monitor.

**App shell (`(app)/layout.tsx`).** The sticky header is now a **full-bleed white bar** whose inner
content is centred to `SHELL_WIDTH`; `<main>` is centred to the same width. Header action row and
the "signed in as" line use `flex-wrap` so the locale switch + verify-queue + sign-out wrap
sensibly from 375px up. The page background (`bg-slate-50`) spans the full viewport.

**Where each primitive is applied:**
- **List / work-queue pages → `CardGrid`:** dashboard quotations & orders sections and the
  customer projects section (`dashboard/page.tsx`), the Imari partner shipments list
  (`partner/shipments/page.tsx`), the Finance verify-payments queue (`finance/payments/page.tsx`).
  Cards get `h-full` + `flex flex-col` with the ref/amount row pushed to the bottom
  (`mt-auto`) so cards in a row are equal height. The `loading.tsx` skeleton mirrors the grid.
- **Detail pages → `DetailShell` + a `lg:grid-cols-2` inner grid:** quotation (info card | margins
  card), order (summary card | installment schedule), partner shipment detail (carrier + packages |
  delivery + timeline). Columns stack in the same top-to-bottom order on a phone.
- **Buttons / forms:** primary actions are `w-full` on mobile and cap to `sm:w-auto sm:min-w-64`
  (or `sm:inline-block sm:w-auto`) on wider screens instead of stretching across the page; 44px
  tap targets preserved. Login (`login/page.tsx`) stays a centred card, `max-w-md sm:max-w-lg`.

**Breakpoints:** `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280 (Tailwind defaults). Net effect —
cards: 1-col <768, 2-col 768–1023, 3-col ≥1024; shell: ~448px <640 → 2xl@640 → 5xl@1024 → 6xl@1280.

**Verified (live stack, cookie method) at 375 / 768 / 1280.** Killed stale node on 3000/3100,
rebuilt (`next build` passes), reseeded, minted sessions via `POST /auth/login` and curled the web
server with `uza_token` + `uza_actor` cookies. All key pages return HTTP 200 with the responsive
classes present in the rendered markup — `SHELL_WIDTH` on header+main everywhere; `CardGrid` on
vm/customer dashboards, finance queue, partner list; `DetailShell` + `lg:grid-cols-2` on
quotation/order/partner-shipment detail. Confirmed the generated CSS carries the media-query rules
(`md:grid-cols-2`, `lg:grid-cols-3`, `lg:grid-cols-2`, `sm:max-w-2xl`, `lg:max-w-5xl`,
`xl:max-w-6xl`) so at 375 everything is single-column at `max-w-md` (mobile experience unchanged),
2-col at 768, 3-col at 1280 with the shell widened. Masking unaffected (partner freight still `***`).

## Next screens to build (suggested order)

1. **Payment capture** (`POST /payments`, `/payments/:ref/verify`) so the awaiting_payment →
   procurement_active transition is visible in the UI (currently the order's honest next step).
2. **Quotation revise** (`POST /quotations/:ref/revise`) — the versioning UI (supersede chain).
3. **The offline-first inspection/receiving screens** (François) — queue writes locally, honest
   sync state. Different role, different device story; start from `/receiving` and `/inspections`.
4. **Provenance on tracking milestones** (`GET /tracking/:shipmentRef/timeline`) — the
   carrier-confirmed vs estimated distinction; a `Provenance` chip already exists in `components/ui.tsx`.
5. **Server-side status filters / offset paging** on the queue if volumes grow — the list
   endpoints already accept `status`/`stage`/`customerRef` + `offset`; the dashboard currently
   only grows `limit`. Adding filter chips is a small follow-up.
