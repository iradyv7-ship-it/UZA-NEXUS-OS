import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { Actor } from '@uza/contracts';
import type { WorkspaceTaskStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UmurimoAccessService } from '../umurimo-authz.service';
import { seesAllWeeks } from '../umurimo-access';

const RESOURCE = 'workspace';
const MAX_BATCH = 500;

export interface PushTask {
  externalId: string;
  title: string;
  status: 'todo' | 'in_progress' | 'done';
  assigneeEmail?: string;
  project?: string;
  priority?: string;
  url?: string;
  createdAt?: string;
  deadline?: string;
  completedAt?: string;
  completionNote?: string;
}

/**
 * The bridge from the team workspace into Nexus.
 *
 * The workspace is where work happens — tasks, subtasks, deadlines, completion notes, and each
 * person's own space. Nexus is the layer above, and its job is to answer what a task board
 * structurally cannot: whether the week's commitments actually completed, who is silent, what
 * problem keeps coming back, and who is carrying too much.
 *
 * **Push, not poll.** The workspace sends batches here. That needs no credentials stored in
 * Nexus, it works whether the workspace is a UZA build or a third-party product, and when it
 * breaks it stops sending — which `stale()` reports — instead of a poller quietly returning
 * nothing and the register looking calm while it drifts.
 *
 * **Read-only, permanently.** There is no path in this class that writes back to the
 * workspace, and there must never be one. Observing a system is a different thing from acting
 * in it, and the second is a decision nobody has made.
 */
@Injectable()
export class WorkspaceService {
  private readonly logger = new Logger(WorkspaceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: UmurimoAccessService,
  ) {}

  /**
   * Receive a batch of tasks. Idempotent on `externalId`.
   *
   * Assignees are matched to Nexus users by email. **An unmatched email is reported, never
   * dropped** — a task belonging to nobody is exactly the kind of thing that makes an
   * integration rot in silence, and the returned `unmatched` list is what stops that.
   */
  async pushTasks(actor: Actor, tasks: PushTask[]) {
    await this.access.assertRole(actor, 'workspace:sync', RESOURCE, 'create');

    if (!tasks.length) throw new BadRequestException('nothing to sync');
    if (tasks.length > MAX_BATCH) {
      throw new BadRequestException(`send at most ${MAX_BATCH} tasks per batch`);
    }

    const emails = [...new Set(tasks.map((t) => t.assigneeEmail?.toLowerCase()).filter(Boolean))];
    const users = await this.prisma.user.findMany({
      where: { email: { in: emails as string[] }, disabledAt: null },
      select: { ref: true, email: true },
    });
    const byEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.ref]));

    const unmatched = new Set<string>();
    let received = 0;

    for (const t of tasks) {
      const email = t.assigneeEmail?.toLowerCase() ?? null;
      const assigneeRef = email ? (byEmail.get(email) ?? null) : null;
      if (email && !assigneeRef) unmatched.add(email);

      const data = {
        title: t.title.trim(),
        status: t.status as WorkspaceTaskStatus,
        project: t.project?.trim() || null,
        priority: t.priority?.trim() || null,
        url: t.url?.trim() || null,
        assigneeEmail: email,
        assigneeRef,
        createdAtSource: this.date(t.createdAt),
        deadline: this.date(t.deadline),
        completedAt: this.date(t.completedAt),
        completionNote: t.completionNote?.trim() || null,
        syncedAt: new Date(),
      };

      await this.prisma.workspaceTask.upsert({
        where: { externalId: t.externalId },
        create: { externalId: t.externalId, ...data },
        update: data,
      });
      received += 1;
    }

    if (unmatched.size) {
      this.logger.warn(`${unmatched.size} workspace assignee(s) match no Nexus user`);
    }

    await this.access.allow(actor, RESOURCE, 'create');
    return { received, unmatched: [...unmatched] };
  }

  /** My open tasks, newest deadline first. The half of My week that comes from real work. */
  async mine(actor: Actor) {
    await this.access.assertRole(actor, 'workspace:read', RESOURCE, 'list');
    const rows = await this.prisma.workspaceTask.findMany({
      where: { assigneeRef: actor.userId, status: { not: 'done' } },
      orderBy: [{ deadline: 'asc' }, { title: 'asc' }],
    });
    await this.access.allow(actor, RESOURCE, 'list');
    return rows;
  }

  /**
   * What one person actually did in a window — the measurement the scorecard needs.
   *
   * `assigned` counts tasks that were open or completed inside the window; `done` counts those
   * completed in it. A task finished in a later week does not retroactively improve an earlier
   * one, and a task carried in from before still counts as work in progress.
   */
  async completion(userRef: string, from: Date, to: Date) {
    const [done, openNow, overdue] = await Promise.all([
      this.prisma.workspaceTask.count({
        where: { assigneeRef: userRef, status: 'done', completedAt: { gte: from, lt: to } },
      }),
      this.prisma.workspaceTask.count({
        where: { assigneeRef: userRef, status: { not: 'done' } },
      }),
      this.prisma.workspaceTask.count({
        where: { assigneeRef: userRef, status: { not: 'done' }, deadline: { lt: new Date() } },
      }),
    ]);
    return { done, openNow, overdue };
  }

  /**
   * Is the bridge alive?
   *
   * An integration that stops pushing looks exactly like a quiet week, and the two must never
   * be confused. If the newest row is older than a day, say so rather than reporting calm.
   */
  async health(actor: Actor) {
    await this.access.assertRole(actor, 'workspace:read', RESOURCE, 'read');

    const [total, newest, unmapped, byStatus] = await Promise.all([
      this.prisma.workspaceTask.count(),
      this.prisma.workspaceTask.findFirst({
        orderBy: { syncedAt: 'desc' },
        select: { syncedAt: true },
      }),
      this.prisma.workspaceTask.count({
        where: { assigneeEmail: { not: null }, assigneeRef: null },
      }),
      this.prisma.workspaceTask.groupBy({ by: ['status'], _count: true }),
    ]);

    const hoursSince = newest
      ? Math.round((Date.now() - newest.syncedAt.getTime()) / 3_600_000)
      : null;

    await this.access.allow(actor, RESOURCE, 'read');
    return {
      total,
      lastSyncedAt: newest?.syncedAt ?? null,
      hoursSinceLastSync: hoursSince,
      /** Nothing pushed in over a day. Treat as broken, not as a quiet week. */
      stale: hoursSince === null || hoursSince > 24,
      /** Tasks whose assignee matches no Nexus user. Every one is invisible to the scorecard. */
      unmappedAssignees: unmapped,
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count])),
      visibleToMe: seesAllWeeks(actor.role) ? 'everyone' : 'me',
    };
  }

  private date(v?: string): Date | null {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
}
