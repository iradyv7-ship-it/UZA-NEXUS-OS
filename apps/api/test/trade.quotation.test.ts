import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { MASK, minor, FREIGHT_CONTINGENCY, type CostLadder } from '@uza/contracts';
import { prisma, resetDb } from './db';
import { resetTradeDb } from './trade-db';
import {
  quotations,
  projects,
  intake,
  customers,
  vm,
  agent,
  finance,
  ceo,
  AGENT_ID,
  SUPPLIER_UNIT,
  standardEst,
  approvedChain,
} from './trade-fixtures';

beforeEach(async () => {
  await resetDb();
  await resetTradeDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe('quotation — cost ladder, both margins, contingency, actuals', () => {
  it('CF-004: freight rungs carry the contingency factor, other rungs do not', async () => {
    const { quotation } = await approvedChain();
    const row = await prisma.quotation.findUniqueOrThrow({ where: { ref: quotation.ref } });
    const ladder = row.ladder as unknown as CostLadder;

    // ocean 6.50 and inlandDest 3.40 uplifted by 9%; exportDocs untouched.
    expect(ladder.ocean.estMinor).toBe(Math.round(minor(6.5) * (1 + FREIGHT_CONTINGENCY))); // 709
    expect(ladder.inlandDest.estMinor).toBe(Math.round(minor(3.4) * (1 + FREIGHT_CONTINGENCY))); // 371
    expect(ladder.exportDocs.estMinor).toBe(minor(0.35)); // 35, no uplift
    expect(ladder.exw.estMinor).toBe(SUPPLIER_UNIT);
  });

  it('CF-002/003: quoted margin holds at the sell incoterm and DAP margin is exposed alongside, materially lower', async () => {
    const { quotation } = await approvedChain();
    const view = await quotations.read(ceo, quotation.ref);

    expect(typeof view.marginPct).toBe('number');
    expect(Math.abs((view.marginPct as number) - 0.18)).toBeLessThan(0.01); // ~18% at CIF
    expect(typeof view.dapMargin).toBe('number');
    // The number that tells the truth: DAP margin is far below the quoted CIF margin.
    expect(view.dapMargin as number).toBeLessThan((view.marginPct as number) - 0.1);
    expect(view.dapMargin as number).toBeLessThan(0.05); // ~1.1% on this ladder
  });

  it('CF-029: realized margin computes from actuals; the quoted figure is never overwritten', async () => {
    const { quotation } = await approvedChain();
    const before = await quotations.read(ceo, quotation.ref);
    const quotedMargin = before.marginPct as number;
    const dapBefore = before.dapMargin as number;

    // Actuals land weeks later: duty came in higher than estimated.
    await quotations.closeCosts(finance, quotation.ref, { dutyVat: minor(6.0) });

    const row = await prisma.quotation.findUniqueOrThrow({ where: { ref: quotation.ref } });
    expect(row.marginPct).toBe(quotedMargin); // quoted is untouched
    expect(row.realizedMargin).not.toBeNull(); // realized is populated
    expect(row.realizedMargin!).toBeLessThan(dapBefore); // higher actual cost => lower realized margin
  });
});

describe('quotation — masking on read', () => {
  it('an agent sees the customer price but never cost, target, walkaway or either margin', async () => {
    const { quotation } = await approvedChain();
    const view = await quotations.read(agent, quotation.ref);

    expect(view.supplierUnitCost).toBe(MASK);
    expect(view.targetPrice).toBe(MASK);
    expect(view.walkawayPrice).toBe(MASK);
    expect(view.marginPct).toBe(MASK);
    expect(view.realizedMargin).toBe(MASK);
    expect(view.dapMargin).toBe(MASK);
    expect(view.customerUnitPriceMinor).not.toBe(MASK);
    expect(typeof view.customerUnitPriceMinor).toBe('number');
  });

  it('a margin-authorised role (venture manager) sees cost and both margins', async () => {
    // Finance holds margin:read (used by closeCosts) but NOT quotation:read, so the
    // unmasked-quotation positive case is the venture manager, who has both.
    const { quotation } = await approvedChain();
    const view = await quotations.read(vm, quotation.ref);
    expect(view.supplierUnitCost).toBe(SUPPLIER_UNIT);
    expect(typeof view.marginPct).toBe('number');
    expect(typeof view.dapMargin).toBe('number');
  });
});

describe('quotation — versioned, never edited in place', () => {
  it('a revision supersedes its predecessor and bumps the version', async () => {
    const customer = await customers.create(agent, {
      name: 'X',
      country: 'CD',
      phone: '+2439',
      agentId: AGENT_ID,
    });
    const lead = await intake.createLead(agent, {
      customerRef: customer.ref,
      rawText: 'need widgets',
    });
    const request = await intake.clarifyLead(agent, {
      leadRef: lead.ref,
      spec: { item: 'widget' },
    });
    const project = await projects.create(vm, { requestRef: request.ref, name: 'W', owner: 'a' });

    const v1 = await quotations.build(vm, project.ref, {
      supplierUnitCostMinor: SUPPLIER_UNIT,
      estCostsMinor: standardEst(),
      qty: 100,
      requiredMargin: 0.18,
    });
    const v2 = await quotations.revise(vm, v1.ref, {
      supplierUnitCostMinor: SUPPLIER_UNIT,
      estCostsMinor: standardEst(),
      qty: 120,
      requiredMargin: 0.2,
    });

    const oldRow = await prisma.quotation.findUniqueOrThrow({ where: { ref: v1.ref } });
    const newRow = await prisma.quotation.findUniqueOrThrow({ where: { ref: v2.ref } });

    expect(oldRow.status).toBe('superseded');
    expect(oldRow.supersededByRef).toBe(v2.ref);
    expect(newRow.version).toBe(2);
    expect(newRow.status).toBe('draft');
    // The predecessor's quoted margin is preserved — nothing edited in place.
    expect(oldRow.marginPct).toBe(v1.marginPct);
  });

  it('a superseded quotation cannot be revised or approved again', async () => {
    const { project } = await approvedChain();
    const v1 = await quotations.build(vm, project.ref, {
      supplierUnitCostMinor: SUPPLIER_UNIT,
      estCostsMinor: standardEst(),
      qty: 10,
      requiredMargin: 0.18,
    });
    await quotations.revise(vm, v1.ref, {
      supplierUnitCostMinor: SUPPLIER_UNIT,
      estCostsMinor: standardEst(),
      qty: 10,
      requiredMargin: 0.18,
    });
    await expect(quotations.approve(vm, v1.ref)).rejects.toThrow(/superseded/);
  });
});
