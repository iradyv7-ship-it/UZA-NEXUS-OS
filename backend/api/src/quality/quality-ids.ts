import { formatId, type IdParts } from '../platform/ids/readable-id';
import type { IdKind } from '@uza/contracts';

/**
 * Readable-id helpers for quality. `visit`, `inspection` and `capa` are all defined in
 * @uza/contracts ID_PATTERNS (VIS-/INS-/CAPA-{country}-{year}-{seq:4}), so they render
 * through the platform formatter — a single source over the patterns (CF-001).
 *
 * Sequencing is `count()+1` inside the insert transaction — collision-free under the
 * single-writer model, with the `ref`/`@unique` constraint as the hard backstop.
 */
export const COUNTRY = 'CN';

export const currentYear = (): string => String(new Date().getFullYear());

export const makeRef = (kind: IdKind, parts: IdParts): string => formatId(kind, parts);
