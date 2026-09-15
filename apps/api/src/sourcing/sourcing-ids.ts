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

/**
 * `supplierOffer`/`supplierDeal` are NOT yet in @uza/contracts ID_PATTERNS — filed as
 * docs/contract-requests/2026-09-14-supplier-deal-ids-policy-and-masking.md. Rendered
 * locally, same convention `supplier`/`rfq`/`supplierQuote` used before their own
 * ID_PATTERNS entries were accepted (docs/contract-requests/2026-07-25-supplier-scoring-
 * and-ids.md). Delete these once the contract lands and re-point at formatId.
 */
const pad = (n: number, width: number): string => String(n).padStart(width, '0');
export const supplierOfferRef = (seq: number): string => `OFF-${COUNTRY}-${currentYear()}-${pad(seq, 4)}`;
export const supplierDealRef = (seq: number): string => `DEAL-${COUNTRY}-${currentYear()}-${pad(seq, 4)}`;
