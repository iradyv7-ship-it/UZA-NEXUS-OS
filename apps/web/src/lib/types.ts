/** Read-shapes as the API returns them. Confidential numeric fields arrive as either a
 *  number OR the literal "***" when masked for the caller's role — never assume a number. */
export type Maskable<T> = T | '***';
export const MASK = '***';

export function isMasked<T>(v: Maskable<T>): v is '***' {
  return v === MASK;
}

export type QuotationStatus = 'draft' | 'approved' | 'superseded';

export interface QuotationView {
  ref: string;
  projectRef: string;
  customerRef: string;
  agentId: string | null;
  qty: number;
  sellIncoterm: 'EXW' | 'FOB' | 'CIF' | 'DAP';
  version: number;
  status: QuotationStatus;
  customerUnitPriceMinor: number;
  supplierUnitCost: Maskable<number>;
  targetPrice: Maskable<number>;
  walkawayPrice: Maskable<number>;
  marginPct: Maskable<number>;
  realizedMargin: Maskable<number | null>;
  dapMargin: Maskable<number>;
}

export type OrderStatus =
  | 'awaiting_payment' | 'procurement_active' | 'in_transit' | 'delivered' | 'cancelled';

export type InstallmentTrigger = 'confirmation' | 'pre_loading' | 'pre_release';

export interface InstallmentView {
  ref: string;
  orderRef: string;
  trigger: InstallmentTrigger;
  pct: number;
  amountMinor: number;
  status: 'due' | 'paid';
}

export interface OrderView {
  ref: string;
  projectRef: string;
  customerRef: string;
  agentId: string | null;
  quotationRef: string;
  totalMinor: number;
  tier: 'new' | 'established';
  status: OrderStatus;
  commissionAccrued: boolean;
  cancelReason: string | null;
  installments: InstallmentView[];
}

/**
 * Finance read-shapes. Invoices carry NO confidential fields (nothing in CONFIDENTIAL_FIELDS
 * targets them), so their money is always a real number, never masked. The finance-side
 * installment status is `due | settled` — Finance flips it to `settled` when it verifies a
 * covering payment. We render `settled` as "paid" to the human.
 */

export type InvoiceStatus = 'issued' | 'part_paid' | 'paid' | 'void';
export type FinanceInstallmentStatus = 'due' | 'settled';

export interface InvoiceInstallmentView {
  ref: string;
  invoiceRef: string;
  orderRef: string;
  trigger: InstallmentTrigger;
  pct: number;
  amountMinor: number;
  status: FinanceInstallmentStatus;
  settledByPaymentRef: string | null;
}

export interface InvoiceView {
  ref: string;
  orderRef: string;
  customerRef: string;
  agentId: string | null;
  totalMinor: number;
  tier: 'new' | 'established';
  status: InvoiceStatus;
  commissionAccrued: boolean;
  installments: InvoiceInstallmentView[];
}

export type PaymentStatus = 'pending_verification' | 'verified' | 'rejected';

/** A payment against an invoice. Payment rows declare no confidential fields (mask is a
 *  no-op on the API), so every field arrives real. */
export interface PaymentView {
  ref: string;
  invoiceRef: string;
  orderRef: string;
  customerRef: string;
  amountMinor: number;
  proofRef: string;
  targetTrigger: InstallmentTrigger;
  status: PaymentStatus;
  verifiedBy: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  settledInstallmentRef: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * List-row shapes for the work-queue endpoints (GET /quotations, /orders, /projects).
 * Same security posture as the by-ref reads: scoped server-side, and quotation rows are
 * masked identically (cost/target/walkaway + both margins → "***"). Orders and projects
 * carry no confidential fields, so their numeric fields are always real.
 */

/** A row from GET /quotations — identical projection to a by-ref quotation read. */
export type QuotationListRow = QuotationView;

/** A row from GET /orders — the order without its installment schedule (not listed). */
export type OrderListRow = Omit<OrderView, 'installments'>;

/** A row from GET /projects — used to resolve project names + owners for the queue. */
export interface ProjectListRow {
  ref: string;
  customerRef: string;
  agentId: string | null;
  requestRef: string;
  name: string;
  owner: string;
  stage: string;
  health: string;
}
