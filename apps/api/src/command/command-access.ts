import type { Role } from '@uza/contracts';

/**
 * Nexas Command Center — the MODULE-LOCAL access policy.
 *
 * `@uza/contracts` `ROLE_GRANTS` is the UZA Nexus kernel; it deliberately does not model
 * Command Center resources (tasks, grants, the CEO overview). Rather than pollute the
 * shared contract with venture-management capabilities, this module owns its own role →
 * capability map, checked at the SERVICE layer and audited on denial exactly like the
 * platform `AuthorizationService` (deny row written BEFORE the throw).
 *
 * Object-scope (a manager's department, a grant owner) is NOT expressed here — it depends
 * on the record and lives in `command-scope.ts` + the service methods, mirroring how trade
 * keeps role grants (`can`) separate from object scope (`inScope`). This map is the ROLE
 * gate only: it answers "may this role touch this capability at all?".
 *
 * Design rules (from the module brief):
 *  - `ceo` + `venture_manager` → full: all tasks, all grants, the overview.
 *  - any other INTERNAL role (`finance`, `china_sourcing`, `china_warehouse`,
 *    `front_office`) → tasks they own/are assigned + their department's (managers);
 *    grants only where they are the assigned owner. They hold the read/write capability;
 *    object-scope narrows what they actually see.
 *  - `customer`, `sales_agent`, `logistics_partner` → NO command access (403 on everything).
 */
export type CommandCapability =
  | 'org:read' // view departments + org structure
  | 'org:write' // create departments, assign employee profiles (ceo/venture_manager)
  | 'task:create'
  | 'task:read'
  | 'task:write'
  | 'task:all' // unrestricted task visibility (ceo/venture_manager)
  | 'grant:create'
  | 'grant:read'
  | 'grant:write'
  | 'grant:all' // unrestricted grant visibility (ceo/venture_manager)
  | 'overview';

const FULL: readonly CommandCapability[] = [
  'org:read',
  'org:write',
  'task:create',
  'task:read',
  'task:write',
  'task:all',
  'grant:create',
  'grant:read',
  'grant:write',
  'grant:all',
  'overview',
];

/** Internal individual contributors + managers: scoped task access + owner-scoped grants. */
const INTERNAL: readonly CommandCapability[] = [
  'org:read',
  'task:create',
  'task:read',
  'task:write',
  'grant:read',
  'grant:write',
];

/** No Command Center access — external / commercial roles. */
const NONE: readonly CommandCapability[] = [];

export const COMMAND_ACCESS: Record<Role, readonly CommandCapability[]> = {
  ceo: FULL,
  venture_manager: FULL,
  finance: INTERNAL,
  china_sourcing: INTERNAL,
  china_warehouse: INTERNAL,
  front_office: INTERNAL,
  // Explicitly denied: the brief requires these roles get a 403 on every command route.
  sales_agent: NONE,
  customer: NONE,
  logistics_partner: NONE,
};

/** Pure role-gate check. Object-scope is applied separately by the services. */
export const hasCommandCapability = (role: Role, capability: CommandCapability): boolean =>
  COMMAND_ACCESS[role].includes(capability);

/** `ceo`/`venture_manager` see every task/grant unconditionally (they hold the `*:all` cap). */
export const seesAllTasks = (role: Role): boolean => hasCommandCapability(role, 'task:all');
export const seesAllGrants = (role: Role): boolean => hasCommandCapability(role, 'grant:all');
