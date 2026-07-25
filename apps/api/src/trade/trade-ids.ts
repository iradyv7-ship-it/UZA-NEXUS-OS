import { formatId, type IdParts } from '../platform/ids/readable-id';
import type { IdKind } from '@uza/contracts';

/**
 * Readable-id helpers for trade-flow. Rendering is delegated to the platform formatter
 * (single source over ID_PATTERNS, CF-001) — this module only supplies the corridor
 * defaults and a count-derived sequence.
 *
 * NOTE on sequencing: the sequence is `count()+1` taken inside the same transaction as
 * the insert. Under the single-writer test/worker model this is collision-free; the
 * `ref` unique/primary-key constraint is the hard backstop if two writers ever race.
 * A production-grade monotonic sequence per (kind, year) is a follow-up, not sprint 1.
 */
export const VENTURE = 'BULK';

export const currentYear = (): string => String(new Date().getFullYear());

export const makeRef = (kind: IdKind, parts: IdParts): string => formatId(kind, parts);
