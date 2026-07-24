# Conformance Specification

30 business assertions, all passing in `reference/` (the Python spike that
validated this design). The TypeScript build must reproduce every one.

Where the build and the reference disagree, **the reference is right** until a
founder decision says otherwise.

Run the reference oracle any time: `cd reference && python3 run_scenarios.py`

Contract-level assertions already run with no database:
`node --experimental-strip-types tests/conformance/contracts.test.ts` → 13 pass.
The rest need the API and land with platform-core.

| ID | Assertion | Module | Covered |
|---|---|---|---|
| CF-001 | Readable IDs follow the documented patterns | platform | pending API |
| CF-002 | Quoted margin holds at the sell incoterm | trade | contract |
| CF-003 | DAP margin is computed and exposed alongside the quoted margin | trade | contract |
| CF-004 | Freight rungs carry the contingency factor | trade | pending API |
| CF-005 | A new client's order generates a 50/50 schedule | trade | contract |
| CF-006 | An established client's order generates 30/40/30 | trade | contract |
| CF-007 | A short payment is rejected, naming the shortfall | finance | pending API |
| CF-008 | Only Finance can verify a payment | finance | pending API |
| CF-009 | Procurement activates on the verified confirmation installment | finance | pending API |
| CF-010 | Commission accrues 2% at confirmation, not at delivery | finance | pending API |
| CF-011 | A critical defect fails inspection and opens a CAPA | quality | pending API |
| CF-012 | A CAPA closes only against a passing reinspection | quality | pending API |
| CF-013 | Variance beyond the hard stop freezes the goods | warehouse | pending API |
| CF-014 | **QC release does not clear the commercial variance hold** | warehouse | pending API |
| CF-015 | Declared-vs-measured variance lowers the supplier score | sourcing | pending API |
| CF-016 | Gate 1: unresolved variance blocks container booking | logistics | pending API |
| CF-017 | Gate 2: an unpaid pre-loading installment blocks booking | logistics | pending API |
| CF-018 | Gate 3: a mixed-destination container is rejected | logistics | pending API |
| CF-019 | A container books once all three gates clear | logistics | pending API |
| CF-020 | Forwarder over-billing raises a claim, not a client conversation | finance | pending API |
| CF-021 | Freight allocates pro-rata by revenue ton | logistics | contract |
| CF-022 | Tracking events separate confirmed from estimated | logistics | pending API |
| CF-023 | A delay notifies client, agent, owner, front office and partner | logistics | pending API |
| CF-024 | A sales agent cannot read supplier records | platform | contract |
| CF-025 | An agent sees customer price but never cost or margin | platform | contract |
| CF-026 | A partner sees volumetrics but never cost | platform | contract |
| CF-027 | A customer cannot read another customer's project | platform | contract |
| CF-028 | Goods release requires full payment | finance | pending API |
| CF-029 | Realized margin computes from actuals, quoted stays intact | trade | contract |
| CF-030 | Clawback reverses commission and leaves both ledger rows | finance | pending API |

## Notes

**CF-014 is not theoretical.** In the reference implementation, QC release and
the variance hold both wrote to one `zone` field, so releasing inspection
silently cleared the commercial hold and goods would have sailed with an
unresolved freight overage. Two independent gates must never share one field.

**CF-023** checks fan-out, not wording. Five distinct recipients, each with a
message appropriate to their role.

**CF-030** checks that the ledger retains the accrual *and* the clawback as
separate rows. A corrected balance with no history is a failure, not a pass.
