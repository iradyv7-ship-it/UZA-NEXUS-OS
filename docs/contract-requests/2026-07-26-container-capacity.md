Module:     logistics-warehouse
Need:       A founder-tunable container revenue-ton capacity, used to report container
            utilisation (totalRevenueTon / capacity) alongside the per-container freight
            P&L. This is directly tied to the OPEN FOUNDER DECISION on container
            utilisation (CLAUDE.md §7): destination-pure containers sailed ~66% full in the
            reference, and the founder needs the utilisation series to judge the policy.
Shared?     Yes — reporting and any commercial screen that shows utilisation must read one
            number, not re-inline 28.0.
Proposed:   add `CONTAINER_RT_CAPACITY = 28.0` (revenue tons) to packages/contracts/src/policy.ts
Breaking?   No, additive.
Blocked?    No — rendered locally in apps/api/src/logistics/logistics-policy.ts, marked
            `// TODO: pending contract-request`. It never gates anything, only reports.


---
Status: ACCEPTED (CTO acting as contracts-guardian; guardian agent stalled on infra). Additive change committed to packages/contracts; logistics module re-pointed.
