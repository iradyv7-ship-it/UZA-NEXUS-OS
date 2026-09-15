import { formatId, type IdParts } from '../platform/ids/readable-id';
import type { IdKind } from '@uza/contracts';

/**
 * Readable-id helpers for finance-commission.
 *
 * `invoice`, `payment`, `installment`, `claim`, `pettyCash` and `bankChange` are all
 * defined in @uza/contracts ID_PATTERNS, so every ref renders through the shared platform
 * formatter (single source over the patterns, CF-001). The claim/pettyCash/bankChange keys
 * were added from docs/contract-requests/2026-07-25-finance-ids.md.
 *
 * Sequencing is `count()+1` inside the insert transaction — collision-free under the
 * single-writer model, with the `ref`/`@id` constraint as the hard backstop.
 */
export const VENTURE = 'BULK';

export const currentYear = (): string => String(new Date().getFullYear());

export const makeRef = (kind: IdKind, parts: IdParts): string => formatId(kind, parts);

export const invoiceRef = (seq: number): string =>
  formatId('invoice', { venture: VENTURE, year: currentYear(), seq });

export const paymentRef = (seq: number): string =>
  formatId('payment', { year: currentYear(), seq });

/** {order}-{trigger}, reusing the contract installment pattern for finance's own copy. */
export const installmentRef = (order: string, trigger: string): string =>
  formatId('installment', { order, trigger });

export const claimRef = (seq: number): string => formatId('claim', { year: currentYear(), seq });

export const pettyCashRef = (office: string, seq: number): string =>
  formatId('pettyCash', { office, year: currentYear(), seq });

export const bankChangeRef = (seq: number): string =>
  formatId('bankChange', { year: currentYear(), seq });
