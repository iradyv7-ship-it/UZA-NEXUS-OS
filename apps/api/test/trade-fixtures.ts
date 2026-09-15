import { minor, type Actor, type CostRung, type Minor } from '@uza/contracts';
import { prisma } from './db';
import { AuditService } from '../src/platform/audit/audit.service';
import { AuthorizationService } from '../src/platform/authorization/authorization.service';
import { OutboxService } from '../src/platform/outbox/outbox.service';
import { CustomerService } from '../src/trade/customer/customer.service';
import { IntakeService } from '../src/trade/intake/intake.service';
import { ProjectService } from '../src/trade/project/project.service';
import { QuotationService } from '../src/trade/quotation/quotation.service';
import { OrderService } from '../src/trade/order/order.service';

// Services instantiated directly — the platform handoff is explicit that Vitest tests do
// not use the DI container. A raw PrismaClient stands in for PrismaService (same surface).
const audit = new AuditService(prisma as never);
export const authz = new AuthorizationService(audit);
export const outbox = new OutboxService(prisma as never);
export const customers = new CustomerService(prisma as never, authz);
export const intake = new IntakeService(prisma as never, authz, outbox);
export const projects = new ProjectService(prisma as never, authz);
export const quotations = new QuotationService(prisma as never, authz, outbox);
export const orders = new OrderService(prisma as never, authz, outbox);

// ---- actors ----------------------------------------------------------------
export const AGENT_ID = 'AGT-GOM-0021';
export const vm: Actor = { userId: 'VM-1', role: 'venture_manager', office: 'RW', scope: {} };
export const agent: Actor = {
  userId: AGENT_ID,
  role: 'sales_agent',
  office: 'GOM',
  scope: { customerIds: [] },
};
export const finance: Actor = { userId: 'FIN-1', role: 'finance', office: 'RW', scope: {} };
export const ceo: Actor = { userId: 'CEO', role: 'ceo', office: 'RW', scope: {} };

// ---- standard per-unit cost ladder (matches the CF-002 contract fixture) ----
export const SUPPLIER_UNIT: Minor = minor(41.0);

/** Per-unit estimates for the non-EXW rungs; ocean & inlandDest are PRE-contingency. */
export const standardEst = (): Partial<Record<CostRung, Minor>> => ({
  inlandCn: minor(1.2),
  exportDocs: minor(0.35),
  originThc: minor(0.6),
  ocean: minor(6.5),
  insurance: minor(0.3),
  destCharges: minor(1.8),
  dutyVat: minor(4.9),
  inlandDest: minor(3.4),
});

/**
 * Build the full commercial chain up to an APPROVED quotation, the way the real workflow
 * does: customer → informal lead → human-clarified request → project → priced quotation.
 * `completedOrders` seeds the customer's tier (0 = new, ≥3 = established).
 */
export async function approvedChain(
  opts: { qty?: number; completedOrders?: number; requiredMargin?: number } = {},
) {
  // Customers are created by the sales agent (only sales_agent / ceo hold customer:create).
  const customer = await customers.create(agent, {
    name: 'Badiane Traders',
    country: 'CD',
    phone: '+243900000000',
    agentId: AGENT_ID,
  });
  if (opts.completedOrders) {
    await prisma.customer.update({
      where: { ref: customer.ref },
      data: { completedOrders: opts.completedOrders },
    });
  }
  const lead = await intake.createLead(agent, {
    customerRef: customer.ref,
    rawText: 'Salut, je veux 100 panneaux solaires 400W livrés à Goma, combien?',
  });
  const request = await intake.clarifyLead(agent, {
    leadRef: lead.ref,
    spec: { item: 'solar panel 400W', qty: 100, destination: 'GOMA' },
  });
  const project = await projects.create(vm, {
    requestRef: request.ref,
    name: 'Badiane solar 400W',
    owner: 'adeline',
  });
  const quotation = await quotations.build(vm, project.ref, {
    supplierUnitCostMinor: SUPPLIER_UNIT,
    estCostsMinor: standardEst(),
    qty: opts.qty ?? 100,
    requiredMargin: opts.requiredMargin ?? 0.18,
    sellIncoterm: 'CIF',
  });
  await quotations.approve(vm, quotation.ref);
  return { customer, lead, request, project, quotation };
}
