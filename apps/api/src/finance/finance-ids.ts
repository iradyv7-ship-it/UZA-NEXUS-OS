import { formatId, type IdParts } from '../platform/ids/readable-id';
import type { IdKind } from '@uza/contracts';

/**
 * Readable-id helpers for finance-commission.
 *
 * `invoice`, `payment` and `installment` are defined in @uza/contracts ID_PATTERNS, so
 * they render through the shared platform formatter (single source over the patterns,
 * CF-001). `claim`, `pettyCash` and `bankChange` are NOT yet in ID_PATTERNS — they are
 * rendered locally here and a contract-request has been filed to add them
 * (docs/contract-requests/2026-07-25-finance-ids.md). Proceeding meanwhile, mirroring the
 * approach sourcing took for its missing patterns.
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

// ---- local patterns (pending contract-request) -----------------------------
// TODO: pending docs/contract-requests/2026-07-25-finance-ids.md
export const claimRef = (seq: number): string => `CLM-${currentYear()}-${pad(seq, 4)}`;
export const pettyCashRef = (office: string, seq: number): string =>
  `PC-${office}-${currentYear()}-${pad(seq, 4)}`;
export const bankChangeRef = (seq: number): string => `SBC-${currentYear()}-${pad(seq, 4)}`;

const pad = (n: number, width: number): string => String(n).padStart(width, '0');
