import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { ResponsibilityKind, ResponsibilityTrigger } from '@prisma/client';
import type { Actor } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { PlanningAccessService } from '../planning-authz.service';

const RESOURCE = 'responsibility';

export interface CreateResponsibilityInput {
  readonly name: string;
  readonly kind: ResponsibilityKind;
  readonly ownerId: string;
  readonly backupId?: string;
  readonly ventureCode?: string;
  readonly trigger?: ResponsibilityTrigger;
  readonly responseHours?: number;
  readonly notes?: string;
  readonly startsOn?: Date;
}

/**
 * Who does what, continuously.
 *
 * The register answers "what are we doing"; this answers "who is on the hook when it
 * happens again tomorrow". They are different questions and conflating them is how a
 * company ends up with a full task list and no one accountable for the thing that keeps
 * going wrong.
 *
 * Two rules are enforced rather than documented, for the same reason as the register's:
 *
 *  1. An `approval` must carry a `responseHours`. An approval with no agreed response
 *     time is not a control, it is a queue — and a queue in front of one person is the
 *     precise mechanism by which every project at UZA ended up "awaiting decision".
 *  2. An `approval` or a `gate` must have a `backupId` different from the owner. These
 *     are the duties that block other people's work; leaving one with a single name
 *     against it means the whole line stops the week that person is unreachable.
 *
 * `standing` duties are exempt from both. Not everything needs a clock, and pretending
 * otherwise produces numbers nobody believes.
 */
@Injectable()
export class ResponsibilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: PlanningAccessService,
  ) {}

  private assertRules(input: {
    kind: ResponsibilityKind;
    ownerId: string;
    backupId?: string | null;
    responseHours?: number | null;
  }): void {
    if (input.kind === 'approval' && !input.responseHours) {
      throw new BadRequestException(
        'an approval needs a responseHours — an approval with no agreed response time is not a control, it is a queue',
      );
    }
    if (input.responseHours !== undefined && input.responseHours !== null && input.responseHours < 1) {
      throw new BadRequestException('responseHours must be at least 1');
    }
    if (input.kind !== 'standing') {
      if (!input.backupId) {
        throw new BadRequestException(
          `a ${input.kind} needs a backupId — it blocks other people's work, so one name against it is a single point of failure`,
        );
      }
      if (input.backupId === input.ownerId) {
        throw new BadRequestException('the backup cannot be the owner');
      }
    }
  }

  async create(actor: Actor, input: CreateResponsibilityInput) {
    await this.access.assertRole(actor, 'initiative:create', RESOURCE, 'create');
    if (!input.name.trim()) throw new BadRequestException('a responsibility needs a name');
    this.assertRules(input);

    const seq = (await this.prisma.responsibility.count()) + 1;
    const ref = `RESP-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`;
    const created = await this.prisma.responsibility.create({
      data: {
        ref,
        name: input.name.trim(),
        kind: input.kind,
        ownerId: input.ownerId,
        backupId: input.backupId ?? null,
        ventureCode: input.ventureCode ?? null,
        trigger: input.trigger ?? 'ad_hoc',
        responseHours: input.responseHours ?? null,
        notes: input.notes ?? null,
        startsOn: input.startsOn ?? null,
      },
    });
    await this.access.allow(actor, RESOURCE, 'create', ref);
    return created;
  }

  /** Everything one person is on the hook for, as owner and as backup. */
  async forPerson(actor: Actor, userRef: string) {
    await this.access.assertRole(actor, 'initiative:read', RESOURCE, 'read', userRef);
    const [owns, covers] = await Promise.all([
      this.prisma.responsibility.findMany({
        where: { ownerId: userRef, active: true },
        orderBy: [{ kind: 'asc' }, { ref: 'asc' }],
      }),
      this.prisma.responsibility.findMany({
        where: { backupId: userRef, active: true },
        orderBy: { ref: 'asc' },
      }),
    ]);
    await this.access.allow(actor, RESOURCE, 'read', userRef);
    return { userRef, owns, covers, load: owns.length };
  }

  async list(actor: Actor, filters: { ventureCode?: string; kind?: ResponsibilityKind } = {}) {
    await this.access.assertRole(actor, 'initiative:read', RESOURCE, 'list');
    const rows = await this.prisma.responsibility.findMany({
      where: { active: true, ...(filters.ventureCode ? { ventureCode: filters.ventureCode } : {}), ...(filters.kind ? { kind: filters.kind } : {}) },
      orderBy: [{ ventureCode: 'asc' }, { kind: 'asc' }, { ref: 'asc' }],
    });
    await this.access.allow(actor, RESOURCE, 'list');
    return rows;
  }

  async update(actor: Actor, ref: string, input: Partial<CreateResponsibilityInput> & { active?: boolean }) {
    await this.access.assertRole(actor, 'initiative:write', RESOURCE, 'update', ref);
    const existing = await this.prisma.responsibility.findUnique({ where: { ref } });
    if (!existing) throw new NotFoundException(`responsibility ${ref} not found`);

    const merged = {
      kind: input.kind ?? existing.kind,
      ownerId: input.ownerId ?? existing.ownerId,
      backupId: input.backupId !== undefined ? input.backupId : existing.backupId,
      responseHours: input.responseHours !== undefined ? input.responseHours : existing.responseHours,
    };
    this.assertRules(merged);

    const updated = await this.prisma.responsibility.update({
      where: { ref },
      data: {
        ...merged,
        ...(input.name ? { name: input.name.trim() } : {}),
        ...(input.ventureCode !== undefined ? { ventureCode: input.ventureCode } : {}),
        ...(input.trigger ? { trigger: input.trigger } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.startsOn !== undefined ? { startsOn: input.startsOn } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
    });
    await this.access.allow(actor, RESOURCE, 'update', ref);
    return updated;
  }

  /**
   * Where the organisation breaks.
   *
   * Three findings, all of them absences: duties with no backup, approvals concentrated on
   * one person, and duties that have not started yet. The middle one is the number that
   * matters — if a single person holds most of the approvals, no amount of task assignment
   * will make the company faster, because the queue is in front of them.
   */
  async concentration(actor: Actor) {
    await this.access.assertRole(actor, 'review', RESOURCE, 'concentration');
    const all = await this.prisma.responsibility.findMany({ where: { active: true } });

    const byOwner = new Map<string, { owns: number; approvals: number; gates: number; noBackup: number }>();
    for (const r of all) {
      const e = byOwner.get(r.ownerId) ?? { owns: 0, approvals: 0, gates: 0, noBackup: 0 };
      e.owns += 1;
      if (r.kind === 'approval') e.approvals += 1;
      if (r.kind === 'gate') e.gates += 1;
      if (!r.backupId) e.noBackup += 1;
      byOwner.set(r.ownerId, e);
    }

    const approvals = all.filter((r) => r.kind === 'approval');
    const load = [...byOwner.entries()]
      .map(([userRef, e]) => ({ userRef, ...e }))
      .sort((a, b) => b.owns - a.owns);
    const topApprover = load.slice().sort((a, b) => b.approvals - a.approvals)[0];

    await this.access.allow(actor, RESOURCE, 'concentration');
    return {
      total: all.length,
      load,
      /**
       * Only gates and approvals. A standing duty with no backup is normal and expected —
       * the rules exempt it — so counting those here would put 17 amber items on the
       * dashboard on day one and teach everyone to ignore the number. What belongs here
       * is the duty that BLOCKS someone else's work and has one name against it.
       */
      noBackup: all
        .filter((r) => r.kind !== 'standing' && !r.backupId)
        .map((r) => ({ ref: r.ref, name: r.name, ownerId: r.ownerId, kind: r.kind })),
      /** Standing duties without cover. Worth knowing, not worth alarming about. */
      standingNoBackup: all.filter((r) => r.kind === 'standing' && !r.backupId).length,
      notYetStarted: all
        .filter((r) => r.startsOn && r.startsOn > new Date())
        .map((r) => ({ ref: r.ref, name: r.name, ownerId: r.ownerId, startsOn: r.startsOn })),
      /** 0 to 1. Above ~0.5 the company has one bottleneck, not a team. */
      approvalConcentration:
        approvals.length && topApprover
          ? Math.round((topApprover.approvals / approvals.length) * 100) / 100
          : 0,
      topApprover: topApprover?.userRef ?? null,
    };
  }
}
