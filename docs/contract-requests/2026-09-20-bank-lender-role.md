Status:     PROPOSED — awaiting contracts-guardian.
Module:     umurimo / planning (Unguka cohort visibility)
Need:       Paulin (Unguka Bank / LOLC) needs his own workplace in Nexus OS — read access to
            the cohort of candidates he referred, their readiness/training status, and the
            vehicle proposed against each, plus the ability to comment on that cohort's
            funding track and raise/answer requests there. Today there is no login role for
            a bank at all: `Role` has `logistics_partner` as the only precedent for a
            narrowly-scoped, expiry-limited EXTERNAL account, and nothing for a lender.

            This is the second half of the "external role" gap this register already has one
            open request against — `2026-09-14-supplier-self-service-role.md` proposes
            `supplier` for Mediateur/Mento. `bank` is the same shape of problem
            (an external counterparty who must see a narrow slice, never internal pricing or
            other cohorts) and should land the same way: additive `Role` member, additive
            `Actor.scope` field, additive `ROLE_GRANTS` entry, additive `inScope` case.
Shared?     Yes — `Role`, `Actor.scope`, `ROLE_GRANTS`, `inScope` and `CONFIDENTIAL_FIELDS`
            all live in the kernel (permissions.ts); web/frontend-mobile needs to authenticate
            a bank account and render a narrower UI around it, same as any other role.
Proposed:   1. Add `'bank'` to the `Role` union.
            2. Add `bankKey?: string` to `Actor.scope`, alongside the existing
               `customerId`/`customerIds`/`shipmentRefs` — mirrors how `logistics_partner`
               carries `shipmentRefs`. A bank's Actor is scoped to exactly one `bankKey`
               (e.g. `"unguka"`), matching the `lenderKey` convention already used in the
               Mobility codebase (`Bank.lenderKey`, `LenderConsent.lenderKey`) — reuse that
               string, don't invent a second identifier for the same bank.
            3. `ROLE_GRANTS['bank']`, deliberately minimal:
                   'initiative:read',   // scoped to their own cohort's initiatives only
                   'funding_track:read',// scoped to their own cohort's funding track only
                   'comment:read',
                   'comment:write',
               Deliberately EXCLUDES everything else — no `decision:*`, no `weekly_report:*`,
               no `memo:*` beyond what `comment` already covers. A bank is a counterparty
               reading and discussing its own referral, not a participant in Nexus's internal
               operating rhythm (My Week, Monday Digest, minutes-ingest — all `umurimo`
               capabilities stay `NONE` for this role, same as `logistics_partner` today).
            4. `inScope` (permissions.ts) needs a `case 'bank'` arm: an initiative or funding
               track is in scope only when it names the bank's own `bankKey` (e.g. a
               `Scopable.bankKey` field, or by matching on the record's own lender-key field
               where one exists) — mirroring the `logistics_partner` case's shape
               (`obj.shipmentRef` against `actor.scope.shipmentRefs`).
            5. Per-candidate vehicle/readiness detail (what the founder is calling "the
               Unguka cohort dual-workplace approval feature") is NOT part of this request —
               that needs its own data model decision (which record a bank-scoped `initiative`
               actually points at) and is intentionally left for a separate, later request
               once that shape is settled. This request only unblocks the LOGIN and the
               narrow read/comment grant a bank account needs to exist at all.
Breaking?   No — additive `Role` member, additive `Actor.scope` field, additive
            `ROLE_GRANTS` entry, additive `inScope` case. No existing Role, grant, scope
            field, or inScope case is touched.
Blocked?    Fully, for Paulin specifically — unlike the StageNote request from the same day
            (which `ceo`'s existing `'*:*'` grant already covers), there is no role today a
            bank login can be given even at the narrowest level. Nothing external-facing can
            be built for Paulin until this lands. In the meantime, his questions continue to
            be answered by a UZA staff member reading Gratien's Deals Board on his behalf,
            not by a login of his own.
