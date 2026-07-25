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
