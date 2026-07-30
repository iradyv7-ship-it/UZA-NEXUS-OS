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

/**
 * Imari partner-portal read-shapes (GET /partner-portal/**). A `logistics_partner` sees
 * weight/CBM and delivery, but NEVER freight cost: the three freight figures arrive masked
 * as "***" (CONFIDENTIAL_FIELDS + the accepted partner-freight-mask contract request). We
 * type them Maskable and render the mask honestly — the UI is not the security boundary.
 */

export type ShipmentStatus = 'planned' | 'in_transit' | 'delayed' | 'arrived' | 'delivered';
export type Destination = 'KIGALI' | 'GOMA' | 'BUKAVU' | 'UZA_STOCK' | 'OTHER';

export interface ShipmentView {
  ref: string;
  container: string;
  carrier: string;
  destination: Destination;
  etd: string;
  eta: string;
  status: ShipmentStatus;
  partnerId: string | null;
  daysWaitingForConsolidation: number;
  /** Freight cost figures — masked "***" for a logistics_partner, never a number. */
  billedRevenueTon: Maskable<number | null>;
  measuredRevenueTon: Maskable<number | null>;
  freightPaidMinor: Maskable<number | null>;
  createdAt: string;
  updatedAt: string;
}

export type WarehouseZone =
  | 'AWAITING_INSPECTION' | 'QC_HOLD' | 'RELEASED' | 'STAGED' | 'LOADED' | string;

/** A package on the partner's shipment. Weight/CBM are visible; no cost field exists here. */
export interface PackageView {
  ref: string;
  orderRef: string;
  customerRef: string;
  poRef: string;
  lotRef: string;
  kg: number;
  cbm: number;
  destination: Destination | null;
  zone: WarehouseZone;
  qcReleased: boolean;
  varianceHold: boolean;
  shipmentRef: string | null;
  delivered: boolean;
}

export type DeliveryStatus = 'planned' | 'in_progress' | 'delivered' | 'failed';

export interface DeliveryView {
  ref: string;
  shipmentRef: string;
  orderRef: string;
  customerRef: string;
  packageRefs: string[];
  podRef: string;
  status: DeliveryStatus;
  createdAt: string;
}

export type TrackingSource = 'carrier' | 'partner' | 'uza' | 'estimated';

/** A tracking milestone. `confirmed` is derived server-side from the source (carrier/partner/
 *  uza = confirmed; estimated = a guess) — a customer/partner must never read an estimate as
 *  fact (CF-022). We render the provenance chip from it. */
export interface TrackingEventView {
  ref: string;
  shipmentRef: string;
  milestone: string;
  source: TrackingSource;
  occurredAt: string;
  note: string | null;
  confirmed: boolean;
}
