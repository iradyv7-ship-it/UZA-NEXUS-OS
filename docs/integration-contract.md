# Integration Contract

Read this before writing code. It exists because of one fact about how this
project is built:

> **Subagents cannot talk to each other.** Each starts with a fresh context
> window and reports only back to the main session. The only shared knowledge is
> what is written in `CLAUDE.md` and `packages/contracts`.

Everything below follows from that.

## 1. The shared kernel

`packages/contracts` holds every type, event name, event payload, permission
grant and policy constant that more than one module touches.

- A module imports from `@uza/contracts`. Always.
- A module never redeclares a shared type locally, even "just for now".
- A module never imports another module's internals.
- Only `contracts-guardian` writes to `packages/contracts`.

## 2. Requesting a contract change

Write a file to `docs/contract-requests/YYYY-MM-DD-short-name.md`:

```
Module:     logistics-warehouse
Need:       Shipment needs a customsClearedAt timestamp
Shared?     Yes — finance reads it for duty reconciliation
Proposed:   add `customsClearedAt: string | null` to Shipment
Breaking?   No, additive
Blocked?    No — I can proceed against the current contract meanwhile
```

Then continue against the existing contract. Do not wait, and do not patch the
contract yourself.

## 3. Module ownership

| Module | Agent | Publishes |
|---|---|---|
| platform | platform-core | (infrastructure only) |
| trade | trade-flow | `lead.created`, `request.created`, `quotation.approved`, `order.created`, `order.cancelled` |
| sourcing / quality | sourcing-quality | `po.issued`, `inspection.recorded`, `quality.failed`, `capa.closed` |
| warehouse / logistics | logistics-warehouse | `warehouse.receiptRecorded`, `warehouse.varianceResolved`, `container.assigned`, `shipment.billedWeightRecorded`, `shipment.delayed`, `delivery.completed` |
| finance | finance-commission | `payment.proofUploaded`, `payment.verified`, `commission.accrued`, `commission.clawedBack` |
| web | frontend-mobile | (consumes API only) |

Publishing an event you do not own is a bug. It is how two modules end up
fighting over one record.

## 4. Integration order

Sequential where dependencies are real, parallel where they are not.

```
Sprint 0   contracts + platform-core            (everything blocks on this)
Sprint 1   trade-flow  ‖  sourcing-quality      (parallel, both consume platform)
Sprint 2   finance-commission                   (consumes trade events)
Sprint 3   logistics-warehouse                  (consumes sourcing + finance events)
Sprint 4   frontend-mobile                      (consumes all APIs)
```

After every sprint: `contracts-guardian` reviews the diff, then
`conformance-runner` runs the suite. No sprint is complete until both report clean.

## 5. Handoff format

When a module finishes, it writes `docs/handoff/<module>.md`:

- endpoints exposed, with auth requirements
- events published, with a real example payload
- events consumed
- Prisma models added
- assumptions taken
- what is stubbed and what is real
- conformance assertions now covered

The next agent reads this file rather than reading your code. Write it for
someone with no context, because that is literally who reads it.

## 6. What must never drift

These four are checked on every review:

1. Money is `Minor` integers. No floats.
2. Policy numbers come from `policy.ts`. No literals in module code.
3. Authorisation is enforced in services, not controllers.
4. Independent gates get independent fields. Never one status column for two
   concerns.
