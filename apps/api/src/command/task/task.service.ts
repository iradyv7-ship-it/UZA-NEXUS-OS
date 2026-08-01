import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Prisma, CommandTaskPriority, CommandTaskStatus } from '@prisma/client';
import type { Actor } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { CommandAccessService } from '../command-authz.service';
import { commandTaskRef } from '../command-ids';
import { managedDepartmentIds, canSeeTask, taskScopeWhere } from '../command-scope';

export interface ListPage {
  readonly limit: number;
  readonly offset: number;
}

export interface CreateTaskInput {
  readonly title: string;
  readonly description?: string;
  readonly assigneeId: string;
  readonly departmentCode?: string;
  readonly priority?: CommandTaskPriority;
  readonly dueAt?: Date;
  readonly linkedRef?: string;
  readonly parentTaskRef?: string;
}

export interface UpdateTaskInput {
  readonly status?: CommandTaskStatus;
  readonly priority?: CommandTaskPriority;
  readonly assigneeId?: string;
  readonly dueAt?: Date | null;
}

export interface ListTaskFilters {
  readonly status?: CommandTaskStatus;
  readonly assigneeId?: string;
  readonly departmentCode?: string;
  readonly overdue?: boolean;
}

const RESOURCE = 'commandTask';

/**
 * Management tasks — the executive-layer unit of "what needs doing". Distinct from trade's
 * RACI project Task. A task carries a single assignee (may be anyone, cross-department),
 * priority/status, optional due date, an optional free `linkedRef` to any UZA Nexus record,
 * and optional subtasks. Authorisation is enforced here via the module-local access policy;
 * object-scope (own vs department-managed) mirrors the by-ref read and the list exactly.
 */
@Injectable()
export class TaskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommandAccessService,
  ) {}

  private async resolveDepartmentId(code?: string): Promise<string | null> {
    if (!code) return null;
    const dept = await this.prisma.department.findUnique({
      where: { code: code.toUpperCase() },
      select: { id: true },
    });
    if (!dept) throw new NotFoundException(`department code ${code} not found`);
    return dept.id;
  }

  async create(actor: Actor, input: CreateTaskInput) {
    await this.access.assertRole(actor, 'task:create', RESOURCE, 'create');
    if (!input.title.trim()) throw new BadRequestException('a task requires a title');

    const departmentId = await this.resolveDepartmentId(input.departmentCode);

    if (input.parentTaskRef) {
      const parent = await this.prisma.commandTask.findUnique({
        where: { ref: input.parentTaskRef },
        select: { ref: true },
      });
      if (!parent) throw new NotFoundException(`parent task ${input.parentTaskRef} not found`);
    }

    const seq = (await this.prisma.commandTask.count()) + 1;
    const ref = commandTaskRef(seq);
    const created = await this.prisma.commandTask.create({
      data: {
        ref,
        title: input.title,
        description: input.description ?? null,
        assigneeId: input.assigneeId,
        departmentId,
        priority: input.priority ?? 'medium',
        status: 'todo',
        dueAt: input.dueAt ?? null,
        createdById: actor.userId,
        linkedRef: input.linkedRef ?? null,
        parentTaskId: input.parentTaskRef ?? null,
      },
    });
    await this.access.allow(actor, RESOURCE, 'create', ref);
    return created;
  }

  /** Load a task and enforce the by-ref object-scope (own or a department the actor manages). */
  async read(actor: Actor, ref: string) {
    await this.access.assertRole(actor, 'task:read', RESOURCE, 'read', ref);
    const task = await this.prisma.commandTask.findUnique({ where: { ref } });
    if (!task) throw new NotFoundException(`task ${ref} not found`);
    const managed = await managedDepartmentIds(this.prisma, actor);
    if (!canSeeTask(actor, task, managed)) {
      return this.access.denyScope(actor, RESOURCE, 'read', ref);
    }
    await this.access.allow(actor, RESOURCE, 'read', ref);
    return task;
  }

  /**
   * The caller's in-scope tasks. Role gate first (no grant → 403), then the object-scope
   * predicate (`taskScopeWhere`) which mirrors `canSeeTask` so a list can never surface a
   * task the by-ref read would deny. Optional filters AND on top of scope (narrow only).
   */
  async list(actor: Actor, filters: ListTaskFilters, page: ListPage) {
    await this.access.assertRole(actor, 'task:read', RESOURCE, 'read');
    const managed = await managedDepartmentIds(this.prisma, actor);
    const departmentId = await this.resolveDepartmentId(filters.departmentCode);

    const and: Prisma.CommandTaskWhereInput[] = [taskScopeWhere(actor, managed)];
    if (filters.status) and.push({ status: filters.status });
    if (filters.assigneeId) and.push({ assigneeId: filters.assigneeId });
    if (departmentId) and.push({ departmentId });
    if (filters.overdue) {
      and.push({ dueAt: { lt: new Date() }, status: { notIn: ['done', 'cancelled'] } });
    }

    const rows = await this.prisma.commandTask.findMany({
      where: { AND: and },
      orderBy: { updatedAt: 'desc' },
      take: page.limit,
      skip: page.offset,
    });
    await this.access.allow(actor, RESOURCE, 'read');
    return rows;
  }

  /** Shared write guard: role gate + by-ref scope, returning the loaded row. */
  private async loadWritable(actor: Actor, ref: string, action: string) {
    await this.access.assertRole(actor, 'task:write', RESOURCE, action, ref);
    const task = await this.prisma.commandTask.findUnique({ where: { ref } });
    if (!task) throw new NotFoundException(`task ${ref} not found`);
    const managed = await managedDepartmentIds(this.prisma, actor);
    if (!canSeeTask(actor, task, managed)) {
      await this.access.denyScope(actor, RESOURCE, action, ref);
    }
    return task;
  }

  async update(actor: Actor, ref: string, input: UpdateTaskInput) {
    await this.loadWritable(actor, ref, 'update');
    const data: Prisma.CommandTaskUpdateInput = {};
    if (input.status !== undefined) data.status = input.status;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.assigneeId !== undefined) data.assigneeId = input.assigneeId;
    if (input.dueAt !== undefined) data.dueAt = input.dueAt;
    if (input.status === 'done') data.completedAt = new Date();
    const updated = await this.prisma.commandTask.update({ where: { ref }, data });
    await this.access.allow(actor, RESOURCE, 'update', ref);
    return updated;
  }

  async complete(actor: Actor, ref: string) {
    await this.loadWritable(actor, ref, 'complete');
    const updated = await this.prisma.commandTask.update({
      where: { ref },
      data: { status: 'done', completedAt: new Date() },
    });
    await this.access.allow(actor, RESOURCE, 'complete', ref);
    return updated;
  }

  /** Soft-cancel: keeps the row (audit trail / subtask links), flips status to `cancelled`. */
  async cancel(actor: Actor, ref: string) {
    await this.loadWritable(actor, ref, 'cancel');
    const updated = await this.prisma.commandTask.update({
      where: { ref },
      data: { status: 'cancelled' },
    });
    await this.access.allow(actor, RESOURCE, 'cancel', ref);
    return updated;
  }

  /** Hard delete. Scope-guarded like every other write. */
  async delete(actor: Actor, ref: string) {
    await this.loadWritable(actor, ref, 'delete');
    await this.prisma.commandTask.delete({ where: { ref } });
    await this.access.allow(actor, RESOURCE, 'delete', ref);
    return { ref, deleted: true };
  }
}
