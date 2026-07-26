import { randomUUID } from 'node:crypto';
import { minor, type Actor, type EventEnvelope, type Minor } from '@uza/contracts';
import { prisma } from './db';
import { AuditService } from '../src/platform/audit/audit.service';
import { AuthorizationService } from '../src/platform/authorization/authorization.service';
import { OutboxService } from '../src/platform/outbox/outbox.service';
import { NotificationService } from '../src/platform/notification/notification.service';
import { ReceivingService } from '../src/logistics/warehouse/receiving.service';
import { ReleaseService } from '../src/logistics/warehouse/release.service';
import { OrderPaymentService } from '../src/logistics/consumers/order-payment.service';
import { QualityGateService } from '../src/logistics/consumers/quality-gate.service';
import { ContainerService } from '../src/logistics/logistics/container.service';
import { FreightService } from '../src/logistics/logistics/freight.service';
import { TrackingService } from '../src/logistics/logistics/tracking.service';
import { DeliveryService } from '../src/logistics/logistics/delivery.service';
import { PartnerPortalService } from '../src/logistics/logistics/partner-portal.service';

// Services instantiated directly — the platform handoff is explicit that Vitest tests do
// not use the DI container. A raw PrismaClient stands in for PrismaService (same surface).
const audit = new AuditService(prisma as never);
export const authz = new AuthorizationService(audit);
export const outbox = new OutboxService(prisma as never);
export const notifications = new NotificationService(prisma as never);

export const orderPayments = new OrderPaymentService(prisma as never);
export const qualityGate = new QualityGateService(prisma as never);
export const receiving = new ReceivingService(prisma as never, authz, outbox);
export const release = new ReleaseService(prisma as never, authz, qualityGate);
export const containers = new ContainerService(prisma as never, authz, outbox, orderPayments);
export const freight = new FreightService(prisma as never, authz, outbox);
export const tracking = new TrackingService(prisma as never, authz, outbox, notifications);
export const deliveries = new DeliveryService(prisma as never, authz, outbox, orderPayments);
export const partnerPortal = new PartnerPortalService(prisma as never, authz);

// ---- refs ------------------------------------------------------------------
export const ORDER_REF = 'ORD-BULK-2026-0001';
export const ORDER_REF_2 = 'ORD-BULK-2026-0002';
export const CUSTOMER_REF = 'CUS-CD-000001';
export const PO_REF = 'PO-CN-2026-0001';
export const PO_REF_2 = 'PO-CN-2026-0002';

// ---- actors ----------------------------------------------------------------
export const warehouse: Actor = { userId: 'FRANCOIS', role: 'china_warehouse', office: 'CN', scope: {} };
export const vm: Actor = { userId: 'VM-1', role: 'venture_manager', office: 'RW', scope: {} };
export const ceo: Actor = { userId: 'CEO', role: 'ceo', office: 'RW', scope: {} };
export const agent: Actor = { userId: 'AGT-GOM-0021', role: 'sales_agent', office: 'GOM', scope: { customerIds: [CUSTOMER_REF] } };
export const customer: Actor = { userId: 'CUS-1', role: 'customer', office: 'GOM', scope: { customerId: CUSTOMER_REF } };
export const partner = (shipmentRefs: readonly string[]): Actor => ({
  userId: 'IMARI', role: 'logistics_partner', office: 'GOM', scope: { shipmentRefs },
});

// ---- synthetic upstream events ---------------------------------------------
export const paymentVerified = (opts: {
  orderRef?: string;
  trigger?: 'confirmation' | 'pre_loading' | 'pre_release';
  paidFraction?: number;
  eventId?: string;
} = {}): EventEnvelope<'payment.verified'> => ({
  eventId: opts.eventId ?? randomUUID(),
  name: 'payment.verified',
  actorId: 'FIN-1',
  occurredAt: new Date().toISOString(),
  payload: {
    paymentRef: 'PAY-2026-0001',
    orderRef: opts.orderRef ?? ORDER_REF,
    trigger: opts.trigger ?? 'confirmation',
    paidFraction: opts.paidFraction ?? 0.5,
  },
});

export const inspectionRecorded = (opts: {
  poRef?: string;
  result?: 'pass' | 'conditional' | 'fail';
  critical?: number;
  major?: number;
  minor?: number;
  eventId?: string;
} = {}): EventEnvelope<'inspection.recorded'> => ({
  eventId: opts.eventId ?? randomUUID(),
  name: 'inspection.recorded',
  actorId: 'FRANCOIS',
  occurredAt: new Date().toISOString(),
  payload: {
    inspectionRef: 'INS-CN-2026-0001',
    poRef: opts.poRef ?? PO_REF,
    result: opts.result ?? 'pass',
    critical: opts.critical ?? 0,
    major: opts.major ?? 0,
    minor: opts.minor ?? 0,
  },
});

export const qualityFailed = (opts: { poRef?: string; eventId?: string } = {}): EventEnvelope<'quality.failed'> => ({
  eventId: opts.eventId ?? randomUUID(),
  name: 'quality.failed',
  actorId: 'FRANCOIS',
  occurredAt: new Date().toISOString(),
  payload: { inspectionRef: 'INS-CN-2026-0001', poRef: opts.poRef ?? PO_REF, supplierRef: 'SUP-CN-0001' },
});

// ---- helpers ---------------------------------------------------------------
export const M = (major: number): Minor => minor(major);

/** Receive a lot with the given package specs. Declared defaults keep variance within tolerance. */
export async function receiveLot(opts: {
  orderRef?: string;
  poRef?: string;
  declaredCbm?: number;
  declaredKg?: number;
  packages?: { kg: number; cbm: number }[];
} = {}) {
  const packages = opts.packages ?? [
    { kg: 500, cbm: 2.0 },
    { kg: 500, cbm: 2.0 },
  ];
  const measuredCbm = packages.reduce((a, p) => a + p.cbm, 0);
  return receiving.receivePackages(warehouse, {
    orderRef: opts.orderRef ?? ORDER_REF,
    customerRef: CUSTOMER_REF,
    poRef: opts.poRef ?? PO_REF,
    declaredCbm: opts.declaredCbm ?? measuredCbm, // within tolerance by default
    declaredKg: opts.declaredKg ?? packages.reduce((a, p) => a + p.kg, 0),
    packages,
  });
}

/**
 * Drive a lot all the way to loadable: received (in tolerance), QC-released, destination
 * assigned, and the pre-loading installment marked paid via a synthetic payment.verified.
 */
export async function loadableLot(opts: {
  orderRef?: string;
  poRef?: string;
  destination?: 'KIGALI' | 'GOMA' | 'BUKAVU' | 'UZA_STOCK' | 'OTHER';
  packages?: { kg: number; cbm: number }[];
  payPreLoading?: boolean;
} = {}) {
  const orderRef = opts.orderRef ?? ORDER_REF;
  const { packages } = await receiveLot({ orderRef, poRef: opts.poRef, packages: opts.packages });
  const refs = packages.map((p) => p.ref);
  await release.qcRelease(warehouse, refs);
  await release.allocateDestination(warehouse, refs, opts.destination ?? 'KIGALI');
  if (opts.payPreLoading !== false) {
    await orderPayments.handlePaymentVerified(paymentVerified({ orderRef, trigger: 'confirmation', paidFraction: 0.5 }));
    await orderPayments.handlePaymentVerified(paymentVerified({ orderRef, trigger: 'pre_loading', paidFraction: 1.0 }));
  }
  return { orderRef, packages, refs };
}
