Module:     logistics-warehouse
Need:       A readable-id pattern for tracking events (TrackingEvent).
Shared?     Yes — the web timeline screen and any customer-facing tracking view render
            the ref; it must match the shared ID_PATTERNS formatter like every other ref.
Proposed:   add `tracking: 'TRK-{year}-{seq:4}'` to ID_PATTERNS in packages/contracts/src/ids.ts
Breaking?   No, additive.
Blocked?    No — rendering it locally in apps/api/src/logistics/logistics-ids.ts::trackingRef
            meanwhile (marked `// TODO: pending contract-request`).


---
Status: ACCEPTED (CTO acting as contracts-guardian; guardian agent stalled on infra). Additive change committed to packages/contracts; logistics module re-pointed.
