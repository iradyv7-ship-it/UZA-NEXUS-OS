import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { AttentionState, InitiativeKind, InitiativeStatus } from '@prisma/client';
import type { Actor } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { PlanningAccessService } from '../planning-authz.service';
import { initiativeRef, weeklyReportRef, mondayOf, weekKey, nextSequence, refPrefix } from '../planning-ids';

const RESOURCE = 'initiative';

export interface CreateInitiativeInput {
  readonly name: string;
  readonly kind: InitiativeKind;
  readonly ownerId: string;
  readonly ventureCode?: string;
  readonly clientName?: string;
  readonly departmentCode?: string;
  readonly attention?: AttentionState;
  readonly nextAction?: string;
  readonly reviewAt?: Date;
  readonly artifactUrl?: string;
  readonly targetDate?: Date;
}

export interface UpdateInitiativeInput {
  readonly attention?: AttentionState;
  readonly status?: InitiativeStatus;
  readonly ownerId?: string;
  readonly nextAction?: string;
  readonly reviewAt?: Date | null;
  readonly artifactUrl?: string;
}

export interface CheckinInput {
  readonly initiativeRef: string;
  readonly moved: string;
  readonly blocked?: string;
  readonly needsFromCeo?: string;
  readonly weekOf?: Date;
}

/**
 * The register — what UZA is actually running, who owns it, and what happens next.
 *
 * Two rules are enforced here rather than merely documented, because a register that
 * tolerates exceptions stops being worth reading:
 *
 *  1. An initiative may not be set to `runs` without a `nextAction`. An initiative
 *     with no next action is a wish, and wishes are what fill up a register.
 *  2. An initiative set to `holds` must carry a `reviewAt`. Held is a deliberate
 *     pause with a date, not a synonym for forgotten.
 *
 * Object scope mirrors the Command Center: ceo/venture_manager see everything
 * (`initiative:all`); everyone else sees what they own.
 */
@Injectable()
export class InitiativeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: PlanningAccessService,
  ) {}

  private seesAll(actor: Actor): boolean {
    return actor.role === 'ceo' || actor.role === 'venture_manager';
  }

  private async resolveDepartmentId(code?: string): Promise<string | null> {
    if (!code) return null;
    const dept = await this.prisma.department.findUnique({
      where: { code: code.toUpperCase() },
      select: { id: true },
    });
    if (!dept) throw new NotFoundException(`department code ${code} not found`);
    return dept.id;
  }

  /** The two register invariants. Applied on create and on every update. */
  private assertRegisterRules(attention: AttentionState, nextAction: string | null, reviewAt: Date | null): void {
    if (attention === 'runs' && !nextAction?.trim()) {
      throw new BadRequestException(
        'an initiative cannot be set to runs without a nextAction — a running initiative with no next action is a wish',
      );
    }
    if (attention === 'holds' && !reviewAt) {
      throw new BadRequestException(
        'a held initiative requires a reviewAt date — held means paused on purpose, not forgotten',
      );
    }
  }

  async create(actor: Actor, input: CreateInitiativeInput) {
    await this.access.assertRole(actor, 'initiative:create', RESOURCE, 'create');
    if (!input.name.trim()) throw new BadRequestException('an initiative requires a name');

    const attention = input.attention ?? 'holds';
    const nextAction = input.nextAction?.trim() || null;
    const reviewAt = input.reviewAt ?? null;
    this.assertRegisterRules(attention, nextAction, reviewAt);

    const departmentId = await this.resolveDepartmentId(input.departmentCode);
    const seq = await nextSequence(this.prisma.initiative, refPrefix('INIT'));
    const ref = initiativeRef(seq);

    const created = await this.prisma.initiative.create({
      data: {
        ref,
        name: input.name.trim(),
        kind: input.kind,
        clientName: input.clientName ?? null,
        ownerId: input.ownerId,
        departmentId,
        attention,
        ventureCode: input.ventureCode ?? null,
        nextAction,
        reviewAt,
        artifactUrl: input.artifactUrl ?? null,
        targetDate: input.targetDate ?? null,
        startedAt: attention === 'runs' ? new Date() : null,
      },
    });
    await this.access.allow(actor, RESOURCE, 'create', ref);
    return created;
  }

  async byRef(actor: Actor, ref: string) {
    await this.access.assertRole(actor, 'initiative:read', RESOURCE, 'read', ref);
    const found = await this.prisma.initiative.findUnique({ where: { ref } });
    if (!found) throw new NotFoundException(`initiative ${ref} not found`);
    if (!this.seesAll(actor) && found.ownerId !== actor.userId) {
      return this.access.denyScope(actor, RESOURCE, 'read', ref);
    }
    await this.access.allow(actor, RESOURCE, 'read', ref);
    return found;
  }

  async list(actor: Actor, filters: { attention?: AttentionState; ventureCode?: string; ownerId?: string } = {}) {
    await this.access.assertRole(actor, 'initiative:read', RESOURCE, 'list');
    const where: Record<string, unknown> = {};
    if (filters.attention) where.attention = filters.attention;
    if (filters.ventureCode) where.ventureCode = filters.ventureCode;
    if (filters.ownerId) where.ownerId = filters.ownerId;
    // Object scope: anyone without `initiative:all` sees only what they own.
    if (!this.seesAll(actor)) where.ownerId = actor.userId;

    const rows = await this.prisma.initiative.findMany({
      where,
      orderBy: [{ attention: 'asc' }, { reviewAt: 'asc' }, { ref: 'asc' }],
    });
    await this.access.allow(actor, RESOURCE, 'list');
    return rows;
  }

  async update(actor: Actor, ref: string, input: UpdateInitiativeInput) {
    await this.access.assertRole(actor, 'initiative:write', RESOURCE, 'update', ref);
    const existing = await this.prisma.initiative.findUnique({ where: { ref } });
    if (!existing) throw new NotFoundException(`initiative ${ref} not found`);
    if (!this.seesAll(actor) && existing.ownerId !== actor.userId) {
      return this.access.denyScope(actor, RESOURCE, 'update', ref);
    }

    const attention = input.attention ?? existing.attention;
    const nextAction =
      input.nextAction !== undefined ? input.nextAction.trim() || null : existing.nextAction;
    const reviewAt = input.reviewAt !== undefined ? input.reviewAt : existing.reviewAt;
    this.assertRegisterRules(attention, nextAction, reviewAt);

    const updated = await this.prisma.initiative.update({
      where: { ref },
      data: {
        attention,
        nextAction,
        reviewAt,
        ...(input.status ? { status: input.status } : {}),
        ...(input.ownerId ? { ownerId: input.ownerId } : {}),
        ...(input.artifactUrl !== undefined ? { artifactUrl: input.artifactUrl } : {}),
        ...(attention === 'runs' && !existing.startedAt ? { startedAt: new Date() } : {}),
        ...(input.status === 'done' || input.status === 'cancelled' ? { closedAt: new Date() } : {}),
      },
    });
    await this.access.allow(actor, RESOURCE, 'update', ref);
    return updated;
  }

  /**
   * A weekly check-in, written BY THE OWNER. Stored against the week Monday so two
   * filings in one week collide rather than both landing.
   *
   * The Planning schema hangs WeeklyReport off a week `Plan`; the register needs a
   * check-in per initiative without forcing a plan to exist first, so this writes the
   * lighter `InitiativeCheckin` row. Both are readable by the review.
   */
  async checkin(actor: Actor, input: CheckinInput) {
    await this.access.assertRole(actor, 'report:create', 'initiativeCheckin', 'create', input.initiativeRef);
    const initiative = await this.prisma.initiative.findUnique({ where: { ref: input.initiativeRef } });
    if (!initiative) throw new NotFoundException(`initiative ${input.initiativeRef} not found`);
    if (!this.seesAll(actor) && initiative.ownerId !== actor.userId) {
      return this.access.denyScope(actor, 'initiativeCheckin', 'create', input.initiativeRef);
    }
    if (!input.moved.trim()) throw new BadRequestException('a check-in must say what moved');

    const weekOf = mondayOf(input.weekOf ?? new Date());
    const seq = await nextSequence(this.prisma.initiativeCheckin, refPrefix('CHK'));
    const ref = weeklyReportRef(seq).replace('WRPT', 'CHK');

    const created = await this.prisma.initiativeCheckin.upsert({
      where: { initiativeRef_weekOf: { initiativeRef: input.initiativeRef, weekOf } },
      create: {
        ref,
        initiativeRef: input.initiativeRef,
        ownerId: actor.userId,
        weekOf,
        moved: input.moved.trim(),
        blocked: input.blocked?.trim() || null,
        needsFromCeo: input.needsFromCeo?.trim() || null,
      },
      update: {
        moved: input.moved.trim(),
        blocked: input.blocked?.trim() || null,
        needsFromCeo: input.needsFromCeo?.trim() || null,
      },
    });
    await this.access.allow(actor, 'initiativeCheckin', 'create', created.ref);
    return { ...created, weekKey: weekKey(weekOf) };
  }

  /** Which running initiatives have NOT filed a check-in this week. The absence is the finding. */
  async missingCheckins(actor: Actor) {
    await this.access.assertRole(actor, 'report:all', 'initiativeCheckin', 'list');
    const weekOf = mondayOf(new Date());
    const running = await this.prisma.initiative.findMany({
      where: { attention: 'runs', status: 'active' },
      select: { ref: true, name: true, ownerId: true },
    });
    const filed = await this.prisma.initiativeCheckin.findMany({
      where: { weekOf },
      select: { initiativeRef: true },
    });
    const filedSet = new Set(filed.map((f) => f.initiativeRef));
    await this.access.allow(actor, 'initiativeCheckin', 'list');
    return {
      weekOf,
      weekKey: weekKey(weekOf),
      missing: running.filter((r) => !filedSet.has(r.ref)),
    };
  }
}
