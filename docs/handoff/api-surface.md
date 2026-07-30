# Handoff — API surface + auth binding (Phase 4a / Sprint 4a)

Written for the frontend agent. This is the HTTP surface every domain module deferred to
"web/Sprint 4", plus the JWT auth binding that was tracked follow-up #1. Nothing in the
service layer or `packages/contracts` changed — controllers are thin: they parse the
request, call the existing service with the authenticated `Actor`, and return the
(already-masked) result. **All authorisation, object-scope and field-masking stay in the
services** via `AuthorizationService.authorize(...)`; the API is the delivery mechanism,
not a second enforcement point.

Branch: `sprint-4a-api-surface`. Stack unchanged (NestJS + Prisma + Postgres, SWC runtime).
OpenAPI is live at **`/docs`** (JSON at `/docs-json`) — 68 paths. Build against that.

---

## Authentication

- **`POST /auth/login`** (public) → `{ accessToken, actor, mfaRequired }`. The `actor` is the
  exact `@uza/contracts` `Actor` (`{ userId, role, office, scope }`).
- **`GET /auth/google`** (public) → **302** redirect to Google's OAuth 2.0 consent screen
  (scopes `openid email profile`, a signed short-lived `state` for CSRF, `access_type=online`).
  Returns **503** `{ "error": "google_signin_not_configured" }` when the Google env vars are
  not all set (the app still boots without them).
- **`GET /auth/google/callback?code=&state=`** (public) → validates `state`, exchanges the
  `code`, **verifies the Google ID token** (`OAuth2Client.verifyIdToken`, requires
  `email_verified`), matches an **existing active** user by email (case-insensitive) and
  returns the **same** `{ accessToken, actor, mfaRequired }` shape as `POST /auth/login`.
  No auto-provisioning: an unknown/disabled/expired/MFA-enabled account → **401** (audited as
  `NO_MATCHING_USER` / `ACCOUNT_DISABLED` / `ACCOUNT_EXPIRED` / `MFA_REQUIRED`). **503** when
  unconfigured. Google-authenticated users get exactly the role/scope on their user record —
  the authorisation model is unchanged. Full flow + Google Cloud setup: `google-signin.md`.
- Send the token on every other request: `Authorization: Bearer <accessToken>`.
- A global `JwtAuthGuard` protects **every** route. Only `POST /auth/login`, `GET /auth/google`,
  `GET /auth/google/callback` and `GET /health` are `@Public()`. Swagger (`/docs`, `/docs-json`)
  is served by the adapter and is open.
- The guard verifies the token, then **reconstructs the full `Actor` from the persisted user**
  (not the token body), so a scope/role change lands on the next request and a
  disabled/expired principal is refused even mid-token. Partner-account expiry is honoured.
- `401` = missing/invalid/expired token or unknown/disabled/expired principal.

## Error → HTTP status mapping

Domain errors are `UzaError` (stable `code`, `message`, optional `nextAction`/`context`).
A global filter maps them; localise from `code`, not the English `message`.

| Source | Status | Body |
|---|---|---|
| `UzaError ACCESS_DENIED_ROLE` / `ACCESS_DENIED_SCOPE` | **403** | `{ statusCode, error: UzaErrorDetail }` |
| `UzaError PAYMENT_SHORT`, `DEPOSIT_BELOW_MINIMUM`, `PAYMENT_NOT_VERIFIED`, every `GATE_*` (booking/QC/release), `CAPA_REINSPECTION_FAILED` | **409** | `{ statusCode, error: UzaErrorDetail }` |
| `NotFoundException` (unknown ref) | **404** | Nest default |
| `ValidationPipe` (bad/missing DTO field) | **400** | Nest default |
| `UnauthorizedException` (guard/login) | **401** | Nest default |
| success on `POST` | **201** | resource JSON |
| success on `GET`/`PATCH` | **200** | resource JSON |

> Gate failures are `409 Conflict` (a precondition/state the caller can act on), not `400`
> (which is reserved for a malformed request the ValidationPipe rejects).

---

## Route table

Auth column = the `resource:action` the **service** checks (per `ROLE_GRANTS`). The guard
only authenticates; the service authorises + masks. `(scoped)` = object-scope is enforced.

### trade
| Method | Path | Auth (service check) | Body / params | Service.method |
|---|---|---|---|---|
| POST | `/customers` | `customer:create` | `{name,country,phone,agentId?}` | `CustomerService.create` |
| GET | `/customers/:ref` | `customer:read` (scoped, masked) | — | `CustomerService.read` |
| POST | `/leads` | `lead:create` | `{customerRef,rawText,agentId?}` | `IntakeService.createLead` |
| POST | `/leads/:ref/clarify` | `request:create` | `{spec}` | `IntakeService.clarifyLead` |
| POST | `/projects` | `project:create` | `{requestRef,name,owner}` | `ProjectService.create` |
| GET | `/projects` | `project:read` (scoped, masked; paginated) | query `customerRef?`, `stage?`, `limit?`, `offset?` | `ProjectService.list` |
| GET | `/projects/:ref` | `project:read` (scoped) | — | `ProjectService.read` |
| POST | `/projects/:ref/tasks` | `task:create` | `{title,accountable,responsible}` | `ProjectService.createTask` |
| POST | `/quotations` | `quotation:create` | `{projectRef,supplierUnitCostMinor,estCostsMinor,qty,requiredMargin,sellIncoterm?}` | `QuotationService.build` |
| GET | `/quotations` | `quotation:read` (scoped; cost/margins masked; paginated) | query `projectRef?`, `status?`, `limit?`, `offset?` | `QuotationService.list` |
| POST | `/quotations/:ref/revise` | `quotation:create` | pricing (as above, no `projectRef`) | `QuotationService.revise` |
| POST | `/quotations/:ref/approve` | `quotation:approve` | — | `QuotationService.approve` |
| POST | `/quotations/:ref/close-costs` | `margin:read` | `{actualsMinor}` | `QuotationService.closeCosts` |
| GET | `/quotations/:ref` | `quotation:read` (scoped; cost/margins masked) | — | `QuotationService.read` |
| POST | `/orders` | `order:create` | `{quotationRef}` | `OrderService.create` |
| GET | `/orders` | `order:read` (scoped, masked; paginated) | query `status?`, `customerRef?`, `limit?`, `offset?` | `OrderService.list` |
| POST | `/orders/:ref/cancel` | `order:update` | `{reason}` | `OrderService.cancel` |
| GET | `/orders/:ref` | `order:read` (scoped) | — | `OrderService.read` |

> **List endpoints (`GET /projects`, `GET /quotations`, `GET /orders`).** Same security
> posture as the by-ref reads, expressed as a query predicate — a list never returns a row
> the by-ref read would deny. Object-scope mirrors `inScope` (`packages/contracts`):
> `ceo`/`venture_manager`/`finance`/`china_*`/`front_office` see all rows (they pass
> `inScope` unconditionally, where the role also holds the read grant); a `sales_agent` sees
> only rows where `agentId === userId` OR `customerRef ∈ scope.customerIds`; a `customer`
> sees only rows where `customerRef === scope.customerId`. The role grant is checked first
> (no grant → `403 ACCESS_DENIED_ROLE`, e.g. `sales_agent` on `/projects`, `finance` on
> `/quotations` — matching the by-ref reads). Optional filters (`customerRef`/`stage`/
> `projectRef`/`status`) only NARROW scope (AND-composed), never widen it. Quotation rows
> are masked identically to `GET /quotations/:ref` (cost/target/walkaway + both margins →
> `***` for unauthorised roles). **Pagination:** `limit` (default 20, max 100) + `offset`
> (default 0), both validated (`400` on non-int/out-of-range); stable sort `updatedAt desc`.

### sourcing
| Method | Path | Auth | Body / params | Service.method |
|---|---|---|---|---|
| POST | `/suppliers` | `supplier:create` | `{nameEn,nameZh,country?,relationshipOwnerId?,clientRequestId?}` | `SupplierService.register` |
| PATCH | `/suppliers/:ref/lifecycle` | `supplier:update` | `{lifecycle}` | `SupplierService.setLifecycle` |
| POST | `/suppliers/:ref/certifications` | `supplier:update` | `{name,issuer?,number?,issuedAt?,expiresAt?}` | `SupplierService.addCertification` |
| GET | `/suppliers/:ref` | `supplier:read` (masked) | — | `SupplierService.read` |
| POST | `/rfqs` | `rfq:create` | `{projectRef,detail?,clientRequestId?}` | `RfqService.createRfq` |
| POST | `/supplier-quotes` | `supplierQuote:create` | `{supplierRef,projectRef,rfqRef?,unitCostMinor,moq,leadTimeDays,unitCbm,unitKg,basis?,clientRequestId?}` | `RfqService.addQuote` |
| GET | `/supplier-quotes/:ref` | `supplierQuote:read` (cost masked) | — | `RfqService.read` |
| POST | `/purchase-orders` | `po:create` | `{supplierRef,orderRef,quoteRef?,qty,unitCostMinor,unitCbm,unitKg,clientRequestId?}` | `PurchaseOrderService.create` |
| GET | `/purchase-orders/:ref` | `po:read` (cost/total masked) | — | `PurchaseOrderService.read` |

### quality
| Method | Path | Auth | Body / params | Service.method |
|---|---|---|---|---|
| POST | `/visits` | `visit:create` | `{poRef,inspectorId,clientRequestId?}` | `VisitService.assign` |
| GET | `/visits/:ref` | `visit:read` | — | `VisitService.read` |
| POST | `/inspections` | `inspection:create` | `{visitRef,stage,critical,major,minor,evidence?,capturedOffline?,clientRequestId?}` | `InspectionService.record` |
| GET | `/inspections/po/:poRef/releasable` | `inspection:read` | — (throws `GATE_QC_NOT_RELEASED`→409) | `InspectionService.assertReleasable` |
| GET | `/inspections/:ref` | `inspection:read` | — | `InspectionService.read` |
| POST | `/capas/:ref/draft` | `capa:update` | `{text,draftedBy}` | `CapaService.draftCorrectiveAction` |
| POST | `/capas/:ref/close` | `capa:approve` | `{reinspectionRef}` | `CapaService.close` |
| GET | `/capas/:ref` | `capa:read` | — | `CapaService.read` |

### finance
| Method | Path | Auth | Body / params | Service.method |
|---|---|---|---|---|
| GET | `/invoices/:ref` | `invoice:read` (scoped, masked) | — | `InvoiceService.read` |
| GET | `/invoices/order/:orderRef` | `invoice:read` (scoped, masked) | — | `InvoiceService.readByOrder` |
| GET | `/invoices/order/:orderRef/release-eligibility` | `invoice:read` (scoped) | — | `InvoiceService.releaseEligibility` |
| POST | `/payments` | `payment:create` (scoped) | `{invoiceRef,amountMinor,proofRef,targetTrigger}` | `PaymentService.uploadProof` |
| POST | `/payments/:ref/verify` | `payment:approve` (**finance/ceo only**) | — | `PaymentService.verify` |
| POST | `/payments/:ref/reject` | `payment:approve` | `{reason}` | `PaymentService.reject` |
| GET | `/payments` | `payment:read` (scoped, masked; paginated) | query `status?`, `invoiceRef?`, `limit?`, `offset?` | `PaymentService.list` |
| GET | `/payments/:ref` | `payment:read` (scoped, masked) | — | `PaymentService.read` |
| POST | `/commissions/payouts` | `commission:payout` | `{agentId,orderRef,amountMinor}` | `CommissionService.recordPayout` |
| GET | `/commissions/agents/:agentId/balance` | `commission:read` (scoped) | — | `CommissionService.balanceFor` |
| GET | `/commissions/agents/:agentId/ledger` | `commission:read` (scoped) | — | `CommissionService.ledgerFor` |
| GET | `/forwarder-claims/:ref` | `claim:read` | — | `ForwarderClaimService.read` |
| PATCH | `/forwarder-claims/:ref/status` | `claim:update` | `{status}` | `ForwarderClaimService.setStatus` |
| POST | `/petty-cash` | `pettyCash:create` | `{office,amountMinor,kind,memo}` | `PettyCashService.record` |
| GET | `/petty-cash/:office/balance` | `pettyCash:read` | — | `PettyCashService.balance` |
| POST | `/supplier-bank/changes` | `payment:approve` | `{supplierRef,accountName,iban,bankName}` | `SupplierBankService.requestChange` |
| POST | `/supplier-bank/changes/:ref/approve` | `payment:approve` (dual, distinct approvers) | — | `SupplierBankService.approve` |
| GET | `/supplier-bank/:supplierRef` | `supplier:read` | — | `SupplierBankService.readAccount` |

> **`GET /invoices/order/:orderRef`** resolves an order to its invoice for the payment UI
> (the customer holds the order ref, not the invoice ref). Same posture as `GET /invoices/:ref`:
> `invoice:read` role grant, then object-scope via `inScope` (a `customer` sees only their own
> invoice; `finance`/`ceo`/`venture_manager` see all), then masking. `404` when the order has
> no invoice, `403 ACCESS_DENIED_SCOPE` when out of scope — never a silent empty.

> **`GET /payments`** is Finance's verification queue (primary use `?status=pending_verification`).
> Same security posture as `GET /payments/:ref`, expressed as a query predicate — a list never
> returns a row the by-ref read would deny. The role grant is checked first (no grant →
> `403 ACCESS_DENIED_ROLE`): per `ROLE_GRANTS` only `finance` (`payment:*`), `ceo` (`*:*`) and
> `venture_manager` (`payment:read`) hold `payment:read` — a `customer` (`payment:create` only)
> and a `sales_agent` (`commission:read` only) are denied, matching their by-ref read. Object
> scope mirrors `inScope` (`financeScopeWhere`): those three roles pass `inScope` unconditionally
> and see all rows; the `customer`/`sales_agent` branches (unreachable via the grant, kept for a
> total mirror) admit only rows where `customerRef` matches — a Payment carries no `agentId`, so
> only the customer-membership disjunct can fire. Optional `status`/`invoiceRef` filters only
> NARROW (AND-composed), never widen. Payment rows declare no `CONFIDENTIAL_FIELDS`, so masking is
> a no-op (applied for uniformity). **Pagination:** `limit` (default 20, max 100) + `offset`
> (default 0), validated (`400` on non-int/out-of-range); stable sort `updatedAt desc`.

### logistics
| Method | Path | Auth | Body / params | Service.method |
|---|---|---|---|---|
| POST | `/receiving` | `package:create` | `{orderRef,customerRef,poRef,declaredCbm,declaredKg,packages:[{kg,cbm}],clientRequestId?}` | `ReceivingService.receivePackages` |
| POST | `/receiving/variance` | `package:update` | `{lotRef,decision,note?}` | `ReceivingService.resolveVariance` |
| POST | `/release/qc` | `package:update` | `{packageRefs[]}` | `ReleaseService.qcRelease` |
| POST | `/release/destination` | `package:update` | `{packageRefs[],destination}` | `ReleaseService.allocateDestination` |
| POST | `/containers` | `shipment:create` | `{packageRefs[],container,carrier,etd,eta,partnerId?}` | `ContainerService.createShipment` |
| POST | `/freight/:shipmentRef/billed-weight` | `shipment:create` | `{billedRevenueTon,freightPaidMinor}` | `FreightService.recordBilledWeight` |
| POST | `/freight/:shipmentRef/allocate` | `shipment:create` | — | `FreightService.allocateFreight` |
| POST | `/tracking/:shipmentRef/events` | `shipment:read` | `{milestone,source,occurredAt?,note?}` | `TrackingService.track` |
| GET | `/tracking/:shipmentRef/timeline` | `shipment:read` | — | `TrackingService.timeline` |
| POST | `/tracking/:shipmentRef/delay` | `shipment:create` | `{newEta,reason,agentId?,ownerId?,frontOfficeId?}` | `TrackingService.delayShipment` |
| POST | `/deliveries` | `delivery:create` (shipment-scoped) | `{shipmentRef,packageRefs[],podRef,office?}` | `DeliveryService.deliver` |
| GET | `/partner-portal/shipments` | `shipment:read` (scoped to `scope.shipmentRefs`; freight cost masked) | `?limit=&offset=` | `PartnerPortalService.listShipments` |
| GET | `/partner-portal/shipments/:ref` | `shipment:read` (scoped; freight cost masked) | — | `PartnerPortalService.readShipment` |
| GET | `/partner-portal/shipments/:ref/packages` | `package:read` (scoped) | — | `PartnerPortalService.readPackages` |
| GET | `/partner-portal/shipments/:ref/delivery` | `delivery:read` (scoped) | — | `PartnerPortalService.readDelivery` |

### platform (pre-existing, now behind the guard)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | public | DB ping |
| POST | `/auth/login` | public | issues the token + `Actor` |
| GET | `/auth/google` | public | 302 → Google consent (signed `state`); 503 if unconfigured |
| GET | `/auth/google/callback` | public | verifies Google ID token, matches existing user, issues token + `Actor`; 401 on deny, 503 if unconfigured |
| POST | `/identity/organisations` \| `/identity/offices` \| `/identity/employees` \| `/identity/partners` \| `/identity/users/:id/roles` | authenticated only — see risk below | `IdentityService` (takes no `Actor`; no service-layer authz) |

---

## Money & enums the frontend must send

- Money is **integer minor units** everywhere (`*Minor`). `1234` = `$12.34`.
- `sellIncoterm` ∈ `EXW|FOB|CIF|DAP`; `targetTrigger`/`trigger` ∈ `confirmation|pre_loading|pre_release`;
  `destination` ∈ `KIGALI|GOMA|BUKAVU|UZA_STOCK|OTHER`; tracking `source` ∈ `carrier|partner|uza|estimated`;
  variance `decision` ∈ `client_pays|uza_absorbs|reduce_qty`; petty-cash `kind` ∈ `float|expense|replenishment`;
  inspection `stage` ∈ `pre_production|during_production|pre_shipment|warehouse`; quote `basis` ∈ `EXW|FOB`;
  supplier `lifecycle` ∈ the 11 `SupplierLifecycle` values.
- Masked confidential fields render as the string `"***"` — the frontend must handle a value
  that is EITHER the real (number) or `"***"`. Never assume a role sees a field.

## What is real vs deferred

**Real (proven by `test/api.e2e.test.ts`, real Postgres, real HTTP):** the global JWT guard
(401 without/with a bad token, authenticated access with a login JWT), `@CurrentActor`
reconstruction, masking through an endpoint (a sales_agent reads a quotation → `***`), a
permission denial surfacing as `403 ACCESS_DENIED_ROLE`, ValidationPipe `400`, and a
happy-path endpoint per module (trade chain lead→…→order, sourcing supplier, quality
PO→visit→inspection, finance petty-cash, logistics receiving). Swagger at `/docs`.

**Deferred / not built here:** MFA is still the documented stub; refresh tokens / logout /
token revocation are not implemented (short-TTL access token only); rate limiting and CORS
config are not set (add before public exposure). Event handlers remain worker-driven (this
task added no event paths). See the identity risk below.
