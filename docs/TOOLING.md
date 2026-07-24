# Tooling — everything needed to build UZA Nexus OS and take it live

Four tiers: what you need to start today, what the build needs as it grows,
what going live requires, and what only you can provide.

Prices are order-of-magnitude as of early 2026 and move constantly. Verify
before committing. Every figure below assumes the v1 scope: UZA Bulk,
China → Kigali/Goma, roughly 10 internal users and a few hundred external ones.

---

## Tier 1 — Start coding today

Nothing here is optional and nothing costs much.

| Tool | Why | Cost |
|---|---|---|
| A development machine | macOS, Linux, or Windows with WSL2. 16GB RAM minimum, 32GB if the same machine runs Docker all day | — |
| **Node.js 22 LTS** | The whole stack. Also gives `--experimental-strip-types`, which the conformance tests already use | free |
| **pnpm** | Monorepo workspaces. npm works but is slower and less strict about phantom dependencies | free |
| **Git + GitHub** | Private repo. Claude Code commits to it; every agent's work is reviewable as a diff | free / ~$4 per user |
| **Docker Desktop** | Local PostgreSQL and Redis. Do not install them natively — you want the same versions in dev and production | free for a company this size |
| **Claude Code** | The build itself | see claude.com/pricing |
| **VS Code** | Reading diffs, debugging. Claude Code runs in the terminal but you will want an editor | free |
| **TablePlus or DBeaver** | Looking at the database with your own eyes. You will do this more than you expect | free tier fine |

That is the entire day-one list. Sprints 0 through 3 need nothing else.

---

## Tier 2 — During the build

### Testing and quality

| Tool | Why |
|---|---|
| **Vitest** | Unit and integration tests. Faster than Jest, native TypeScript |
| **Playwright** | End-to-end. Non-negotiable for the offline inspection flow — that path cannot be verified by unit tests |
| **k6** | Load testing before launch. One afternoon's work, saves a bad first week |
| **ESLint + Prettier** | Eight agents writing code in parallel. Without enforced formatting, every diff is noise |
| **Husky + lint-staged** | Blocks a commit that fails typecheck or lint. Cheaper than a guardian review catching it |

### Local services via Docker

PostgreSQL 16, Redis 7, and MinIO (S3-compatible object storage, so file
handling behaves identically in dev and production).

### AI services used *by* the product

Distinct from Claude Code building it. These are runtime dependencies:

| Service | Used for | Rough cost |
|---|---|---|
| **Anthropic API** | Packing-list and invoice extraction, Chinese↔English factory messages, turning WhatsApp text into structured requests, drafting client updates | $50–300/mo at your volume |

The master prompt was right to insist on a provider abstraction. Keep it.
Document extraction and translation are the two features where a cheaper model
may be enough, and you want to switch without touching business logic.

---

## Tier 3 — Going live

### Infrastructure

| Service | Purpose | Rough cost |
|---|---|---|
| **PostgreSQL, managed** — Neon, Supabase, or Railway | Never run your own database. Point-in-time recovery matters more than the price difference | $20–70/mo |
| **Redis, managed** — Upstash or Railway | BullMQ job queues | $10–30/mo |
| **Object storage** — Cloudflare R2 | Inspection photos, videos, packing lists, PODs. **R2 specifically, because it has no egress fees** — and your evidence gets viewed from Rwanda, DRC and China | $5–25/mo |
| **API + worker hosting** — Railway or Render | NestJS API and the BullMQ worker | $20–60/mo |
| **Web hosting** — Vercel | Next.js. The free tier may genuinely cover you at first | $0–20/mo |
| **Domain + TLS** | TLS via Let's Encrypt, included by every host above | ~$15/yr |

Start on Railway for everything except the frontend. Moving to AWS later is a
week of work; starting on AWS costs you a month now and buys nothing at ten users.

### Communication — the part most plans forget

Your business runs on WhatsApp and phone calls. A system that only sends email
will be ignored.

| Service | Purpose | Rough cost |
|---|---|---|
| **WhatsApp Business Platform** (Meta Cloud API) | Client updates, payment confirmations, shipment milestones, agent notifications. **This is the single highest-value integration in the project** | ~$0.005–0.05 per conversation |
| **Africa's Talking** | SMS across Rwanda and DRC. Better regional coverage and pricing than Twilio | pay per message |
| **Resend or Postmark** | Proformas, invoices, documents | $0–20/mo |
| **Web Push (VAPID)** | PWA notifications to François and Adeline. Free, no vendor | free |

Budget four to six weeks for WhatsApp Business verification. Meta requires
business documents and a template approval process. **Start that application
during Sprint 0, not when the feature is ready** — it is the longest lead time
in the whole project and it is pure paperwork.

### Logistics

| Service | Purpose | Rough cost |
|---|---|---|
| **Container tracking API** — Terminal49, Vizion, or SeaRates | Vessel milestones without a human refreshing carrier websites. Feeds the carrier-confirmed vs estimated distinction | $100–400/mo |

Honest advice: skip this at launch. Have Imari and Cecilia enter milestones
manually, marked `partner` and `uza` as the contract already allows. Add the API
once you know which carriers you actually use most. It is the easiest thing to
add later and one of the more expensive to add early.

### Money

| Service | Purpose |
|---|---|
| **MTN MoMo API / Airtel Money** | Rwanda collections. Verification against a real transaction beats a screenshot of a bank slip |
| **Exchange rate feed** — exchangerate.host or OpenExchangeRates | USD/RWF/CDF/CNY. Rates must be stored per transaction, never fetched live at report time |

Note carefully: MoMo automates *matching*, not *approval*. Kagabo still verifies.
The rule that only Finance verifies a payment does not relax because an API said so.

### Operations

| Service | Purpose | Rough cost |
|---|---|---|
| **Sentry** | Error tracking. When François's phone fails to sync in Ningbo, you need the stack trace | $0–26/mo |
| **Better Stack or UptimeRobot** | Uptime and on-call alerts | $0–20/mo |
| **PostHog** | Which screens people actually use. Self-hostable if data residency matters | free tier |
| **Automated backups** | Included with managed Postgres — but **test a restore before launch.** An untested backup is not a backup | included |

### Physical equipment — genuinely required

Software plans forget these and then the warehouse cannot function.

| Item | Why | Rough cost |
|---|---|---|
| **Thermal label printer** (Zebra ZD230 or Brother QL) for Ningbo | QR labels on every package. Your whole destination-allocation model depends on scannable labels | $200–400 |
| **Label stock** | Waterproof, since cartons get wet | ongoing |
| **A good phone for François** | Camera quality *is* your evidence quality. Blurry photos lose forwarder claims | $250–400 |
| **Calibrated warehouse scale + tape measure** | The `measured` number in the three-way reconciliation. If it is not trusted, the whole gate is theatre | $150–500 |
| **Second device for Adeline** | Phone in one hand, system in the other | — |

### Legal and compliance

- **Rwanda Law N° 058/2021 on data protection** — registration with the NCSA as a
  data controller. Start early; it is not instant.
- **Data residency** — decide where customer data physically sits before choosing
  regions. Changing later means migrating a live database.
- **The agent agreement with the clawback clause** — signed before the first
  commission payout. This is a legal task, not a code task, and it is on the
  critical path.
- **Client terms** covering the payment schedule and who carries freight overage.
  The system enforces these rules; the contract has to state them or the
  enforcement has no basis.

---

## Rough monthly cost at launch

| | Monthly |
|---|---|
| Infrastructure | $70–200 |
| Communications | $30–100 |
| AI (product runtime) | $50–300 |
| Monitoring | $0–50 |
| Container tracking (deferred) | $0 |
| **Total** | **roughly $150–650** |

Plus one-off equipment of roughly $700–1,500 and the Claude Code subscription.

The range is wide because it depends almost entirely on message volume and
document-extraction usage. Start at the bottom of every range; nothing here
requires a commitment beyond a month.

---

## What only you can provide

Not tools. These are the actual blockers, and no amount of tooling substitutes.

### Decisions

1. **The sell incoterm.** Blocks `trade-flow`. Every quotation bakes it in.
2. **Whether Nexus is internal-only for year one.** Changes the auth model,
   the tenancy model and the data model. Deciding late is expensive.
3. **Data residency.** Blocks infrastructure region choice.
4. **Who can waive a deposit, and above what value it needs you.**

### Credentials, when each is due

| Credential | Needed by |
|---|---|
| GitHub organisation and repo | Sprint 0 |
| Anthropic API key | Sprint 1 |
| Database and Redis connection strings | Sprint 0 |
| Cloudflare R2 keys | Sprint 4 |
| WhatsApp Business account | **apply Sprint 0**, integrate Sprint 5 |
| SMS provider account | Sprint 5 |
| MoMo API credentials | post-launch |

### People

- **Someone who owns the deploy.** Claude Code writes it; a human presses the
  button and answers the phone at 2am. If that is you, say so now and plan for it.
- **Four to six hours a week from Badiane, Cecilia, François and Adeline** during
  their module's sprint. Not for approval theatre — to catch the ten things a
  spec never captures. Cheaper now than a rebuild later.
- **A pilot client** willing to run one real order through the system while the
  old process runs in parallel. Not a demo. A real order.

---

## What I would cut

- **Container tracking API** — manual entry until the corridor is proven.
- **Multi-currency** — quote and invoice in USD only for v1. Add RWF and CDF once
  the flow works. Currency is a data-model change; do it deliberately.
- **A paid auth provider** — your external portals need object-level scoping that
  Clerk and WorkOS do not model well. Build it on the permission contract you
  already have.
- **Kubernetes, microservices, a service mesh** — at ten internal users, all of it
  is cost with no benefit. The modular monolith in the architecture is correct.
- **A staging environment on day one** — add it when the first real client is
  live, not before.
