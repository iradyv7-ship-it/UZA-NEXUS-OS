Module:     finance-commission
Need:       Readable-id patterns for forwarder claims, petty cash and supplier bank-change requests
Shared?     Yes — logistics reads claims; front office reads petty cash; these refs surface in the web app
Proposed:   add to ID_PATTERNS:
              claim:      'CLM-{year}-{seq:4}'
              pettyCash:  'PC-{office}-{year}-{seq:4}'
              bankChange: 'SBC-{year}-{seq:4}'
Breaking?   No, additive (new keys only; existing patterns untouched)
Blocked?    No — rendering these locally in apps/api/src/finance/finance-ids.ts meanwhile,
            marked `// TODO: pending contract-request`, exactly as sourcing did for its
            supplier/rfq/supplierQuote patterns.

---

Status:     ACCEPTED (2026-07-26) — contracts-guardian
Contract:   packages/contracts/src/ids.ts — ADDITIVE. Three new keys appended to
            ID_PATTERNS; no existing pattern touched; @uza/contracts typechecks clean.
              claim:      'CLM-{year}-{seq:4}'
              pettyCash:  'PC-{office}-{year}-{seq:4}'
              bankChange: 'SBC-{year}-{seq:4}'
Rationale:  IDs are definitionally shared (CF-001) — these refs surface in the web app
            and are read cross-module (logistics reads claims, front office reads petty
            cash). Same disposition as sourcing's supplier/rfq/supplierQuote in Sprint 1.
            The rendered shapes match exactly what finance already emits locally, so no
            id already written to the DB changes.

Migration list (finance module — CTO follow-up, NOT done here):
  - apps/api/src/finance/finance-ids.ts — re-point claimRef / pettyCashRef /
    bankChangeRef to formatId('claim'|'pettyCash'|'bankChange', …); delete the local
    `pad` helper and the `// TODO: pending contract-request` markers.
  No other finance file changes: invoice/payment/claim/petty-cash/supplier-bank
  services import the ref helpers from finance-ids and are unaffected by the switch.
