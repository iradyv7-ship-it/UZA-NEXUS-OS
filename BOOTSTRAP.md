# Bootstrap — running this with Claude Code

## Setup

```bash
npm install -g @anthropic-ai/claude-code   # if not already installed
cd uza-nexus
git init && git add -A && git commit -m "contracts, agents, conformance spec"
claude
```

Agents live in `.claude/agents/` and load at startup. If you add one mid-session,
restart. Check what loaded with `/agents`.

## Session 1 — already done

The pre-Sprint-0 contract audit is complete; see
`docs/reviews/2026-07-23-contract-review-001.md`. Six gaps were found and closed.
Verify for yourself before building anything:

```bash
cd packages/contracts && npx tsc --noEmit          # clean
cd ../.. && node --experimental-strip-types tests/conformance/contracts.test.ts
cd reference && python3 run_scenarios.py           # 30 passed
```

If any of those three fail, stop and fix it before Sprint 0. Everything
downstream assumes they pass.

## Session 2 — Sprint 0, the foundation everything blocks on

```
Use the platform-core agent to build apps/api: NestJS, Prisma, PostgreSQL,
auth, the authorisation service using @uza/contracts, the audit log, and
the transactional outbox event bus. Migrations and permission tests included.
Then have contracts-guardian review the diff.
```

## Session 3 — parallel modules

These two do not depend on each other, so run them in one session and let Claude
delegate to both:

```
Use trade-flow and sourcing-quality in parallel. trade-flow builds
customers through orders with the cost ladder and installment schedules.
sourcing-quality builds suppliers, POs, visits, inspections and CAPAs.
Both consume platform-core. Both write a handoff doc when done.
```

## Session 4 onward

```
Use finance-commission to build invoices, installments, payment verification
and the commission ledger. Read docs/handoff/trade.md first.
```

Then `logistics-warehouse`, then `frontend-mobile`.

## After every sprint, without exception

```
Use contracts-guardian to review the diff, then conformance-runner to run
the suite and report against tests/conformance/SPEC.md.
```

## The rule that makes this work

An agent that needs a contract change writes to `docs/contract-requests/` and
keeps going against the existing contract. It never edits `packages/contracts`
itself. That single rule is the difference between eight modules that compose
and eight modules that each invented their own `Package` type.

## What you still owe the build

Two founder decisions, neither of which is a coding task:

1. **The sell incoterm.** If UZA delivers to Goma, quoting at CIF prices off a
   cost base that stops halfway. On the reference order that is 18% quoted
   against 1.1% at DAP. Settle it with Badiane.
2. **The agent agreement**, with the clawback clause signed, before the first
   commission payout.
