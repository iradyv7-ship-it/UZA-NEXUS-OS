Module:     logistics-warehouse
Need:       Cecilia (an internal logistics coordinator in the China warehouse/logistics ops
            team) needs to book shipments, fill in vessel/voyage/departure/transit-time
            details, assign container numbers, tag the venture (BULK/MOBILITY/...), and
            attach a consignee — as ROUTINE, DAILY work, not as a `venture_manager` (a
            trusted-admin role with `lead:*`/`quotation:*`/`order:*` far beyond this job) and
            not as `china_warehouse` (that role's grants — `visit:*`, `inspection:*`,
            `receipt:*`, `package:*` — are receiving/QC-shaped; it deliberately holds NO
            `shipment:*` grant today per the Sprint-3 handoff). Today only `venture_manager`
            and `ceo` can call `ContainerService.createShipment` / `TrackingService.*` /
            `FreightService.*`. This is the gap the 2026-09-14 audit calls "no ops-workspace
            role for logistics staff" and explicitly asks to close via
            "`china_warehouse` or `logistics_partner`'s internal counterpart... if no
            existing role fits... write the request doc, don't invent the grant".
Shared?     Yes — `Role`, `ROLE_GRANTS`, and `inScope` all live in
            packages/contracts/src/permissions.ts; a new role touches the same union every
            other role does, and apps/web's `Role`/`Actor` mirror (apps/web/src/lib/session.ts)
            needs the same addition to stop drifting from the API's type.
Proposed:   add a new role `logistics_coordinator` to `Role` with grants:
              shipment:*, package:read, package:update, tracking:*, delivery:read,
              consignee:*, customer:read
            (deliberately NOT `order:*`/`quotation:*`/`invoice:*`/margin/cost fields — this
            role plans and moves freight, it does not see commercial terms. Freight
            monetary figures already sit in CONFIDENTIAL_FIELDS gated to
            ceo/venture_manager/finance, so even with `shipment:*` this role would see
            weight/CBM/vessel/tracking but not freightPaidMinor/billedRevenueTon unless also
            added there — deliberately left OUT of this proposal so cost visibility is a
            separate founder decision.)
Breaking?   No, additive to the `Role` union + `ROLE_GRANTS` map.
Blocked?    No — the new ops-workspace endpoints/service methods built in this pass
            (`ShipmentDetailsService`, `ConsigneeService`, `PartnerRateService`) are
            authorised against the EXISTING `shipment:create` / `package:update` grants,
            which today only `venture_manager` and `ceo` hold. The web ops workspace
            (apps/web `/ops/shipments`) is therefore only usable by a `venture_manager`/`ceo`
            session until this role lands — flagged plainly in the handoff, not hidden.
            When accepted: swap the workspace's role gate from `venture_manager` to
            `logistics_coordinator` and re-run the authorisation tests (no service-layer
            logic changes needed, since authorisation already reads `ROLE_GRANTS` generically).
