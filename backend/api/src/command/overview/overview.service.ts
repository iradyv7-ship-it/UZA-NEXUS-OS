import { Injectable } from '@nestjs/common';
import type { Actor } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { CommandAccessService } from '../command-authz.service';

/**
 * The CEO command view — "what needs my attention". Gated on the `overview` capability
 * (ceo / venture_manager). Aggregates, across the org:
 *  - the caller's own open tasks,
 *  - tasks needing attention (overdue or blocked),
 *  - upcoming deadlines (tasks + grants due within the window),
 *  - the grant pipeline counts by status.
 * Read-only; a single call so the dashboard has everything in one round-trip.
 */
@Injectable()
export class OverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommandAccessService,
  ) {}

  async overview(actor: Actor, opts: { horizonDays?: number } = {}) {
    await this.access.assertRole(actor, 'overview', 'commandOverview', 'read', 'overview');
    await this.access.allow(actor, 'commandOverview', 'read', 'overview');

    const now = new Date();
    const horizon = new Date(now.getTime() + (opts.horizonDays ?? 14) * 86_400_000);
    const OPEN = ['todo', 'in_progress', 'blocked'] as const;

    const [myOpenTasks, needsAttention, upcomingTasks, upcomingGrants, grantGroups] =
      await Promise.all([
        this.prisma.commandTask.findMany({
          where: { assigneeId: actor.userId, status: { in: [...OPEN] } },
          orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }],
          take: 50,
        }),
        this.prisma.commandTask.findMany({
          where: {
            status: { in: [...OPEN] },
            OR: [{ dueAt: { lt: now } }, { status: 'blocked' }],
          },
          orderBy: { dueAt: 'asc' },
          take: 50,
        }),
        this.prisma.commandTask.findMany({
          where: { status: { in: [...OPEN] }, dueAt: { gte: now, lte: horizon } },
          orderBy: { dueAt: 'asc' },
          take: 50,
        }),
        this.prisma.grant.findMany({
          where: {
            status: { notIn: ['awarded', 'rejected', 'closed'] },
            deadlineAt: { gte: now, lte: horizon },
          },
          orderBy: { deadlineAt: 'asc' },
          take: 50,
        }),
        this.prisma.grant.groupBy({ by: ['status'], _count: { _all: true } }),
      ]);

    const grantPipeline = Object.fromEntries(grantGroups.map((g) => [g.status, g._count._all]));

    return {
      generatedAt: now.toISOString(),
      horizonDays: opts.horizonDays ?? 14,
      myOpenTasks,
      needsAttention, // overdue or blocked, org-wide
      upcomingDeadlines: { tasks: upcomingTasks, grants: upcomingGrants },
      grantPipeline, // { identified: n, preparing: n, ... }
      counts: {
        myOpenTasks: myOpenTasks.length,
        needsAttention: needsAttention.length,
        upcomingTasks: upcomingTasks.length,
        upcomingGrants: upcomingGrants.length,
      },
    };
  }
}
