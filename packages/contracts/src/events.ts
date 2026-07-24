/**
 * The event bus is how modules cooperate. A module may publish and subscribe.
 * A module may NOT import another module's internals.
 *
 * Adding or changing an event payload is a contract change: it goes through
 * contracts-guardian, because a publisher and a subscriber owned by two different
 * agents will otherwise drift silently.
 *
 * Every handler must be idempotent, keyed on eventId.
 */
import type { Minor } from './money.ts';
import type { VarianceDecision } from './policy.ts';

export interface EventEnvelope<T extends UzaEventName = UzaEventName> {
  readonly eventId: string;
  readonly name: T;
  readonly actorId: string;
  readonly occurredAt: string;   // ISO-8601
  readonly payload: UzaEvents[T];
}

export interface UzaEvents {
  'lead.created': { leadRef: string; customerRef: string; agentId: string };
  'request.created': { requestRef: string; customerRef: string };

  'quotation.approved': { quotationRef: string; projectRef: string };

  'order.created': {
    orderRef: string; customerRef: string; agentId: string;
    totalMinor: Minor; tier: 'new' | 'established';
  };
  'order.cancelled': { orderRef: string; reason: string };

  'payment.proofUploaded': { paymentRef: string; invoiceRef: string; amountMinor: Minor };
  /** Emitted ONLY after Finance verifies. Never by AI, never by an agent. */
  'payment.verified': {
    paymentRef: string; orderRef: string;
    trigger: 'confirmation' | 'pre_loading' | 'pre_release';
    paidFraction: number;
  };

  'po.issued': { poRef: string; supplierRef: string; orderRef: string };

  'inspection.recorded': {
    inspectionRef: string; poRef: string;
    result: 'pass' | 'conditional' | 'fail';
    critical: number; major: number; minor: number;
  };
  'quality.failed': { inspectionRef: string; poRef: string; supplierRef: string };
  'capa.closed': { capaRef: string; supplierRef: string };

  'warehouse.receiptRecorded': {
    lotRef: string; orderRef: string; poRef: string;
    declaredCbm: number; measuredCbm: number; measuredKg: number;
    measuredRevenueTon: number; variance: number;
    discrepancy: boolean; hardStop: boolean;
  };
  'warehouse.varianceResolved': {
    orderRef: string; decision: VarianceDecision; approverId: string; note: string;
  };

  'container.assigned': {
    shipmentRef: string; container: string; destination: string; packageCount: number;
  };
  'shipment.billedWeightRecorded': {
    shipmentRef: string; measuredRevenueTon: number; billedRevenueTon: number;
    freightPaidMinor: Minor; claimRaised: boolean;
  };
  'shipment.delayed': {
    shipmentRef: string; oldEta: string; newEta: string; reason: string;
  };

  'delivery.completed': { deliveryRef: string; orderRef: string; shipmentRef: string };

  'commission.accrued': { agentId: string; orderRef: string; amountMinor: Minor };
  'commission.clawedBack': { agentId: string; orderRef: string; amountMinor: Minor; reason: string };
}

export type UzaEventName = keyof UzaEvents;

export const EVENT_NAMES = [
  'lead.created', 'request.created', 'quotation.approved',
  'order.created', 'order.cancelled',
  'payment.proofUploaded', 'payment.verified', 'po.issued',
  'inspection.recorded', 'quality.failed', 'capa.closed',
  'warehouse.receiptRecorded', 'warehouse.varianceResolved',
  'container.assigned', 'shipment.billedWeightRecorded', 'shipment.delayed',
  'delivery.completed', 'commission.accrued', 'commission.clawedBack',
] as const satisfies readonly UzaEventName[];

/**
 * Who owns publishing each event. A module that publishes an event it does not
 * own is a bug — that is how two modules end up fighting over one record.
 */
export const EVENT_OWNERS: Record<UzaEventName, string> = {
  'lead.created': 'trade-flow',
  'request.created': 'trade-flow',
  'quotation.approved': 'trade-flow',
  'order.created': 'trade-flow',
  'order.cancelled': 'trade-flow',
  'payment.proofUploaded': 'finance',
  'payment.verified': 'finance',
  'po.issued': 'sourcing',
  'inspection.recorded': 'quality',
  'quality.failed': 'quality',
  'capa.closed': 'quality',
  'warehouse.receiptRecorded': 'warehouse',
  'warehouse.varianceResolved': 'warehouse',
  'container.assigned': 'logistics',
  'shipment.billedWeightRecorded': 'logistics',
  'shipment.delayed': 'logistics',
  'delivery.completed': 'logistics',
  'commission.accrued': 'finance',
  'commission.clawedBack': 'finance',
};
