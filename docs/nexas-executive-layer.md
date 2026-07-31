# Nexas — the Executive Layer (architecture & phased roadmap)

**Status:** planning / vision doc. Nothing here is built yet.
**Relationship to UZA Nexus:** UZA Nexus is the *operational backbone* (orders, quotations,
shipments, payments — the system of record for the business). **Nexas is the founder's
executive layer on top of it**: calendar, documents, legal, governance, memory, hiring. It is
a distinct, larger, multi-phase product. UZA Nexus is one of the data sources Nexas reads.

> Honest framing up front: this is a multi-year vision, comparable to a funded startup's whole
> roadmap. It becomes real only in grounded slices, on real data, through real integrations —
> not as one omniscient system. This document exists so we build it *connected*, not as islands.

---

## 1. The one principle that governs the build order

The user's design law — *"never build isolated modules; everything connects; the system
anticipates"* — dictates that three **foundations** come before any flagship feature. Almost
nothing (weekly auto-planner, contract reviewer, corporate DNA) works well until these exist:

1. **The Connected Entity Graph** — the "everything knows everything" spine. Every object
   (person, company, document, meeting, contract, project, decision, calendar block) is a node;
   edges are typed relationships (`document —belongs_to→ contract`, `meeting —produced→ decision`,
   `employee —signed→ NDA`). This graph is what makes the vision more than a folder of files.
2. **The Secure Ingestion Layer** — pulls the founder's *real* reality in: documents, emails,
   meeting notes, calendar. Without it the AI reasons over demo data, not the company.
3. **The Integration Spine** — Google Calendar, Gmail, Contacts, Google Maps (travel/traffic),
   messaging/SMS, and document sources (OneDrive/Drive). Each is a real OAuth integration the
   founder provisions (credentials are theirs, like the Google sign-in we already built).

**Build the spine first, then one flagship slice end-to-end, then extend.** Building flashy
features before the spine reproduces the exact isolated-modules failure the principle forbids.

---

## 2. Architecture (layers)

```
┌───────────────────────────────────────────────────────────────┐
│  EXPERIENCE   Web/PWA + conversational ("Nexa, hire a PM")     │
├───────────────────────────────────────────────────────────────┤
│  INTELLIGENCE  AI reasoning over the graph (RAG) + LLM + tools │
│               proactive engine (anticipates: briefs, nudges)  │
│               HUMAN-IN-LOOP gate for legal/high-stakes actions │
├───────────────────────────────────────────────────────────────┤
│  DOMAIN       Calendar engine · Vault · Governance · Hiring ·  │
│               Corporate DNA (memory)                           │
├───────────────────────────────────────────────────────────────┤
│  GRAPH        Connected Entity Graph (nodes + typed edges)     │
├───────────────────────────────────────────────────────────────┤
│  INGESTION    docs · email · meetings · calendar · UZA Nexus   │
├───────────────────────────────────────────────────────────────┤
│  INTEGRATIONS Google Calendar/Gmail/Contacts/Maps · messaging  │
│               · Drive/OneDrive · UZA Nexus API                 │
├───────────────────────────────────────────────────────────────┤
│  SECURITY     encryption, access control, approval rules,      │
│               audit — the whole thing is a sensitive-data vault│
└───────────────────────────────────────────────────────────────┘
```

- **The Intelligence layer** = retrieval over the graph + an LLM (Claude) for reasoning +
  **tools** (create calendar event, draft document, send-invite-for-approval). "Proactive"
  means scheduled jobs that pre-compute briefings and surface suggestions before being asked.
- **The AI is a copilot, not an authority.** Every consequential action (send a message, sign,
  finalize a contract, escalate) routes through an **approval gate** with admin-controlled rules.

---

## 3. Security & privacy — designed in from day one, not bolted on

Nexas concentrates the company's most sensitive data (legal, financial, HR, strategic, the
founder's inbox and calendar) in one place. That is the single biggest responsibility of the
project. Non-negotiables:

- **Encryption at rest + in transit**; secrets in a proper vault, never in code.
- **Least-privilege access + full audit** (reuse UZA Nexus's authorize()/audit patterns).
- **Approval rules** for any outbound action or high-stakes decision (the user asked for this).
- **Employee-facing boundary:** *operational visibility* (who owns which task, SLA/KPIs) is fine;
  *surveillance of people* is a legal (labour + data-protection law, Rwanda/DRC), ethical, and
  trust matter — only with legitimate purpose, transparency, and legal footing.
- **Data residency & consent** for ingested email/documents/contacts.

---

## 4. Module 1 — Intelligent Executive Calendar (AI Planning Engine)

**What it is:** the CEO's calendar as an active planner, not a passive grid.

**Core capabilities (in build order):**
1. **Connect + protect** — OAuth to Google Calendar/Gmail/Contacts; model **sacred blocks**
   (family, church, gym, thinking time, strategic work) as first-class protected commitments the
   engine defends against meeting sprawl.
2. **Context-aware scheduling** — understands time zones, **travel time + traffic** (Maps API),
   prep time, meeting importance, employee availability, recurring commitments.
3. **Weekly planning from intent** — CEO writes "this week I want to…"; the engine infers
   duration, urgency, dependencies, participants, prep, deadlines, location → proposes an
   optimized schedule (a constraint-satisfaction + AI-judgment problem; ship a *useful* version,
   iterate toward optimal).
4. **Smart suggestions** — best slot + why + conflicts + alternatives + prep checklist + docs
   needed + expected outcome.
5. **Meeting intelligence** — before: auto-briefing; during: capture notes; after: minutes,
   task assignment, reminders, follow-up, escalation on delays. (Depends on a meeting-notes/
   transcript source.)
6. **Communication (approval-gated)** — drafts invites, prep reminders, doc requests, follow-ups,
   reschedules, escalations; routes through approved channels under admin rules.
7. **Rhythm** — evening: prep tomorrow; morning: prep today; Friday: prep next week; monthly:
   strategic priorities.

**Depends on:** Google OAuth creds (founder-provisioned), Maps API key, a notes source, and the
entity graph (to link a meeting → its docs, people, decisions).

---

## 5. Module 2 — Executive Intelligence Vault

**What it is:** replaces "Documents" with living, connected, understood documents + the legal/
governance brain. This module *is* where the connected-entity graph earns its keep.

**Core capabilities (in build order):**
1. **Connected documents** — every document is a graph node knowing its owner, project, customer,
   supplier, employee, meeting, version, approval, expiry, related contracts/emails/tasks/decisions.
2. **Expiry & renewal intelligence** (mechanical, high-value, low-risk — build first) — "this
   contract expires in 84 days," insurance/license/filing renewals, automatic reminders.
3. **Ask-your-documents** — RAG Q&A over the vault ("what are our payment terms with supplier X?").
4. **AI Document Intelligence & Contract Review** — flags high-risk clauses, unlimited liability,
   weak IP, payment/jurisdiction/termination/confidentiality risks; produces a **risk score +
   recommended changes + summary**. **⚠️ ASSISTIVE ONLY — human-in-loop:** AI drafts and flags; a
   **qualified lawyer reviews before anything is signed or relied upon.** We build the assistant,
   never "trust the AI's legal judgment." This saves the lawyer time; it does not replace them.
5. **AI Legal Assistant** — *drafts* employment contracts, offer letters, NDAs, IP assignments,
   board resolutions, MoUs, supplier/customer/grant agreements, etc. from templates + context.
   Same gate: **draft → lawyer review → sign.**
6. **Corporate Governance** — structured records + reminders for registration, licenses, tax,
   insurance, compliance, board, shareholders, cap table, ESOP, policies, filings, renewals, risk
   register, audit. (Largely record-keeping + expiry reminders = very doable, very valuable.)
7. **Corporate DNA (memory)** — RAG over meetings, emails, approvals, decisions, documents so the
   company can answer "why did we choose this supplier / reject this proposal / change strategy?"
   Institutional knowledge survives employee departures. (Fidelity scales with what's ingested.)
8. **AI Hiring** — "hire a Procurement Manager" orchestrates: offer letter, contract, NDA, IP
   assignment, employee file, onboarding checklist, calendar, training plan, first-week tasks,
   probation schedule, KPIs, review schedule — spanning the Vault + Calendar + graph (docs still
   go through legal review).

---

## 6. Connected Intelligence (the payoff)

The graph makes the lifecycle traceable end-to-end and preserved forever:

```
Employee → Contract → Department → Projects → Customers → Revenue
        → Performance → Training → Promotion → Knowledge → Exit → (memory retained)
```

Every module writes to and reads from the same graph, so nothing is an island — and the system
can *anticipate* (surface a renewal, a conflict, a follow-up) because it can see the connections.

---

## 7. Phased roadmap (realistic)

- **Phase 0 — Foundations (the spine).** Entity-graph data model; secure storage + access/audit;
  the first integration (Google Calendar/Gmail via OAuth, reusing our Google work); the AI
  retrieval+reasoning harness with the human-in-loop approval gate. *Nothing user-facing yet, but
  everything later depends on it.*
- **Phase 1 — Flagship slice (pick ONE, end-to-end on real data):**
  - *Executive Calendar core* — connect calendar, protect sacred blocks, "this week I want to…"
    → proposed schedule. Highest daily value, lowest liability. **Recommended first.**
  - *Vault core* — secure ingestion + connected docs + expiry/renewal tracking + ask-your-docs.
    Highest strategic value; the foundation the legal/governance modules hang off.
- **Phase 2 — Extend the chosen flagship** (meeting intelligence *or* document/contract review as
  assistant-with-lawyer-review).
- **Phase 3 — Governance module** (records + renewals) and **Corporate DNA** (memory).
- **Phase 4 — AI Hiring** and cross-module orchestration; deepen "proactive."
- **Ongoing — hardening, more integrations, and pulling UZA Nexus operational data into the graph.**

---

## 8. Hard dependencies & honest constraints

- **Integrations + credentials you provision** (Google Cloud OAuth for Calendar/Gmail/Contacts,
  Maps API, messaging) — nothing "intelligent" exists until connected to your real account.
- **Your real data** — documents, emails, meetings must be ingested; the system never
  auto-discovers your business.
- **Legal liability** — the legal/contract AI is assistive-with-human-review, always.
- **Privacy/security** — the most sensitive data concentration we'd ever build; designed-in.
- **Scale** — this is a program of work, not a sprint; funded by clear phase-by-phase value.

---

## 9. Where UZA Nexus plugs in

UZA Nexus is a first-class data source for the graph and the assistant: orders, payments,
shipments, supplier scores, commissions become nodes/edges Nexas can reason over ("which
customers are overdue?", "which suppliers scored low this quarter?"), and the Calendar/Vault can
link a meeting or contract to the specific order/supplier it concerns. The ops backbone is done
and proven; Nexas is the intelligence built on top of it.
