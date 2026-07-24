/** Shared domain types. Duplicating any of these locally is the failure this
 *  package exists to prevent. */
import type { Minor } from './money.ts';
import type { CostRung, Incoterm, InstallmentTrigger, ClientTier, VarianceDecision } from './policy.ts';

export type Destination = 'KIGALI' | 'GOMA' | 'BUKAVU' | 'UZA_STOCK' | 'OTHER';

export type WarehouseZone =
  | 'AWAITING_INSPECTION' | 'READY_FOR_LOADING' | 'QUARANTINE'
  | 'AWAITING_CORRECTION' | 'FRAGILE';

/** Tracking events must declare their provenance. A customer seeing "arrived"
 *  needs to know whether the carrier said so or we guessed. */
export type TrackingSource = 'carrier' | 'partner' | 'uza' | 'estimated';

export type SupplierLifecycle =
  | 'Discovered' | 'Contacted' | 'PreScreened' | 'SampleRequested' | 'SampleApproved'
  | 'TrialOrder' | 'Verified' | 'Preferred' | 'StrategicPartner' | 'Suspended' | 'Blocked';

export interface CostLine { estMinor: Minor; actMinor: Minor | null }
export type CostLadder = Record<CostRung, CostLine>;

export interface Quotation {
  ref: string; projectRef: string; customerRef: string; agentId: string | null;
  qty: number;
  sellIncoterm: Incoterm;
  ladder: CostLadder;
  supplierUnitCostMinor: Minor;
  targetPriceMinor: Minor;
  walkawayPriceMinor: Minor;
  customerUnitPriceMinor: Minor;
  /** Locked at approval. Never recomputed. */
  marginPct: number;
  /** Computed from actuals after delivery. Null until then. */
  realizedMargin: number | null;
  version: number;
  status: 'draft' | 'approved' | 'superseded';
}

export interface Installment {
  ref: string; orderRef: string;
  trigger: InstallmentTrigger; pct: number; amountMinor: Minor;
  status: 'due' | 'paid';
}

export interface Order {
  ref: string; projectRef: string; customerRef: string; agentId: string | null;
  quotationRef: string; totalMinor: Minor;
  tier: ClientTier;
  status: 'awaiting_payment' | 'procurement_active' | 'in_transit' | 'delivered' | 'cancelled';
  commissionAccrued: boolean;
}

export interface Package {
  ref: string; orderRef: string; customerRef: string; lotRef: string;
  kg: number; cbm: number;
  destination: Destination | null;
  zone: WarehouseZone;
  /** MUST stay separate from varianceHold. Collapsing them let unresolved
   *  goods sail once; see conformance CF-014. */
  qcReleased: boolean;
  varianceHold: boolean;
  shipmentRef: string | null;
  delivered: boolean;
}

export interface Shipment {
  ref: string; container: string; carrier: string;
  destination: Destination;
  etd: string; eta: string;
  status: 'planned' | 'in_transit' | 'delayed' | 'arrived' | 'delivered';
  packageRefs: string[];
  partnerId: string | null;
  /** Three numbers, never one. */
  billedRevenueTon: number | null;
  freightPaidMinor: Minor | null;
  allocations: Record<string, Minor>;
  daysWaitingForConsolidation: number;
}

export interface CommissionEntry {
  agentId: string; orderRef: string; amountMinor: Minor;
  type: 'accrual' | 'clawback' | 'payout';
  occurredAt: string;
}

// ---------------------------------------------------------------------------
// Records shared across module boundaries. A module that needs one of these
// must import it, not redeclare it.
// ---------------------------------------------------------------------------

export interface Customer {
  ref: string; name: string; country: string; phone: string;
  agentId: string | null; completedOrders: number;
}

export interface Supplier {
  ref: string; nameEn: string; nameZh: string; country: string;
  lifecycle: SupplierLifecycle;
  /** Moves only on evidence, never set by hand. Every change is logged with cause. */
  score: number;
  relationshipOwnerId: string | null;
}

export interface SupplierQuote {
  ref: string; supplierRef: string; projectRef: string;
  unitCostMinor: Minor; moq: number; leadTimeDays: number;
  unitCbm: number; unitKg: number;
  /** False when the supplier quoted FOB and inland cost cannot be separated.
   *  Comparing an FOB quote against an EXW quote without this flag is meaningless. */
  inlandSeparable: boolean;
}

export interface PurchaseOrder {
  ref: string; supplierRef: string; orderRef: string;
  qty: number; unitCostMinor: Minor; poTotalMinor: Minor;
  declaredCbm: number; declaredKg: number;
  status: 'issued' | 'in_production' | 'ready' | 'shipped' | 'cancelled';
}

export type InspectionStage =
  | 'pre_production' | 'during_production' | 'pre_shipment' | 'warehouse';

export interface Inspection {
  ref: string; visitRef: string; poRef: string;
  stage: InspectionStage;
  critical: number; major: number; minor: number;
  result: 'pass' | 'conditional' | 'fail';
  /** Wins forwarder and supplier claims later. Store with lot and package refs. */
  evidence: readonly string[];
  inspectorId: string; capturedOffline: boolean;
}

export interface Capa {
  ref: string; inspectionRef: string; supplierRef: string;
  status: 'open' | 'evidence_submitted' | 'closed';
  closedByReinspectionRef: string | null;
}

/** Produced by warehouse on receipt, consumed by finance to decide who pays. */
export interface VarianceReport {
  orderRef: string; poRef: string; lotRef: string;
  declaredCbm: number; measuredCbm: number; measuredKg: number;
  measuredRevenueTon: number;
  variance: number;
  discrepancy: boolean;
  hardStop: boolean;
  decision: VarianceDecision | null;
  decidedBy: string | null;
}

export interface TrackingEvent {
  ref: string; shipmentRef: string; milestone: string;
  /** Never present an estimate to a customer as confirmed. */
  source: TrackingSource;
  occurredAt: string;
}

/** Measured vs billed. A claim against the forwarder, never a client conversation. */
export interface FreightClaim {
  ref: string; shipmentRef: string;
  measuredRevenueTon: number; billedRevenueTon: number; overRevenueTon: number;
  status: 'raised' | 'submitted' | 'recovered' | 'written_off';
  evidenceRefs: readonly string[];
}

export interface Invoice {
  ref: string; orderRef: string; customerRef: string;
  amountMinor: Minor; status: 'issued' | 'part_paid' | 'paid' | 'void';
}

export interface Payment {
  ref: string; invoiceRef: string; customerRef: string;
  amountMinor: Minor; proofRef: string;
  status: 'pending_verification' | 'verified' | 'rejected';
  /** Set only by a user holding the finance role. Never by AI. */
  verifiedBy: string | null;
}

export interface Delivery {
  ref: string; shipmentRef: string; customerRef: string;
  packageRefs: readonly string[]; podRef: string;
  status: 'planned' | 'in_progress' | 'delivered' | 'failed';
}

/** Fan-out on an exception must reach every affected party in their own role. */
export type NotificationAudience =
  | 'customer' | 'agent' | 'project_owner' | 'front_office'
  | 'logistics_partner' | 'finance' | 'sourcing' | 'warehouse' | 'executive';

export interface Notification {
  ref: string; audience: NotificationAudience; recipientId: string;
  subjectRef: string; body: string; readAt: string | null;
}

