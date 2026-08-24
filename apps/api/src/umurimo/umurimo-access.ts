import type { Role } from '@uza/contracts';

/**
 * UMURIMO — the MODULE-LOCAL access policy for the people-and-work layer.
 *
 * Same discipline as `planning-access.ts` and the Command Center: `@uza/contracts`
 * `ROLE_GRANTS` models the UZA Bulk record chain, not comments and blockers, and this module
 * must not pollute the shared contract. So it owns its own role → capability map, checked at
 * the SERVICE layer, audited on denial (deny row written BEFORE the throw).
 *
 * This map is the ROLE gate only — "may this role touch this capability at all?". Object
 * scope ("is this MY blocker, MY comment, a record I can already see?") is decided in the
 * service methods, exactly as planning splits `can` from `inScope`.
 *
 * The policy behind the map:
 *
 *  - **Comments are for everybody internal.** The entire value of a comment thread is that the
 *    person who knows the answer can leave it. A commenting right rationed by seniority
 *    produces a register full of executive opinions and no field knowledge. So every internal
 *    role holds `comment:read` and `comment:write`.
 *  - **Raising a blocker is friction-free; owning one is a commitment.** Any internal role may
 *    raise, and any internal role may TAKE ownership — the whole discipline is that a blocker
 *    acquires a name and a date before the meeting ends, and a policy that routes that through
 *    a manager guarantees it does not happen.
 *  - **Moderation is executive.** Editing or removing another person's comment is the one act
 *    that rewrites somebody else's words, so it sits with `ceo`/`venture_manager` only.
 *  - **External roles get 403 on everything.** Umurimo is the internal people layer; a
 *    customer or a logistics partner has no business in it at any level.
 */
export type UmurimoCapability =
  | 'comment:read'
  | 'comment:write'
  | 'comment:resolve' // close an open request-for-comment (author or executive; scope decides)
  | 'comment:moderate' // edit or remove ANOTHER person's comment — executive only
  | 'blocker:read'
  | 'blocker:raise'
  | 'blocker:own' // accept ownership, set the due date
  | 'blocker:clear'
  | 'blocker:all' // see every blocker, including other people's — executive
  | 'digest' // the week's unowned blockers, open asks and open requests
  | 'week:read' // my own week, and the nudges aimed at me
  | 'week:confirm' // agree to, edit or drop my objectives; file my report
  | 'week:all' // see everyone's confirmation and filing state — executive
  | 'minutes:ingest' // post the minutes of a weekly review into the register
  | 'workspace:read' // my mirrored tasks, and whether the bridge is alive
  | 'workspace:sync'; // receive a batch from the workspace — the integration account only

const FULL: readonly UmurimoCapability[] = [
  'comment:read',
  'comment:write',
  'comment:resolve',
  'comment:moderate',
  'blocker:read',
  'blocker:raise',
  'blocker:own',
  'blocker:clear',
  'blocker:all',
  'digest',
  'week:read',
  'week:confirm',
  'week:all',
  'minutes:ingest',
  'workspace:read',
  'workspace:sync',
];

/**
 * Every internal role. Deliberately wide: this module only works if the people doing the work
 * can write in it without asking. What internal roles do NOT get is `comment:moderate` (never
 * rewrite someone else's words) and `blocker:all` (see the whole organisation's blockers) —
 * both of those are visibility and authority, not participation.
 *
 * `digest` IS granted: a person seeing the week's open asks is how an ask gets answered. The
 * digest is scoped per-actor in the service, so an internal role sees their own team's, not
 * everyone's.
 */
const INTERNAL: readonly UmurimoCapability[] = [
  'comment:read',
  'comment:write',
  'comment:resolve',
  'blocker:read',
  'blocker:raise',
  'blocker:own',
  'blocker:clear',
  'digest',
  // Everyone plans and everyone reports. `week:all` is withheld because seeing who across the
  // whole company has not filed is oversight, not participation — but `week:read` still shows
  // a person every nudge aimed at them.
  'week:read',
  'week:confirm',
  // Everyone sees their own mirrored tasks. Nobody but the executive pushes a batch in:
  // a write that rewrites what the register believes about everyone's work is not a
  // participation right.
  'workspace:read',
];

/** No Umurimo access — external / commercial roles. */
const NONE: readonly UmurimoCapability[] = [];

export const UMURIMO_ACCESS: Record<Role, readonly UmurimoCapability[]> = {
  ceo: FULL,
  venture_manager: FULL,
  finance: INTERNAL,
  china_sourcing: INTERNAL,
  china_warehouse: INTERNAL,
  front_office: INTERNAL,
  sales_agent: NONE,
  customer: NONE,
  logistics_partner: NONE,
};

/** Pure role-gate check. Object scope is applied separately by the services. */
export const hasUmurimoCapability = (role: Role, capability: UmurimoCapability): boolean =>
  UMURIMO_ACCESS[role].includes(capability);

/** `ceo`/`venture_manager` see every blocker unconditionally. */
export const seesAllBlockers = (role: Role): boolean => hasUmurimoCapability(role, 'blocker:all');

/**
 * Who sees the whole company's confirmation and filing state.
 *
 * Note what this does NOT do: the executive list includes the executive. A weekly discipline
 * the founder sits outside of is a reporting line, not a discipline, and everyone can see that
 * within a month.
 */
export const seesAllWeeks = (role: Role): boolean => hasUmurimoCapability(role, 'week:all');

/** Who may push a batch of workspace tasks in. */
export const maySyncWorkspace = (role: Role): boolean =>
  hasUmurimoCapability(role, 'workspace:sync');

/** Only the executive may rewrite or remove another person's comment. */
export const mayModerate = (role: Role): boolean => hasUmurimoCapability(role, 'comment:moderate');

/**
 * What a comment may be attached to.
 *
 * A polymorphic subject key with no allowlist becomes a dumping ground inside a month, and
 * then nothing can be joined or reported on. Every value here is a readable-ref-bearing record
 * that already exists in the register. Adding one is a deliberate act: add it here, and make
 * sure the service can answer "may this actor see the subject?" for it, because a comment must
 * never be a side channel to a record somebody cannot otherwise read.
 */
export const COMMENT_SUBJECTS = [
  'initiative',
  'decision',
  'weekly_report',
  'blocker',
  'responsibility',
  'funding_track',
  'memo',
] as const;

export type CommentSubject = (typeof COMMENT_SUBJECTS)[number];

export const isCommentSubject = (value: string): value is CommentSubject =>
  (COMMENT_SUBJECTS as readonly string[]).includes(value);
