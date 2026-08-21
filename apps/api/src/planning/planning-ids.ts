/**
 * Readable-id helpers for Nexas Planning & Reviews.
 *
 * Same discipline as `command-ids.ts`: these id kinds are NOT in `@uza/contracts`
 * `ID_PATTERNS` — that kernel models the UZA Bulk record chain, not the executive
 * planning layer, and this module must not modify the shared contract. Patterns are
 * defined here, module-local, in the same shape the platform formatter uses
 * (zero-padded sequence, 4-digit year).
 *
 * Sequencing mirrors trade-ids and command-ids: `count()+1` taken inside the same call
 * as the insert. Under the single-writer model this is collision-free; the `ref`
 * primary-key constraint is the hard backstop if two writers ever race.
 */
const pad = (seq: number, width: number): string => String(seq).padStart(width, '0');

export const currentYear = (): string => String(new Date().getFullYear());

/** INIT-{year}-{seq:4} — an initiative in the register. */
export const initiativeRef = (seq: number): string => `INIT-${currentYear()}-${pad(seq, 4)}`;

/** PLAN-{year}-{seq:4} — a quarter/month/week plan. */
export const planRef = (seq: number): string => `PLAN-${currentYear()}-${pad(seq, 4)}`;

/** WRPT-{year}-{seq:4} — a weekly report against a week plan. */
export const weeklyReportRef = (seq: number): string => `WRPT-${currentYear()}-${pad(seq, 4)}`;

/** KPI-{year}-{seq:4} */
export const kpiRef = (seq: number): string => `KPI-${currentYear()}-${pad(seq, 4)}`;

/** DEC-{year}-{seq:4} — a decision waiting on the CEO. */
export const decisionRef = (seq: number): string => `DEC-${currentYear()}-${pad(seq, 4)}`;

/**
 * The Monday of the week containing `d`, at UTC midnight — the canonical `weekOf`
 * value so two check-ins filed on different days of the same week collide on the
 * `[initiativeRef, weekOf]` unique constraint rather than both being accepted.
 */
export function mondayOf(d: Date): Date {
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = utc.getUTCDay(); // 0 = Sunday
  const delta = dow === 0 ? -6 : 1 - dow;
  utc.setUTCDate(utc.getUTCDate() + delta);
  return utc;
}

/** ISO week key, e.g. 2026-W34 — matches the `periodKey` convention on WeeklyReport. */
export function weekKey(d: Date): string {
  const monday = mondayOf(d);
  const thursday = new Date(monday);
  thursday.setUTCDate(thursday.getUTCDate() + 3); // ISO weeks are numbered by their Thursday
  const jan1 = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((thursday.getTime() - jan1.getTime()) / 86_400_000 + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${pad(week, 2)}`;
}
