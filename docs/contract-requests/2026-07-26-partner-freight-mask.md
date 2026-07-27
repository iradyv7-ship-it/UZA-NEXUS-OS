Module:     logistics-warehouse
Need:       Freight cost on the Shipment must be masked from a logistics_partner. Rule 12
            of the constitution: "a logistics partner sees weight and CBM and nothing behind
            it." CONFIDENTIAL_FIELDS currently masks supplier cost / PO total / margins, but
            NOT the freight-cost fields that live on the shipment the partner reads.
Shared?     Yes — masking is driven by @uza/contracts CONFIDENTIAL_FIELDS + maskFields, the
            single enforcement mechanism; every partner read path relies on it.
Proposed:   add to CONFIDENTIAL_FIELDS (visible to ceo/venture_manager/finance, i.e. NOT
            logistics_partner):
              freightPaidMinor:   ['ceo', 'venture_manager', 'finance']
              billedRevenueTon:   ['ceo', 'venture_manager', 'finance']
              measuredRevenueTon: ['ceo', 'venture_manager', 'finance', 'china_warehouse']
            (measuredRevenueTon is a volumetric the warehouse legitimately needs; only the
            monetary freight figures are strictly cost. Tune the role lists as preferred.)
Breaking?   No, additive to a map.
Blocked?    No — PartnerPortalService masks these keys locally for logistics_partner
            (LOGISTICS_CONFIDENTIAL, marked pending) via the same MASK sentinel meanwhile.
            When the contract lands, delete the local override and authz.mask alone suffices.


---
Status: ACCEPTED (CTO acting as contracts-guardian; guardian agent stalled on infra). Additive change committed to packages/contracts; logistics module re-pointed.
