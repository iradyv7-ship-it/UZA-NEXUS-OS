import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { minor, type Actor, type Minor } from '@uza/contracts';
import { prisma } from './db';
import { AuditService } from '../src/platform/audit/audit.service';
import { CommandAccessService } from '../src/command/command-authz.service';
import { TaskService } from '../src/command/task/task.service';
import { GrantService } from '../src/command/grant/grant.service';
import { DepartmentService } from '../src/command/department/department.service';
import { OverviewService } from '../src/command/overview/overview.service';

const audit = new AuditService(prisma as never);
const access = new CommandAccessService(audit);
const tasks = new TaskService(prisma as never, access);
const grants = new GrantService(prisma as never, access);
const depts = new DepartmentService(prisma as never, access);
const overview = new OverviewService(prisma as never, access);

const ceo: Actor = { userId: 'CEO-1', role: 'ceo', office: 'RW', scope: {} };
const finance: Actor = { userId: 'FIN-1', role: 'finance', office: 'RW', scope: {} };
const sourcing: Actor = { userId: 'CN-1', role: 'china_sourcing', office: 'CN', scope: {} };
// An external role, not 'customer' — that role was removed 30 Aug 2026 (a customer never
// authenticates into Nexus). logistics_partner is an equally valid stand-in: also external,
// also holds zero command grants, per command-access.ts.
const partner: Actor = {
  userId: 'PTR-1',
  role: 'logistics_partner',
  office: 'GOM',
  scope: { shipmentRefs: [] },
};

async function reset(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "CommandTask","Grant","EmployeeProfile","Department","AuditLog" RESTART IDENTITY CASCADE',
  );
}

beforeEach(reset);
afterAll(async () => {
  await prisma.$disconnect();
});

describe('Command Center — tasks', () => {
  it('ceo creates a task; the assignee (finance) sees it, ceo sees all, an unrelated internal user does not', async () => {
    await depts.create(ceo, { code: 'OPS', name: 'Operations' });
    const t = await tasks.create(ceo, {
      title: 'Q3 supplier review',
      assigneeId: 'FIN-1',
      priority: 'high',
    });
    expect(t.ref).toMatch(/^CTSK-/);
    expect(t.status).toBe('todo');

    const ceoList = await tasks.list(ceo, {}, { limit: 20, offset: 0 });
    expect(ceoList.some((x) => x.ref === t.ref)).toBe(true); // ceo sees all

    const finList = await tasks.list(finance, {}, { limit: 20, offset: 0 });
    expect(finList.some((x) => x.ref === t.ref)).toBe(true); // assignee sees it

    const cnList = await tasks.list(sourcing, {}, { limit: 20, offset: 0 });
    expect(cnList.some((x) => x.ref === t.ref)).toBe(false); // unrelated internal user does not
  });

  it('completes a task', async () => {
    const t = await tasks.create(ceo, { title: 'ship docs', assigneeId: 'FIN-1' });
    const done = await tasks.complete(ceo, t.ref);
    expect(done.status).toBe('done');
  });

  it('denies an external role (403, audited before the throw)', async () => {
    await expect(tasks.create(partner, { title: 'x', assigneeId: 'PTR-1' })).rejects.toThrow();
    const deny = await prisma.auditLog.findFirst({ where: { decision: 'deny' } });
    expect(deny).not.toBeNull();
  });
});

describe('Command Center — grants', () => {
  it('creates a grant and advances its status along the pipeline', async () => {
    const g = await grants.create(ceo, {
      name: 'AfDB Trade Facilitation',
      funder: 'AfDB',
      amountMinor: minor(250000) as Minor,
      currency: 'USD',
    });
    expect(g.ref).toMatch(/^GRNT-/);
    expect(g.status).toBe('identified');

    const g2 = await grants.advanceStatus(ceo, g.ref, 'preparing');
    expect(g2.status).toBe('preparing');

    const list = await grants.list(ceo, { status: 'preparing' }, { limit: 20, offset: 0 });
    expect(list.some((x) => x.ref === g.ref)).toBe(true);
  });

  it('denies a sales_agent from the grant pipeline', async () => {
    const agent: Actor = { userId: 'AGT-1', role: 'sales_agent', office: 'GOM', scope: {} };
    await expect(grants.list(agent, {}, { limit: 20, offset: 0 })).rejects.toThrow();
  });
});

describe('Command Center — overview', () => {
  it("aggregates the caller's tasks, attention items, upcoming deadlines and the grant pipeline", async () => {
    const soon = new Date(Date.now() + 3 * 86_400_000);
    const past = new Date(Date.now() - 2 * 86_400_000);
    await tasks.create(ceo, { title: 'mine', assigneeId: 'CEO-1', dueAt: soon }); // my open + upcoming
    await tasks.create(ceo, { title: 'overdue', assigneeId: 'FIN-1', dueAt: past }); // needs attention
    await grants.create(ceo, {
      name: 'G',
      funder: 'F',
      amountMinor: minor(1000) as Minor,
      currency: 'USD',
      deadlineAt: soon,
    });

    const o = await overview.overview(ceo, {});
    expect(o.counts.myOpenTasks).toBeGreaterThanOrEqual(1);
    expect(o.counts.needsAttention).toBeGreaterThanOrEqual(1);
    expect(o.counts.upcomingGrants).toBeGreaterThanOrEqual(1);
    expect(o.grantPipeline.identified).toBeGreaterThanOrEqual(1);
  });

  it('denies a non-executive from the overview', async () => {
    await expect(overview.overview(finance, {})).rejects.toThrow();
  });
});
