import { randomUUID } from 'node:crypto';
import { minor, type Actor, type Minor } from '@uza/contracts';
import { prisma } from './db';
import { AuditService } from '../src/platform/audit/audit.service';
import { AuthorizationService } from '../src/platform/authorization/authorization.service';
import { OutboxService } from '../src/platform/outbox/outbox.service';
import { NotificationService } from '../src/platform/notification/notification.service';
import { SupplierService } from '../src/sourcing/supplier/supplier.service';
import { SupplierScoreService } from '../src/sourcing/supplier/supplier-score.service';
import { RfqService } from '../src/sourcing/quote/rfq.service';
import { PurchaseOrderService } from '../src/sourcing/po/purchase-order.service';
import { VisitService } from '../src/quality/visit/visit.service';
import { InspectionService } from '../src/quality/inspection/inspection.service';
import { CapaService } from '../src/quality/capa/capa.service';

// Services instantiated directly — the platform handoff is explicit that Vitest tests do
// not use the DI container. A raw PrismaClient stands in for PrismaService (same surface).
const audit = new AuditService(prisma as never);
export const authz = new AuthorizationService(audit);
export const outbox = new OutboxService(prisma as never);
const notifications = new NotificationService(prisma as never);

export const suppliers = new SupplierService(prisma as never, authz);
export const scores = new SupplierScoreService(prisma as never);
export const rfqs = new RfqService(prisma as never, authz);
export const pos = new PurchaseOrderService(prisma as never, authz, outbox);
export const visits = new VisitService(prisma as never, authz, notifications);
export const inspections = new InspectionService(prisma as never, authz, outbox);
export const capas = new CapaService(prisma as never, authz, outbox);

// ---- actors ----------------------------------------------------------------
export const cecilia: Actor = { userId: 'CEC-1', role: 'china_sourcing', office: 'CN', scope: {} };
export const francois: Actor = { userId: 'FRA-1', role: 'china_warehouse', office: 'CN', scope: {} };
export const agent: Actor = { userId: 'AGT-GOM-0021', role: 'sales_agent', office: 'GOM', scope: { customerIds: [] } };
export const ceo: Actor = { userId: 'CEO', role: 'ceo', office: 'RW', scope: {} };

export const UNIT_COST: Minor = minor(41.0);
export const ORDER_REF = 'ORD-BULK-2026-0001';
export const PROJECT_REF = 'PRJ-BULK-2026-0001';

/** Register a supplier, RFQ, quote and PO — the sourcing chain up to an issued PO. */
export async function suppliedPo(
  opts: { basis?: 'EXW' | 'FOB'; qty?: number; unitCbm?: number; unitKg?: number } = {},
) {
  const supplier = await suppliers.register(cecilia, { nameEn: 'Ningbo Solar Co', nameZh: '宁波太阳能有限公司' });
  const rfq = await rfqs.createRfq(cecilia, { projectRef: PROJECT_REF });
  const unitCbm = opts.unitCbm ?? 0.05;
  const unitKg = opts.unitKg ?? 12;
  const quote = await rfqs.addQuote(cecilia, {
    supplierRef: supplier.ref,
    projectRef: PROJECT_REF,
    rfqRef: rfq.ref,
    unitCostMinor: UNIT_COST,
    moq: 100,
    leadTimeDays: 30,
    unitCbm,
    unitKg,
    basis: opts.basis,
  });
  const po = await pos.create(cecilia, {
    supplierRef: supplier.ref,
    orderRef: ORDER_REF,
    quoteRef: quote.ref,
    qty: opts.qty ?? 100,
    unitCostMinor: UNIT_COST,
    unitCbm,
    unitKg,
  });
  return { supplier, rfq, quote, po };
}

/** Extend suppliedPo with a factory visit assigned to François. */
export async function assignedVisit(opts: Parameters<typeof suppliedPo>[0] = {}) {
  const base = await suppliedPo(opts);
  const visit = await visits.assign(cecilia, { poRef: base.po.ref, inspectorId: francois.userId });
  return { ...base, visit };
}

/** Build a synthetic warehouse.receiptRecorded envelope (warehouse is Sprint 3). */
export function receiptEnvelope(
  poRef: string,
  opts: { variance: number; discrepancy: boolean; hardStop?: boolean; eventId?: string; orderRef?: string },
) {
  return {
    eventId: opts.eventId ?? randomUUID(),
    name: 'warehouse.receiptRecorded' as const,
    actorId: 'FRA-1',
    occurredAt: new Date().toISOString(),
    payload: {
      lotRef: 'LOT-ORD0001-01',
      orderRef: opts.orderRef ?? ORDER_REF,
      poRef,
      declaredCbm: 5.0,
      measuredCbm: 5.0 * (1 + opts.variance),
      measuredKg: 1200,
      measuredRevenueTon: 5.25,
      variance: opts.variance,
      discrepancy: opts.discrepancy,
      hardStop: opts.hardStop ?? false,
    },
  };
}
