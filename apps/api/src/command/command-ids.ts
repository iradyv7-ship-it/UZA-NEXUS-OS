/**
 * Readable-id helpers for the Command Center.
 *
 * These id kinds (department / command-task / grant) are NOT in `@uza/contracts`
 * `ID_PATTERNS` — that kernel models the UZA Bulk record chain, not the venture-management
 * layer, and this module must not modify the shared contract. So the patterns are defined
 * here, module-local, in the same shape the platform formatter uses (zero-padded sequence,
 * 4-digit year). If a Command id ever needs to cross a module boundary, a
 * `docs/contract-requests/` note would promote the pattern into the kernel.
 *
 * Sequencing mirrors trade-ids: `count()+1` taken inside the same call as the insert.
 * Under the single-writer test/worker model this is collision-free; the `ref` primary-key
 * constraint is the hard backstop if two writers ever race.
 */
const pad = (seq: number, width: number): string => String(seq).padStart(width, '0');

export const currentYear = (): string => String(new Date().getFullYear());

/** DPT-{CODE} — the department's own short code makes the ref self-describing. */
export const departmentRef = (code: string): string => `DPT-${code.toUpperCase()}`;

/** CTSK-{year}-{seq:4} */
export const commandTaskRef = (seq: number): string => `CTSK-${currentYear()}-${pad(seq, 4)}`;

/** GRNT-{year}-{seq:4} */
export const grantRef = (seq: number): string => `GRNT-${currentYear()}-${pad(seq, 4)}`;
