import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { SystemKind, SystemStatus, SystemVisibility } from '@prisma/client';
import type { Actor } from '@uza/contracts';
import { nextSequence, refPrefix } from '../planning-ids';
import { PrismaService } from '../../prisma/prisma.service';
import { PlanningAccessService } from '../planning-authz.service';

const RESOURCE = 'systemRecord';

export interface CreateSystemInput {
  readonly name: string;
  readonly kind: SystemKind;
  readonly ownerId: string;
  readonly ventureCode?: string;
  readonly status?: SystemStatus;
  readonly repoUrl?: string;
  readonly liveUrl?: string;
  readonly visibility?: SystemVisibility;
  readonly lastPushAt?: Date;
  readonly supersededBy?: string;
  readonly initiativeRef?: string;
  readonly notes?: string;
}

/** A system is stale when nothing has been pushed to it for this long. */
const DORMANT_DAYS = 60;

/**
 * The estate — every system UZA owns.
 *
 * The register answers "what are we doing". This answers "what do we have", which had no
 * answer anywhere: seventeen repositories across two GitHub accounts, three of them
 * duplicated, and which copy was canonical lived in one person's memory.
 *
 * Three findings this table exists to produce, none of which is a list:
 *
 *  - **Duplicates.** The same system in two places, where one is being edited and the
 *    other is quietly diverging. Somebody eventually reads the wrong one.
 *  - **Public source.** Repository visibility is almost always a default rather than a
 *    decision. Recording it makes it a decision.
 *  - **Silence.** Last push is the one field nobody can talk up in a meeting.
 */
@Injectable()
export class EstateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: PlanningAccessService,
  ) {}

  async create(actor: Actor, input: CreateSystemInput) {
    await this.access.assertRole(actor, 'initiative:create', RESOURCE, 'create');
    if (!input.name.trim()) throw new BadRequestException('a system needs a name');

    const seq = await nextSequence(this.prisma.systemRecord, refPrefix('SYS'));
    const ref = `SYS-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`;
    const created = await this.prisma.systemRecord.create({
      data: {
        ref,
        name: input.name.trim(),
        kind: input.kind,
        ownerId: input.ownerId,
        ventureCode: input.ventureCode ?? null,
        status: input.status ?? 'building',
        repoUrl: input.repoUrl ?? null,
        liveUrl: input.liveUrl ?? null,
        visibility: input.visibility ?? 'unknown',
        lastPushAt: input.lastPushAt ?? null,
        supersededBy: input.supersededBy ?? null,
        initiativeRef: input.initiativeRef ?? null,
        notes: input.notes ?? null,
      },
    });
    await this.access.allow(actor, RESOURCE, 'create', ref);
    return created;
  }

  async list(actor: Actor, filters: { ventureCode?: string; status?: SystemStatus } = {}) {
    await this.access.assertRole(actor, 'initiative:read', RESOURCE, 'list');
    const rows = await this.prisma.systemRecord.findMany({
      where: {
        ...(filters.ventureCode ? { ventureCode: filters.ventureCode } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: [{ ventureCode: 'asc' }, { status: 'asc' }, { name: 'asc' }],
    });
    const now = Date.now();
    await this.access.allow(actor, RESOURCE, 'list');
    return rows.map((s) => ({
      ...s,
      daysSincePush: s.lastPushAt ? Math.floor((now - s.lastPushAt.getTime()) / 86_400_000) : null,
    }));
  }

  async update(actor: Actor, ref: string, input: Partial<CreateSystemInput>) {
    await this.access.assertRole(actor, 'initiative:write', RESOURCE, 'update', ref);
    const existing = await this.prisma.systemRecord.findUnique({ where: { ref } });
    if (!existing) throw new NotFoundException(`system ${ref} not found`);
    const updated = await this.prisma.systemRecord.update({
      where: { ref },
      data: {
        ...(input.name ? { name: input.name.trim() } : {}),
        ...(input.kind ? { kind: input.kind } : {}),
        ...(input.ownerId ? { ownerId: input.ownerId } : {}),
        ...(input.ventureCode !== undefined ? { ventureCode: input.ventureCode } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.repoUrl !== undefined ? { repoUrl: input.repoUrl } : {}),
        ...(input.liveUrl !== undefined ? { liveUrl: input.liveUrl } : {}),
        ...(input.visibility ? { visibility: input.visibility } : {}),
        ...(input.lastPushAt !== undefined ? { lastPushAt: input.lastPushAt } : {}),
        ...(input.supersededBy !== undefined ? { supersededBy: input.supersededBy } : {}),
        ...(input.initiativeRef !== undefined ? { initiativeRef: input.initiativeRef } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });
    await this.access.allow(actor, RESOURCE, 'update', ref);
    return updated;
  }

  /** The three findings, derived. Nothing here is typed in by hand. */
  async health(actor: Actor) {
    await this.access.assertRole(actor, 'initiative:read', RESOURCE, 'health');
    const all = await this.prisma.systemRecord.findMany({
      where: { status: { not: 'retired' } },
      orderBy: { name: 'asc' },
    });
    const now = Date.now();
    const age = (d: Date | null) => (d ? Math.floor((now - d.getTime()) / 86_400_000) : null);

    const byVenture: Record<string, number> = {};
    for (const s of all) byVenture[s.ventureCode ?? 'unassigned'] = (byVenture[s.ventureCode ?? 'unassigned'] ?? 0) + 1;

    await this.access.allow(actor, RESOURCE, 'health');
    return {
      total: all.length,
      byVenture,
      byStatus: {
        live: all.filter((s) => s.status === 'live').length,
        building: all.filter((s) => s.status === 'building').length,
        prototype: all.filter((s) => s.status === 'prototype').length,
        dormant: all.filter((s) => s.status === 'dormant').length,
      },
      /** Source anyone can read. Almost never an intentional choice. */
      publicSource: all
        .filter((s) => s.visibility === 'public')
        .map((s) => ({ ref: s.ref, name: s.name, repoUrl: s.repoUrl, ventureCode: s.ventureCode })),
      /** The same thing in two places. One of them is diverging. */
      duplicates: all
        .filter((s) => s.supersededBy)
        .map((s) => ({ ref: s.ref, name: s.name, supersededBy: s.supersededBy, repoUrl: s.repoUrl })),
      /** Nothing pushed in two months, and still not marked dormant or retired. */
      silent: all
        .filter((s) => {
          const d = age(s.lastPushAt);
          return d !== null && d > DORMANT_DAYS && s.status !== 'dormant';
        })
        .map((s) => ({ ref: s.ref, name: s.name, ownerId: s.ownerId, daysSincePush: age(s.lastPushAt) })),
      /** A system with no venture is a system nobody has decided the purpose of. */
      unassigned: all.filter((s) => !s.ventureCode).map((s) => ({ ref: s.ref, name: s.name })),
    };
  }
}
