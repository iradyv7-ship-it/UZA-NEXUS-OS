import { formatId, type IdParts } from '../platform/ids/readable-id';
import type { IdKind } from '@uza/contracts';

/**
 * Readable-id helpers for sourcing. `po`, `supplier`, `rfq` and `supplierQuote` are all
 * defined in @uza/contracts ID_PATTERNS, so every ref renders through the platform
 * formatter — a single source over the patterns (CF-001). The supplier/rfq/supplierQuote
 * keys were added from docs/contract-requests/2026-07-25-supplier-scoring-and-ids.md.
 *
 * Sequencing is `count()+1` inside the insert transaction — collision-free under the
 * single-writer model, with the `ref`/`@unique` constraint as the hard backstop.
 */
export const COUNTRY = 'CN';

export const currentYear = (): string => String(new Date().getFullYear());

export const makeRef = (kind: IdKind, parts: IdParts): string => formatId(kind, parts);

export const supplierRef = (seq: number): string => formatId('supplier', { country: COUNTRY, seq });
export const rfqRef = (seq: number): string => formatId('rfq', { year: currentYear(), seq });
export const supplierQuoteRef = (seq: number): string => formatId('supplierQuote', { seq });
