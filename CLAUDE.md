# UZA Nexus OS — Project Constitution

This file loads into every subagent's context at startup. It is the only reliable
channel of shared knowledge between agents, because **subagents cannot talk to each
other**. Everything an agent needs to stay compatible with the others is here or in
`packages/contracts`.

Read `docs/integration-contract.md` before writing any code.

---

## 1. What we are building

Scope of v1: **UZA Bulk, China → Kigali/Goma corridor only.**

The connected record chain:

```
Customer → Lead → Request → Project → Task → Quotation → Order → Installments
→ Payment → Purchase Order → Production → Factory Visit → Inspection → CAPA
→ Warehouse Receipt → Package → Destination → Container → Shipment → Delivery
→ Commission → Satisfaction
```

Out of scope for v1, do not build: UZA Mobility, charging infrastructure, HR,
marketing, funding/investor portals, the compatibility engine, external SaaS
productisation. They exist in the long-term vision. They are not this sprint.

## 2. Non-negotiable business rules

These were validated in an executable spike (`reference/`) with 30 passing
assertions. Any code that contradicts them is wrong, however elegant.

1. **Payment gates procurement.** An order activates only when the confirmation
   installment is verified by Finance. Never by an agent, never by AI.
2. **Deposit floor is 30%.** New clients 50/50, established clients 30/40/30.
   Established = 3 delivered orders. Configured in `policy.ts`, never inline.
3. **Three independent gates block container booking**, checked in this order:
   volumetric variance resolved → pre-loading installment paid → single
   destination. Each fails with a message a human can act on.
4. **Goods release requires full payment.** Not delivery. Release.
5. **QC state and commercial holds are separate fields.** `qcReleased` and
   `varianceHold` must never be collapsed into one status field. Collapsing them
   once let unresolved goods sail; there is a conformance test for it.
6. **Volumetrics are three numbers, never one:** `declared` (factory),
   `measured` (François), `billed` (forwarder). Never overwrite one with another.
   Declared vs measured is a supplier problem. Measured vs billed is a claim.
7. **Containers are destination-pure.** One container, one destination.
8. **Freight allocates by revenue ton**, `max(cbm, kg/1000)`, not CBM.
9. **Agent commission is 2% on confirmed orders** (deposit verified), reversible
   by clawback. Every movement is a ledger row, never a silent balance edit.
10. **Quoted margin is locked at approval. Realized margin is computed from
    actuals.** Both are stored. Never overwrite the quoted figure.
11. **Cost is a ladder, not a number:** EXW → FOB → CIF → DAP, each rung holding
    an estimate and an actual. Margin is reported at the sell incoterm *and* at DAP.
12. **Confidential fields are masked on read, not filtered in the UI:**
    supplier cost, PO total, target/walkaway price, margin. A sales agent sees the
    customer price and nothing behind it. A logistics partner sees weight and CBM
    and nothing behind it.

## 3. Architecture rules

- **Contracts first.** `packages/contracts` is the shared kernel. Types, event
  names and payloads, permission grants, and policy constants live there and
  nowhere else. Duplicating a type locally is the failure mode this whole
  structure exists to prevent.
- **Only `contracts-guardian` may modify `packages/contracts`.** Any other agent
  that needs a contract change stops and writes a request to
  `docs/contract-requests/`, then continues against the existing contract.
- **Modules communicate through events, not imports.** A module may import from
  `@uza/contracts`. It may not import from another module's internals.
- **Every protected resource is authorised at the service layer**, not the route
  layer. Authorisation is not a middleware concern here; object scope depends on
  the record.
- **Money is integer minor units.** Never floats. `1234` is $12.34.
- **All financial and event handlers are idempotent**, keyed by event ID.

## 4. Stack

TypeScript everywhere. pnpm workspaces.
`apps/api` NestJS · `apps/web` Next.js + Tailwind · `apps/worker` BullMQ
PostgreSQL + Prisma · Redis · S3-compatible storage.

Node 20+. Strict TypeScript, no `any` in domain code.

## 5. Definition of done for any task

A feature is done when: service logic works, authorisation is enforced and
tested, validation rejects bad input, the Prisma migration exists, unit tests
pass, at least one conformance assertion covers it, and the API is documented.
A rendered screen with no backend is not done. Say so plainly rather than
reporting progress that does not exist.

## 6. Reporting

At the end of every task report, in this order: what was actually implemented,
files changed, tests run with real output, assumptions taken, remaining risks,
anything blocked on credentials or a founder decision, and the next action.
Do not claim deployment or integration that did not happen.

## 7. Open founder decisions

Do not invent answers to these. Implement the configured default in `policy.ts`
and flag the decision in your report.

- **Sell incoterm.** UZA delivers to Goma via a partner, but quotes have been
  built at CIF. On the reference order that gap is 18% quoted vs 1.1% at DAP.
  Until resolved, every quotation surfaces both margins.
- **Container utilisation.** Destination-pure containers sailed 66% full in the
  reference run. Log `daysWaitingForConsolidation` on every shipment from day one.
