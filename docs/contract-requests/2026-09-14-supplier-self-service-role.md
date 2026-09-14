Status:     PROPOSED — awaiting contracts-guardian.
Module:     sourcing-quality
Need:       A founder request (2026-09-14) asks for "a supplier-facing self-service
            channel for submitting a deal/offer proactively — not only responding to an
            RFQ UZA initiated. This needs real supplier identity/access, scoped narrowly
            (a supplier should see and manage only their own submitted offers, nothing
            else in the system)."

            A fresh audit of @uza/contracts confirms: `Role` (permissions.ts) has no
            `supplier` entry. The only external-facing, expiry-limited account kind today
            is `logistics_partner`. Suppliers cannot authenticate into this system at all —
            a real, confirmed gap, not an oversight to route around quietly.

            I am NOT making this change myself (CLAUDE.md §3: only contracts-guardian
            modifies packages/contracts). This request proposes the shape; in the
            meantime I built the staff-relayed half of the channel against the EXISTING
            contract (see "Blocked?" below) — `SupplierOfferService` in
            apps/api/src/sourcing/offer/supplier-offer.service.ts.
Shared?     Yes. A new Role is definitionally shared: `permissions.ts` `Role`, `Actor`,
            `ROLE_GRANTS`, `CONFIDENTIAL_FIELDS` and `inScope` all live in the kernel, and
            web/frontend-mobile would need to authenticate a supplier account and render a
            narrower UI around it.
Proposed:   1. Add `'supplier'` to the `Role` union in permissions.ts.
            2. Add an object-scope shape to `Actor.scope` — e.g. `supplierRef?: string` —
               so a supplier's Actor carries WHICH supplier record it is. This mirrors
               `scope.customerId`/`scope.customerIds` for `sales_agent` and
               `scope.shipmentRefs` for `logistics_partner`; a supplier is exactly as
               narrowly scoped as those two external roles, arguably narrower (it should
               see NOTHING else in the system, not even other suppliers' price history —
               the founder was explicit that supplier price/quality history is a
               competitive UZA asset, not something to expose supplier-to-supplier).
            3. ROLE_GRANTS['supplier']: a minimal set —
                   'supplierQuote:create',   // submit a proactive offer
                   'supplierQuote:read',     // read ONLY its own (scoped)
                   'supplierQuote:update',   // edit/withdraw its own offer pre-acceptance
               Deliberately EXCLUDES 'supplier:*' (a supplier must never read or edit its
               own Supplier record — lifecycle, score, certifications are UZA's
               internal assessment of them) and EXCLUDES 'po:*'/'rfq:*' (RFQs and purchase
               orders stay UZA-internal; a supplier answers an RFQ via `SupplierQuote`,
               which already exists).
            4. `inScope` (permissions.ts) needs a `case 'supplier'` arm: an offer/quote is
               in scope only when `obj.supplierRef === actor.scope.supplierRef`. This is a
               new `Scopable` field (`supplierRef`) alongside the existing
               `customerId`/`agentId`/`shipmentRef`.
            5. Consider whether `SupplierOffer`/`SupplierQuote` need a `submittedBy: 'staff'
               | 'supplier'` (or reuse `channel`, already on SupplierOffer in my migration)
               so a supplier-submitted-via-portal row is distinguishable from a
               staff-relayed one, for audit purposes. Not strictly a contract concern
               (it's already a plain string column on my new model) but flagging since
               `channel` semantics would become load-bearing once real supplier auth lands.
Breaking?   No — additive `Role` member, additive `Actor.scope` field, additive
            `ROLE_GRANTS` entry, additive `inScope` case, additive `Scopable` field. No
            existing Role/grant/case changes.
Blocked?    Partially. A full supplier LOGIN cannot be built without this — I did not fake
            one. What IS built and real against the CURRENT contract:
              - `SupplierOfferService` (apps/api/src/sourcing/offer/supplier-offer.service.ts):
                china_sourcing staff relay a supplier's proactive offer
                (`channel: 'staff_relay'`, `relayedBy: <staff actor>`,
                `supplierContact: <free text — phone/WeChat/email of the supplier rep>`).
                Authorised on the EXISTING `supplierQuote:*` grant (china_sourcing already
                holds it) rather than a new resource string, so it needs NO new grant today.
              - Attachments (images / inspection report / battery-health certificate),
                accept/decline review, and the two-stage `SupplierDeal` payment machine
                (docs/contract-requests/2026-09-14-supplier-deal-ids-policy-and-masking.md)
                are all built and unit-tested against this staff-relayed path now.
              - When this request lands: swap `channel: 'staff_relay'` for a real
                `'supplier_portal'` value written by a `supplier`-scoped Actor, and add the
                `inScope` narrowing so a supplier's own `SupplierOfferService.submit`/`read`
                calls stop needing a staff actor at all. No schema change needed — the
                `channel`/`relayedBy` columns already anticipate this.
