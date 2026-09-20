Status:     PROPOSED — awaiting contracts-guardian.
Module:     command (Mobility journey / vendor-inbox bridge)
Need:       The founder wants to "comment on" any stage of the Mobility driver journey
            and any vendor/supplier submission from inside Nexus OS — a lightweight,
            append-only, timestamped note, distinct from a `CommandTask`.

            `CommandTask` (apps/api/src/command/command.controllers.ts) already covers
            COMMANDING via its free-string `linkedRef` — no gap there. It does not cover
            COMMENTING: `CreateTaskDto.assigneeId` is required (a note should not force
            picking an assignee), and a task's single mutable `description` plus its
            todo/in_progress/blocked/done/cancelled lifecycle is the wrong shape for a
            running log of observations.

            The new `StageNote` model, its Prisma table and its readable-id pattern are
            being built MODULE-LOCAL (apps/api/src/command/stage-note-ids.ts), the same
            way `CommandTask`/`Grant` ids are module-local today (command-ids.ts) — this
            needs no kernel change. What DOES need the kernel: `ceo` already holds
            `'*:*'` in ROLE_GRANTS so a founder-only rollout needs nothing, but the whole
            point of a command center is that `venture_manager` and other staff should
            eventually read and add notes too, and only contracts-guardian may touch
            ROLE_GRANTS.
Shared?     Yes — ROLE_GRANTS and Role live in the kernel (permissions.ts); any resource
            string added to a non-ceo role's grant list is a kernel change by definition,
            and web/frontend would need to render the new capability.
Proposed:   1. Add to ROLE_GRANTS['venture_manager']: 'stageNote:create', 'stageNote:read'.
            2. No change to `Role`, `Actor.scope`, or `inScope` — a `StageNote` is not
               object-scoped the way a customer/shipment/supplier record is; it is
               visible to anyone holding `stageNote:read`, gated at the route the same
               way `empower` gates on `initiative:read` today.
            3. No `ID_PATTERNS` addition — `StageNote` refs stay module-local (e.g.
               `SNOTE-{year}-{seq:4}`), same disposition as `CTSK-`/`GRNT-` today.
Breaking?   No — additive ROLE_GRANTS entries only. No existing Role, grant, scope field,
            or inScope case is touched.
Blocked?    Not for `ceo`. The founder can use `StageNote` today, ungated by this
            request, because `ceo: ['*:*']` already covers any resource string. This
            request only unblocks a SECOND role (`venture_manager`) from reading/writing
            notes; until it lands, `StageNote` create/read stays effectively ceo-only in
            the service layer (`assertRole(actor, 'stageNote:read', ...)` will simply
            reject `venture_manager` with today's contract, which is correct and not a
            workaround).

---

Context this request was drafted against (2026-09-20 Mobility-journey design pass):

**Endpoints.** uza-mobility-bn already has real admin controllers for nearly every
journey stage: `admin-users.controller.ts` (registration/screening), `academy.controller.ts`
+ `admin-training-courses.controller.ts` (training), `admin-financing.controller.ts` /
`admin-loans.controller.ts` / `admin-loan-lifecycle.controller.ts` / `fund-application.controller.ts`
(financing), `admin-fleet.controller.ts` (vehicle allocation — since extended by the new
`src/modules/allocation/` module), `admin-stations.controller.ts` (charging),
`admin-mechanics.controller.ts` / `inspections.controller.ts` / `job-cards.controller.ts`
(garages/maintenance/inspections), `admin-wallets.controller.ts` (wallet). Nothing needs
building there for Phase 1 reads except one new aggregate:
`GET /admin/mobility/journey-overview/:driverId` returning
`{ driver, registration, training, financing, allocation, charging, wallet, lastUpdatedAt }`
— otherwise Nexus needs 7+ round trips per driver card.

The vendor side did not exist as of the design pass, but has since been built the same
session: `src/modules/suppliers/` in uza-mobility-bn now has `POST /suppliers/register`,
staff CRUD, and offer review endpoints — Phase 2 below can proceed sooner than planned.

**uza-nexus bridge** — extend the existing `apps/api/src/empower/*` pattern
(`EmpowerClientService`'s `.safe()` wrapper, scoped service-account creds against
`MOBILITY_API_URL`) with a sibling module `apps/api/src/mobility-journey/`:
- `GET /mobility/journey/:driverId` → proxies the new aggregate
- `GET /mobility/journey?stage=financing&status=pending` → list proxy
- `GET /mobility/vendors`, `GET /mobility/vendors/:id/orders` → now buildable, since
  uza-mobility-bn's supplier module already ships
- Deliberately no new mutating proxy. "Commanding" happens entirely inside Nexus via
  `CommandTask.linkedRef` (e.g. `mobility:driver:<id>`, `mobility:supplier:<id>`), never
  by Nexus writing into Mobility's database.

**Phased build order:**
- Phase 1 (buildable now): mobility-journey proxy module in Nexus hitting the 7 existing
  mobility-bn admin controllers individually; `StageNote` shipped ceo-only (needs zero
  contract or mobility-bn changes).
- Phase 2: mobility-bn adds the `/admin/mobility/journey-overview/:driverId` aggregate;
  Nexus adds `/mobility/vendors*` proxies against the now-real supplier module; this
  contract-request lands, unlocking `venture_manager` access to StageNote.
- Phase 3: vendor inbox UI (approve/reject submissions, review SupplyOrder/Vehicle/Payment),
  auto-`CommandTask` on new vendor submissions, UZA Move economics wired into journey
  cards with explicit unverified badges (see risk note below).

**Risk note, unrelated to this request but load-bearing for anything built on top of it:**
`apps/uza-move/src/config/policy.ts` marks `UZA_VEHICLE_SELLING_PRICE`,
`MIN_CLIENT_CONTRIBUTION`, `BANK_DEPOSIT_BPS`, `LANDING_COST_DISCOUNT_BPS`,
`INVESTOR_MARGIN_SHARE_BPS`, `INVESTOR_RETURN_MIN/MAX_BPS` as
`UNVERIFIED — invented by the Lovable build agent`, despite originally being mislabeled
`CONFIRMED`. Any Nexus financing/allocation journey card or vendor-order margin view built
on these numbers must render them with an explicit "unverified, pending founder
confirmation" badge — never as settled fact — until Yves confirms each and
`POLICY_VERSION` is bumped from `2026-09-02`.
