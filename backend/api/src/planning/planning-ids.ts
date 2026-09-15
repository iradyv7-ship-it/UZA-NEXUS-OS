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

/**
 * The next sequence number for a readable ref, derived from the HIGHEST EXISTING REF rather
 * than from `count()`.
 *
 * `count() + 1` was the original scheme and it is wrong. It only holds while no row is ever
 * deleted and every row is created in order — and the first time either fails, the next insert
 * collides on the `ref` primary key and the request 500s. That happened in production data on
 * 24 August 2026: 32 decisions existed but the highest ref was DEC-2026-0033, so `count()+1`
 * produced a ref that was already taken and every attempt to raise a decision failed.
 *
 * Sorting on `ref` descending is safe because the sequence is zero-padded to a fixed width, so
 * lexical order and numeric order agree. Refs are scoped by year in the prefix, so a new year
 * starts again at 1 without colliding with the old one.
 *
 * This does NOT make concurrent writers safe — two inserts racing still produce the same
 * number, and the `ref` unique constraint is still the backstop. It makes SEQUENTIAL writers
 * safe, which is the actual failure that occurred.
 */
/**
 * Re-exported from the shared implementation.
 *
 * This module used to carry its own copy, prefix-based, written when the `count() + 1`
 * collision was found on 24 August. Twenty-one other call sites had the same bug and
 * could not use it, because their ref formats are not all `KIND-YEAR-SEQ`. The shared
 * version takes the caller's own ref builder instead, which works for every format in
 * the estate — see `platform/ids/next-sequence.ts`.
 *
 * Kept as a re-export so existing imports from this module keep working.
 */
export { nextSequence } from '../platform/ids/next-sequence';

/** The prefix a ref of this kind carries in the current year, e.g. `DEC-2026-`. */
export const refPrefix = (kind: string): string => `${kind}-${currentYear()}-`;

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
