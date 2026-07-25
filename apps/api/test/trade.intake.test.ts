import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { prisma, resetDb } from './db';
import { resetTradeDb } from './trade-db';
import { customers, intake, projects, vm, agent, AGENT_ID } from './trade-fixtures';

beforeEach(async () => {
  await resetDb();
  await resetTradeDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

const WHATSAPP = 'Yo Badiane ici, il me faut 200 groupes electrogenes 5kVA pour Goma, prix?';

describe('intake — unstructured WhatsApp text becomes a structured request after human confirmation', () => {
  it('captures raw text as a Lead and publishes lead.created', async () => {
    const customer = await customers.create(agent, { name: 'Badiane', country: 'CD', phone: '+2439', agentId: AGENT_ID });
    const lead = await intake.createLead(agent, { customerRef: customer.ref, rawText: WHATSAPP });

    const row = await prisma.lead.findUniqueOrThrow({ where: { ref: lead.ref } });
    expect(row.rawText).toBe(WHATSAPP); // verbatim, unstructured
    expect(row.clarified).toBe(false);
    expect(row.stage).toBe('Awareness');

    const events = await prisma.outboxEvent.findMany({ where: { name: 'lead.created' } });
    expect(events).toHaveLength(1);
    expect((events[0]!.payload as Record<string, unknown>).leadRef).toBe(lead.ref);
  });

  it('clarifyLead is the human-confirmation step: it produces a Request and marks the lead clarified', async () => {
    const customer = await customers.create(agent, { name: 'Badiane', country: 'CD', phone: '+2439', agentId: AGENT_ID });
    const lead = await intake.createLead(agent, { customerRef: customer.ref, rawText: WHATSAPP });

    const request = await intake.clarifyLead(agent, {
      leadRef: lead.ref,
      spec: { item: 'generator 5kVA', qty: 200, destination: 'GOMA' },
    });

    const leadRow = await prisma.lead.findUniqueOrThrow({ where: { ref: lead.ref } });
    expect(leadRow.clarified).toBe(true);
    expect(leadRow.stage).toBe('Qualification');

    const reqRow = await prisma.request.findUniqueOrThrow({ where: { ref: request.ref } });
    expect(reqRow.customerRef).toBe(customer.ref);
    expect((reqRow.spec as Record<string, unknown>).qty).toBe(200);

    const events = await prisma.outboxEvent.findMany({ where: { name: 'request.created' } });
    expect(events).toHaveLength(1);
  });

  it('refuses to clarify the same lead twice', async () => {
    const customer = await customers.create(agent, { name: 'B', country: 'CD', phone: '+2439', agentId: AGENT_ID });
    const lead = await intake.createLead(agent, { customerRef: customer.ref, rawText: WHATSAPP });
    await intake.clarifyLead(agent, { leadRef: lead.ref, spec: { item: 'x' } });
    await expect(intake.clarifyLead(agent, { leadRef: lead.ref, spec: { item: 'x' } })).rejects.toThrow(/already clarified/);
  });
});

describe('project — cannot form from unstructured text without confirmation; RACI is two fields', () => {
  it('a project cannot be created from a request whose lead is not clarified', async () => {
    const customer = await customers.create(agent, { name: 'B', country: 'CD', phone: '+2439', agentId: AGENT_ID });
    const lead = await intake.createLead(agent, { customerRef: customer.ref, rawText: WHATSAPP });
    // Forge a request that points at the still-unclarified lead (bypassing clarifyLead).
    const forged = await prisma.request.create({
      data: { ref: 'REQ-BULK-2026-9999', customerRef: customer.ref, leadRef: lead.ref, spec: {} },
    });
    await expect(projects.create(vm, { requestRef: forged.ref, name: 'x', owner: 'o' })).rejects.toThrow(/not clarified/);
  });

  it('creates a project from a clarified request and carries the customer agent', async () => {
    const customer = await customers.create(agent, { name: 'B', country: 'CD', phone: '+2439', agentId: AGENT_ID });
    const lead = await intake.createLead(agent, { customerRef: customer.ref, rawText: WHATSAPP });
    const request = await intake.clarifyLead(agent, { leadRef: lead.ref, spec: { item: 'x' } });

    const project = await projects.create(vm, { requestRef: request.ref, name: 'P', owner: 'adeline' });
    expect(project.agentId).toBe(AGENT_ID);
    expect(project.owner).toBe('adeline');
  });

  it('a RACI task requires both accountable and responsible', async () => {
    const customer = await customers.create(agent, { name: 'B', country: 'CD', phone: '+2439', agentId: AGENT_ID });
    const lead = await intake.createLead(agent, { customerRef: customer.ref, rawText: WHATSAPP });
    const request = await intake.clarifyLead(agent, { leadRef: lead.ref, spec: { item: 'x' } });
    const project = await projects.create(vm, { requestRef: request.ref, name: 'P', owner: 'adeline' });

    const task = await projects.createTask(vm, {
      projectRef: project.ref,
      title: 'Source 3 supplier quotes',
      accountable: 'adeline',
      responsible: 'badiane',
    });
    expect(task.accountable).toBe('adeline');
    expect(task.responsible).toBe('badiane');

    await expect(
      projects.createTask(vm, { projectRef: project.ref, title: 't', accountable: '', responsible: 'x' }),
    ).rejects.toThrow(/accountable and a responsible/);
  });
});
