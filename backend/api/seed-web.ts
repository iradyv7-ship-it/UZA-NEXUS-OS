import { emptyLadder, type Actor } from '@uza/contracts';
import { PrismaClient } from '@prisma/client';
import { IdentityService } from './src/platform/identity/identity.service';
import { AuditService } from './src/platform/audit/audit.service';
import { AuthorizationService } from './src/platform/authorization/authorization.service';

/** Idempotent seed for the web slice: one org, one office, the internal users the
 *  venture_manager flow needs, PLUS the two external-portal users (customer + Imari
 *  partner) and the minimal demo data behind them. Safe to run repeatedly. */

// ---- fixed demo refs (stable so re-runs are no-ops) ------------------------
const DEMO_CUSTOMER_REF = 'CUS-WEB-000001';
const DEMO_LEAD_REF = 'LEAD-WEB-2026-0001';
const DEMO_REQUEST_REF = 'REQ-WEB-2026-0001';
const DEMO_PROJECT_REF = 'PRJ-WEB-2026-0001';
const DEMO_QUOTATION_REF = 'QUO-WEB-2026-0001';
const DEMO_ORDER_REF = 'ORD-WEB-2026-0001';
const DEMO_INVOICE_REF = 'INV-WEB-2026-0001';
const DEMO_SHIPMENT_REF = 'SHP-WEB-2026-0001';
const DEMO_RECEIPT_REF = 'WR-WEB-2026-0001';
const DEMO_LOT_REF = 'LOT-WEB-2026-0001';
const DEMO_DELIVERY_REF = 'DEL-WEB-2026-0001';
const DEMO_AGENT_ID = 'AGT-GOM-0021';

// A simple 50/30/20 schedule (confirmation / pre_loading / pre_release).
const ORDER_TOTAL_MINOR = 5_000_000; // $50,000.00 (200 units × $250.00)
const SCHEDULE: Array<[string, number]> = [
  ['confirmation', 0.5],
  ['pre_loading', 0.3],
  ['pre_release', 0.2],
];
// Parts sum EXACTLY to the total; remainder to the last tranche.
const scheduleParts = (): Array<{ trigger: string; pct: number; amountMinor: number }> => {
  let allocated = 0;
  return SCHEDULE.map(([trigger, pct], i) => {
    const amountMinor =
      i === SCHEDULE.length - 1
        ? ORDER_TOTAL_MINOR - allocated
        : Math.round(ORDER_TOTAL_MINOR * pct);
    allocated += amountMinor;
    return { trigger, pct, amountMinor };
  });
};

/**
 * The commercial chain behind `customer@uza.rw`: customer → lead → request → project →
 * approved quotation → order (+installments) → issued invoice (+installments). Written by
 * direct Prisma upsert so the seed is deterministic and idempotent — a re-run touches
 * nothing. The customer portal reads these via the existing scoped endpoints (`/orders`,
 * `/projects`, `/quotations`, invoices), so the customer can see their order and pay.
 */
async function seedCommercialDemo(prisma: PrismaClient): Promise<void> {
  const has = await prisma.order.findUnique({ where: { ref: DEMO_ORDER_REF } });
  if (has) {
    console.log(`exists   commercial demo (order ${DEMO_ORDER_REF})`);
    return;
  }

  await prisma.customer.upsert({
    where: { ref: DEMO_CUSTOMER_REF },
    update: {},
    create: {
      ref: DEMO_CUSTOMER_REF,
      name: 'Demo Trading Co (Goma)',
      country: 'CD',
      phone: '+243900000000',
      agentId: DEMO_AGENT_ID,
    },
  });

  await prisma.lead.upsert({
    where: { ref: DEMO_LEAD_REF },
    update: {},
    create: {
      ref: DEMO_LEAD_REF,
      customerRef: DEMO_CUSTOMER_REF,
      agentId: DEMO_AGENT_ID,
      rawText: 'Need 200 solar kits, delivered Kigali',
      stage: 'Negotiation',
      clarified: true,
    },
  });

  await prisma.request.upsert({
    where: { ref: DEMO_REQUEST_REF },
    update: {},
    create: {
      ref: DEMO_REQUEST_REF,
      customerRef: DEMO_CUSTOMER_REF,
      leadRef: DEMO_LEAD_REF,
      spec: { item: 'solar kit', qty: 200 },
    },
  });

  await prisma.project.upsert({
    where: { ref: DEMO_PROJECT_REF },
    update: {},
    create: {
      ref: DEMO_PROJECT_REF,
      customerRef: DEMO_CUSTOMER_REF,
      agentId: DEMO_AGENT_ID,
      requestRef: DEMO_REQUEST_REF,
      name: 'Demo solar-kit import',
      owner: 'VM-RW-0001',
      stage: 'Execution',
    },
  });

  // A COMPLETE, correctly-keyed cost ladder (all 9 rungs via emptyLadder), the way the real
  // QuotationService.build produces it — a partial/mis-keyed ladder crashes dapMargin over
  // the full LADDER. Per-unit estimates ($ minor): shows the CIF (~19%) vs DAP (~3%) gap.
  const demoLadder = emptyLadder();
  demoLadder.exw.estMinor = 18_000; // supplier cost $180/unit
  demoLadder.ocean.estMinor = 2_000; // CIF rung
  demoLadder.insurance.estMinor = 200; // CIF rung
  demoLadder.destCharges.estMinor = 900; // DAP rung
  demoLadder.dutyVat.estMinor = 2_500; // DAP rung
  demoLadder.inlandDest.estMinor = 600; // DAP rung

  await prisma.quotation.upsert({
    where: { ref: DEMO_QUOTATION_REF },
    update: {},
    create: {
      ref: DEMO_QUOTATION_REF,
      projectRef: DEMO_PROJECT_REF,
      customerRef: DEMO_CUSTOMER_REF,
      agentId: DEMO_AGENT_ID,
      qty: 200,
      sellIncoterm: 'CIF',
      ladder: demoLadder as unknown as object,
      supplierUnitCostMinor: 18_000,
      targetPriceMinor: 16_560, // 18_000 × TARGET_PRICE_FACTOR (0.92)
      walkawayPriceMinor: 18_900, // 18_000 × WALKAWAY_FACTOR (1.05)
      customerUnitPriceMinor: 25_000, // $250.00/unit → $50,000 order
      marginPct: 0.192, // quoted margin at CIF
      status: 'approved',
    },
  });

  const parts = scheduleParts();

  await prisma.order.upsert({
    where: { ref: DEMO_ORDER_REF },
    update: {},
    create: {
      ref: DEMO_ORDER_REF,
      projectRef: DEMO_PROJECT_REF,
      customerRef: DEMO_CUSTOMER_REF,
      agentId: DEMO_AGENT_ID,
      quotationRef: DEMO_QUOTATION_REF,
      totalMinor: ORDER_TOTAL_MINOR,
      tier: 'new',
      status: 'awaiting_payment',
      installments: {
        create: parts.map((p) => ({
          ref: `INST-WEB-2026-${p.trigger}`,
          trigger: p.trigger,
          pct: p.pct,
          amountMinor: p.amountMinor,
          status: 'due',
        })),
      },
    },
  });

  await prisma.invoice.upsert({
    where: { ref: DEMO_INVOICE_REF },
    update: {},
    create: {
      ref: DEMO_INVOICE_REF,
      orderRef: DEMO_ORDER_REF,
      customerRef: DEMO_CUSTOMER_REF,
      agentId: DEMO_AGENT_ID,
      totalMinor: ORDER_TOTAL_MINOR,
      tier: 'new',
      status: 'issued',
      installments: {
        create: parts.map((p) => ({
          ref: `FININST-WEB-2026-${p.trigger}`,
          orderRef: DEMO_ORDER_REF,
          trigger: p.trigger,
          pct: p.pct,
          amountMinor: p.amountMinor,
          status: 'due',
        })),
      },
    },
  });

  console.log(
    `created  commercial demo (customer ${DEMO_CUSTOMER_REF} → order ${DEMO_ORDER_REF} + invoice ${DEMO_INVOICE_REF})`,
  );
}

/**
 * The logistics chain behind `partner@uza.rw`: an assigned shipment, its warehouse receipt
 * + two received packages (measured kg/CBM, destination-pure KIGALI), and a delivery. The
 * Imari partner portal reads these via `/partner-portal/shipments` (list + by-ref); freight
 * cost is masked at the service layer, so the seeded `freightPaidMinor`/`billedRevenueTon`
 * are present in the DB but never reach the partner as numbers.
 */
async function seedLogisticsDemo(prisma: PrismaClient): Promise<void> {
  const has = await prisma.shipment.findUnique({ where: { ref: DEMO_SHIPMENT_REF } });
  if (has) {
    console.log(`exists   logistics demo (shipment ${DEMO_SHIPMENT_REF})`);
    return;
  }

  await prisma.shipment.upsert({
    where: { ref: DEMO_SHIPMENT_REF },
    update: {},
    create: {
      ref: DEMO_SHIPMENT_REF,
      container: 'MSKU-DEMO-1',
      carrier: 'Maersk',
      destination: 'KIGALI',
      etd: '2026-08-01',
      eta: '2026-09-15',
      status: 'in_transit',
      partnerId: 'PARTNER-IMARI',
      measuredRevenueTon: 4.0,
      billedRevenueTon: 4.2,
      freightPaidMinor: 420_000,
      daysWaitingForConsolidation: 3,
    },
  });

  await prisma.warehouseReceipt.upsert({
    where: { ref: DEMO_RECEIPT_REF },
    update: {},
    create: {
      ref: DEMO_RECEIPT_REF,
      orderRef: DEMO_ORDER_REF,
      poRef: 'PO-CN-WEB-0001',
      customerRef: DEMO_CUSTOMER_REF,
      lotRef: DEMO_LOT_REF,
      declaredCbm: 4.0,
      declaredKg: 4000,
      measuredCbm: 4.0,
      measuredKg: 4000,
      measuredRevenueTon: 4.0,
      variance: 0,
      discrepancy: false,
      hardStop: false,
    },
  });

  const packages: Array<{ ref: string; kg: number; cbm: number }> = [
    { ref: 'PKG-WEB-2026-0001', kg: 2000, cbm: 2.0 },
    { ref: 'PKG-WEB-2026-0002', kg: 2000, cbm: 2.0 },
  ];
  for (const p of packages) {
    await prisma.package.upsert({
      where: { ref: p.ref },
      update: {},
      create: {
        ref: p.ref,
        orderRef: DEMO_ORDER_REF,
        customerRef: DEMO_CUSTOMER_REF,
        poRef: 'PO-CN-WEB-0001',
        lotRef: DEMO_LOT_REF,
        kg: p.kg,
        cbm: p.cbm,
        destination: 'KIGALI',
        zone: 'READY_FOR_LOADING',
        qcReleased: true,
        varianceHold: false,
        shipmentRef: DEMO_SHIPMENT_REF,
      },
    });
  }

  await prisma.delivery.upsert({
    where: { ref: DEMO_DELIVERY_REF },
    update: {},
    create: {
      ref: DEMO_DELIVERY_REF,
      shipmentRef: DEMO_SHIPMENT_REF,
      orderRef: DEMO_ORDER_REF,
      customerRef: DEMO_CUSTOMER_REF,
      packageRefs: packages.map((p) => p.ref),
      podRef: 'POD-WEB-2026-0001',
      status: 'delivered',
    },
  });

  console.log(
    `created  logistics demo (shipment ${DEMO_SHIPMENT_REF} + ${packages.length} packages + delivery ${DEMO_DELIVERY_REF})`,
  );
}

/**
 * Nexas Command Center demo: 2 departments, 3 tasks (one due soon, one OVERDUE, one BLOCKED)
 * and 2 grants (one near deadline) so the CEO overview shows real data on a fresh DB.
 * Idempotent — guarded by the first task ref.
 */
async function seedCommandDemo(prisma: PrismaClient): Promise<void> {
  if (await prisma.commandTask.findUnique({ where: { ref: 'CTSK-WEB-0001' } })) {
    console.log('exists   command demo (tasks + grants)');
    return;
  }
  const now = Date.now();
  const day = 86_400_000;
  for (const [ref, code, name] of [
    ['DPT-OPS', 'OPS', 'Operations'],
    ['DPT-FIN', 'FIN', 'Finance'],
  ] as const) {
    await prisma.department.upsert({ where: { ref }, update: {}, create: { ref, code, name } });
  }
  const tasks = [
    {
      ref: 'CTSK-WEB-0001',
      title: 'Prepare Q3 supplier review',
      assigneeId: 'VM-RW-0001',
      priority: 'high',
      status: 'todo',
      dueAt: new Date(now + 3 * day),
    },
    {
      ref: 'CTSK-WEB-0002',
      title: 'Reconcile July petty cash',
      assigneeId: 'FIN-RW-0001',
      priority: 'medium',
      status: 'todo',
      dueAt: new Date(now - 2 * day),
    }, // OVERDUE
    {
      ref: 'CTSK-WEB-0003',
      title: 'Resolve customs delay on SHP-WEB-2026-0001',
      assigneeId: 'VM-RW-0001',
      priority: 'urgent',
      status: 'blocked',
      dueAt: new Date(now + day),
      linkedRef: 'SHP-WEB-2026-0001',
    }, // BLOCKED
  ] as const;
  for (const t of tasks) {
    await prisma.commandTask.create({ data: { ...t, createdById: 'CEO-RW-0001' } });
  }
  const grants = [
    {
      ref: 'GRNT-WEB-0001',
      name: 'AfDB Trade Facilitation Grant',
      funder: 'African Development Bank',
      amountMinor: 25_000_000,
      currency: 'USD',
      deadlineAt: new Date(now + 5 * day),
      status: 'preparing',
      nextAction: 'Draft concept note',
      requirements: [
        { item: 'Concept note', done: false },
        { item: 'Company registration', done: true },
      ],
    },
    {
      ref: 'GRNT-WEB-0002',
      name: 'Rwanda Green Fund window',
      funder: 'FONERWA',
      amountMinor: 15_000_000,
      currency: 'USD',
      deadlineAt: new Date(now + 30 * day),
      status: 'identified',
      requirements: [],
    },
  ] as const;
  for (const g of grants) {
    await prisma.grant.create({
      data: { ...g, ownerId: 'CEO-RW-0001', requirements: g.requirements as unknown as object },
    });
  }
  console.log('created  command demo (2 departments, 3 tasks incl. overdue+blocked, 2 grants)');
}

async function main() {
  const prisma = new PrismaClient();
  const authz = new AuthorizationService(new AuditService(prisma as never));
  const identity = new IdentityService(prisma as never, authz);
  const ceoActor: Actor = { userId: 'CEO-RW-0001', role: 'ceo', office: 'GOM', scope: {} };

  let org = await prisma.organisation.findFirst();
  if (!org) org = await identity.createOrganisation(ceoActor, 'UZA Solutions Ltd');
  let office = await prisma.office.findFirst({ where: { code: 'GOM' } });
  if (!office) office = await identity.createOffice(ceoActor, org.id, 'GOM', 'Goma HQ');

  const users: Array<[string, string, string]> = [
    ['CEO-RW-0001', 'ceo@uza.rw', 'ceo'],
    ['VM-RW-0001', 'vm@uza.rw', 'venture_manager'],
    ['AGT-GOM-0021', 'agent@uza.rw', 'sales_agent'],
    ['FIN-RW-0001', 'finance@uza.rw', 'finance'],
    // The owner's Gmail, so once Google credentials are configured they can "Sign in with
    // Google" and be matched to this ceo user (password login also works meanwhile).
    ['CEO-RW-0002', 'iradyv7@gmail.com', 'ceo'],
  ];
  for (const [ref, email, role] of users) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`exists   ${email} (${role})`);
      continue;
    }
    await identity.createEmployee(ceoActor, {
      ref,
      email,
      password: 'password1',
      role: role as never,
      officeId: office.id,
    });
    console.log(`created  ${email} (${role})`);
  }

  // Demo data must exist BEFORE the portal users that scope onto it.
  await seedCommercialDemo(prisma);
  await seedLogisticsDemo(prisma);
  await seedCommandDemo(prisma);

  // Customer portal user — scoped to the demo customer (sees their order + invoice, can pay).
  const customerEmail = 'customer@uza.rw';
  if (await prisma.user.findUnique({ where: { email: customerEmail } })) {
    console.log(`exists   ${customerEmail} (customer)`);
  } else {
    await identity.createEmployee(ceoActor, {
      ref: 'CUS-WEB-0001',
      email: customerEmail,
      password: 'password1',
      role: 'customer',
      officeId: office.id,
      scopeCustomerId: DEMO_CUSTOMER_REF,
    });
    console.log(`created  ${customerEmail} (customer, scope.customerId=${DEMO_CUSTOMER_REF})`);
  }

  // Imari partner-portal user — scoped to the demo shipment (sees it + packages + delivery,
  // never freight cost). Partner accounts expire by construction, so give a future window.
  const partnerEmail = 'partner@uza.rw';
  if (await prisma.user.findUnique({ where: { email: partnerEmail } })) {
    console.log(`exists   ${partnerEmail} (logistics_partner)`);
  } else {
    await identity.createPartnerAccount(
      ceoActor,
      {
        ref: 'PARTNER-IMARI-0001',
        email: partnerEmail,
        password: 'password1',
        role: 'logistics_partner',
        officeId: office.id,
        scopeShipmentRefs: [DEMO_SHIPMENT_REF],
      },
      new Date('2030-01-01T00:00:00.000Z'),
    );
    console.log(
      `created  ${partnerEmail} (logistics_partner, scope.shipmentRefs=[${DEMO_SHIPMENT_REF}])`,
    );
  }

  await prisma.$disconnect();
  console.log('seed done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
