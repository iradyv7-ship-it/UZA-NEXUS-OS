import { formatId, type IdParts } from '../platform/ids/readable-id';
import type { IdKind } from '@uza/contracts';

/**
 * Readable-id helpers for sourcing. `po` is defined in @uza/contracts ID_PATTERNS
 * (PO-{country}-{year}-{seq:4}), so it renders through the platform formatter — a single
 * source over the patterns (CF-001).
 *
 * `supplier`, `rfq` and `supplierQuote` are NOT in ID_PATTERNS. The reference used
 * SUP-CN-{seq:4} and SQ-{seq:4}; we render those locally here and have filed a
 * contract-request to add them to ID_PATTERNS (see
 * docs/contract-requests/2026-07-25-supplier-scoring-and-ids.md). Until then this is the
 * single local definition so the pattern is not scattered.
 *
 * Sequencing is `count()+1` inside the insert transaction — collision-free under the
 * single-writer model, with the `ref`/`@unique` constraint as the hard backstop.
 */
export const COUNTRY = 'CN';

export const currentYear = (): string => String(new Date().getFullYear());

export const makeRef = (kind: IdKind, parts: IdParts): string => formatId(kind, parts);

// --- local patterns pending a contract-request (not yet in ID_PATTERNS) ---
export const supplierRef = (seq: number): string => `SUP-${COUNTRY}-${String(seq).padStart(4, '0')}`;
export const rfqRef = (seq: number): string => `RFQ-${currentYear()}-${String(seq).padStart(4, '0')}`;
export const supplierQuoteRef = (seq: number): string => `SQ-${String(seq).padStart(4, '0')}`;
