import type { Role } from '@uza/contracts';

/**
 * Nexas Planning & Reviews — the MODULE-LOCAL access policy.
 *
 * Like the Command Center, `@uza/contracts` `ROLE_GRANTS` (the UZA Nexus kernel) does not
 * model planning resources (plans, weekly reports, KPIs, initiatives, the CEO review). Rather
 * than pollute the shared contract with venture-management capabilities, this module owns its
 * own role → capability map, checked at the SERVICE layer and audited on denial exactly like
 * the platform `AuthorizationService` (deny row written BEFORE the throw).
 *
 * Object-scope (an owner's own plans, a manager's department, a KPI's department) is NOT
 * expressed here — it depends on the record and lives in `planning-scope.ts` + the service
 * methods, mirroring how the Command Center keeps the role gate (`can`) separate from object
 * scope (`inScope`). This map is the ROLE gate only: "may this role touch this capability at
 * all?".
 *
 * Design rules (from the module brief):
 *  - `ceo` + `venture_manager` → full: all plans/reports/KPIs/initiatives + the review.
 *  - any other INTERNAL role (`finance`, `china_sourcing`, `china_warehouse`, `front_office`)
 *    → their OWN plans + weekly reports; READ (only) the KPIs/initiatives they own or that
 *    sit in their department. Managers additionally see their department's plans/reports
 *    (that widening is object-scope, applied in `planning-scope.ts`, not here). Creating
 *    KPIs/initiatives is an executive act — internal roles do NOT hold those create/write caps.
 *  - `customer`, `sales_agent`, `logistics_partner` → NO planning access (403 on everything).
 */
export type PlanningCapability =
  | 'plan:create'
  | 'plan:read'
  | 'plan:write'
  | 'plan:all' // unrestricted plan visibility (ceo/venture_manager)
  | 'report:create'
  | 'report:read'
  | 'report:all' // unrestricted weekly-report visibility (ceo/venture_manager)
  | 'kpi:create'
  | 'kpi:read'
  | 'kpi:write'
  | 'kpi:all' // unrestricted KPI visibility (ceo/venture_manager)
  | 'initiative:create'
  | 'initiative:read'
  | 'initiative:write'
  | 'initiative:all' // unrestricted initiative visibility (ceo/venture_manager)
  | 'review';

const FULL: readonly PlanningCapability[] = [
  'plan:create', 'plan:read', 'plan:write', 'plan:all',
  'report:create', 'report:read', 'report:all',
  'kpi:create', 'kpi:read', 'kpi:write', 'kpi:all',
  'initiative:create', 'initiative:read', 'initiative:write', 'initiative:all',
  'review',
];

/** Internal individual contributors + managers: own plans/reports + scoped reads of KPIs/initiatives. */
const INTERNAL: readonly PlanningCapability[] = [
  'plan:create', 'plan:read', 'plan:write',
  'report:create', 'report:read',
  'kpi:read',
  'initiative:read',
];

/** No Planning access — external / commercial roles. */
const NONE: readonly PlanningCapability[] = [];

export const PLANNING_ACCESS: Record<Role, readonly PlanningCapability[]> = {
  ceo: FULL,
  venture_manager: FULL,
  finance: INTERNAL,
  china_sourcing: INTERNAL,
  china_warehouse: INTERNAL,
  front_office: INTERNAL,
  // Explicitly denied: the brief requires these roles get a 403 on every planning route.
  sales_agent: NONE,
  customer: NONE,
  logistics_partner: NONE,
};

/** Pure role-gate check. Object-scope is applied separately by the services. */
export const hasPlanningCapability = (role: Role, capability: PlanningCapability): boolean =>
  PLANNING_ACCESS[role].includes(capability);

/** `ceo`/`venture_manager` see every plan/report/KPI/initiative unconditionally (the `*:all` caps). */
export const seesAllPlans = (role: Role): boolean => hasPlanningCapability(role, 'plan:all');
export const seesAllReports = (role: Role): boolean => hasPlanningCapability(role, 'report:all');
export const seesAllKpis = (role: Role): boolean => hasPlanningCapability(role, 'kpi:all');
export const seesAllInitiatives = (role: Role): boolean => hasPlanningCapability(role, 'initiative:all');
