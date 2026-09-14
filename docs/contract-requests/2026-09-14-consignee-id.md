Module:     logistics-warehouse
Need:       A readable-id pattern for the new `Consignee` record (name, TIN, phone, address,
            email — the receiving party for a Package/Shipment's communications, distinct
            from the ordering `Customer`).
Shared?     Yes — any future customer-facing or partner-facing screen that renders a
            consignee should render the same `ref` shape as every other record, formatted
            through the shared `formatId` helper like every other pattern in `ID_PATTERNS`.
Proposed:   add `consignee: 'CNE-{seq:5}'` to `ID_PATTERNS` in packages/contracts/src/ids.ts
Breaking?   No, additive.
Blocked?    No — rendered locally in apps/api/src/logistics/logistics-ids.ts::consigneeRef
            meanwhile (marked `// TODO: pending contract-request`), following the exact
            precedent of 2026-07-26-tracking-id.md.
