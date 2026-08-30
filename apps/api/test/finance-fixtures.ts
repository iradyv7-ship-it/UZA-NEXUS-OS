import { randomUUID } from 'node:crypto';
import { minor, type Actor, type EventEnvelope, type Minor } from '@uza/contracts';
import { prisma } from './db';
import { AuditService } from '../src/platform/audit/audit.service';
import { AuthorizationService } from '../src/platform/authorization/authorization.service';
import { OutboxService } from '../src/platform/outbox/outbox.service';
import { NotificationService } from '../src/platform/notification/notification.service';
import { InvoiceService } from '../src/finance/invoice/invoice.service';
import { PaymentService } from '../src/finance/payment/payment.service';
import { CommissionService } from '../src/finance/commission/commission.service';
import { ForwarderClaimService } from '../src/finance/claim/forwarder-claim.service';
import { PettyCashService } from '../src/finance/petty-cash/petty-cash.service';
import { SupplierBankService } from '../src/finance/supplier-bank/supplier-bank.service';

// Services instantiated directly — the platform handoff is explicit that Vitest tests do
// not use the DI container. A raw PrismaClient stands in for PrismaService (same surface).
const audit = new AuditService(prisma as never);
export const authz = new AuthorizationService(audit);
export const outbox = new OutboxService(prisma as never);
export const notifications = new NotificationService(prisma as never);
export const commissions = new CommissionService(prisma as never, authz, notifications, outbox);
export const invoices = new InvoiceService(prisma as never, authz);
export const payments = new PaymentService(
  prisma as never,
  authz,
  outbox,
  notifications,
  commissions,
);
export const claims = new ForwarderClaimService(prisma as never, authz, notifications);
export const pettyCash = new PettyCashService(prisma as never, authz);
export const supplierBank = new SupplierBankService(prisma as never, authz);

// ---- actors ----------------------------------------------------------------
export const AGENT_ID = 'AGT-GOM-0021';
export const CUSTOMER_REF = 'CUS-CD-000001';
export const finance: Actor = { userId: 'FIN-1', role: 'finance', office: 'RW', scope: {} };
export const finance2: Actor = { userId: 'FIN-2', role: 'finance', office: 'RW', scope: {} };
export const ceo: Actor = { userId: 'CEO', role: 'ceo', office: 'RW', scope: {} };
export const vm: Actor = { userId: 'VM-1', role: 'venture_manager', office: 'RW', scope: {} };
export const frontOffice: Actor = {
  userId: 'FO-1',
  role: 'front_office',
  office: 'GOM',
  scope: {},
};
export const agent: Actor = {
  userId: AGENT_ID,
  role: 'sales_agent',
  office: 'GOM',
  scope: { customerIds: [CUSTOMER_REF] },
};
export const customer: Actor = {
  userId: 'CUS-1',
  role: 'customer',
  office: 'GOM',
  scope: { customerId: CUSTOMER_REF },
};

// ---- synthetic trade events ------------------------------------------------
// Trade published these; finance consumes them. Standard order total is $6,163.00.
export const STANDARD_TOTAL: Minor = minor(6163.0);

export const orderCreated = (
  opts: {
    orderRef?: string;
    tier?: 'new' | 'established';
    agentId?: string;
    totalMinor?: Minor;
    eventId?: string;
  } = {},
): EventEnvelope<'order.created'> => ({
  eventId: opts.eventId ?? randomUUID(),
  name: 'order.created',
  actorId: 'VM-1',
  occurredAt: new Date().toISOString(),
  payload: {
    orderRef: opts.orderRef ?? 'ORD-BULK-2026-0001',
    customerRef: CUSTOMER_REF,
    agentId: opts.agentId ?? AGENT_ID,
    totalMinor: opts.totalMinor ?? STANDARD_TOTAL,
    tier: opts.tier ?? 'new',
  },
});

export const orderCancelled = (
  orderRef = 'ORD-BULK-2026-0001',
  reason = 'customer withdrew',
  eventId = randomUUID(),
): EventEnvelope<'order.cancelled'> => ({
  eventId,
  name: 'order.cancelled',
  actorId: 'VM-1',
  occurredAt: new Date().toISOString(),
  payload: { orderRef, reason },
});

export const billedWeight = (
  opts: {
    shipmentRef?: string;
    measuredRevenueTon?: number;
    billedRevenueTon?: number;
    freightPaidMinor?: Minor;
    eventId?: string;
  } = {},
): EventEnvelope<'shipment.billedWeightRecorded'> => ({
  eventId: opts.eventId ?? randomUUID(),
  name: 'shipment.billedWeightRecorded',
  actorId: 'LOG-1',
  occurredAt: new Date().toISOString(),
  payload: {
    shipmentRef: opts.shipmentRef ?? 'SHP-2026-0001',
    measuredRevenueTon: opts.measuredRevenueTon ?? 10.0,
    billedRevenueTon: opts.billedRevenueTon ?? 10.0,
    freightPaidMinor: opts.freightPaidMinor ?? (minor(5000) as Minor),
    claimRaised: false,
  },
});

/**
 * Drive an invoice into existence from a synthetic `order.created`, returning the created
 * invoice and its installments. The most common test starting point.
 */
export async function invoicedOrder(opts: Parameters<typeof orderCreated>[0] = {}) {
  const event = orderCreated(opts);
  const result = await invoices.handleOrderCreated(event);
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { orderRef: event.payload.orderRef },
    include: { installments: true },
  });
  return { event, result, invoice };
}

/** Upload a proof against the invoice for a named installment trigger. */
export async function uploadFor(
  invoiceRef: string,
  trigger: 'confirmation' | 'pre_loading' | 'pre_release',
  amountMinor: Minor,
  actor: Actor = customer,
) {
  return payments.uploadProof(actor, {
    invoiceRef,
    targetTrigger: trigger,
    amountMinor,
    proofRef: `PROOF-${trigger}`,
  });
}
