import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { FundingInstrument, FundingStage } from '@prisma/client';
import type { Actor } from '@uza/contracts';
import { nextSequence, refPrefix } from '../planning-ids';
import { PrismaService } from '../../prisma/prisma.service';
import { PlanningAccessService } from '../planning-authz.service';

const RESOURCE = 'fundingTrack';

/** Stages where the money is still genuinely in play. */
const LIVE: FundingStage[] = [
  'identified',
  'qualifying',
  'preparing',
  'submitted',
  'in_diligence',
  'approved',
];

export interface CreateFundingInput {
  readonly name: string;
  readonly instrument: FundingInstrument;
  readonly funder: string;
  readonly amountSought: number;
  readonly currency?: string;
  readonly ventureCode?: string;
  readonly ownerId: string;
  readonly stage?: FundingStage;
  readonly unlocks?: readonly string[];
  readonly evidence?: string;
  readonly blocker?: string;
  readonly decisionBy?: Date;
  readonly grantRef?: string;
}

/**
 * What is being raised, and what it releases.
 *
 * The founder's strategy, stated on 22 August: each venture must stand alone to a funder,
 * and whichever closes first pushes the others forward. Two things follow, and the second
 * is the one nobody usually builds.
 *
 *  1. **Each track is independently presentable.** `byVenture` produces a view of one
 *     venture's funding with no other venture in it. A funder should be able to see the
 *     whole of what they are funding and none of what they are not.
 *
 *  2. **The push is written down before the money arrives.** `unlocks` records which
 *     initiatives a track releases, at the time the track is created. Afterwards everybody
 *     has an opinion about where the money should go, and the strategy quietly becomes
 *     whatever was loudest that week.
 */
@Injectable()
export class FundingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: PlanningAccessService,
  ) {}

  async create(actor: Actor, input: CreateFundingInput) {
    await this.access.assertRole(actor, 'initiative:create', RESOURCE, 'create');
    if (!input.name.trim()) throw new BadRequestException('a funding track needs a name');
    if (!input.funder.trim())
      throw new BadRequestException('name the counterparty — "investors" is not a funder');
    if (!(input.amountSought > 0))
      throw new BadRequestException('amountSought must be greater than zero');

    const seq = await nextSequence(this.prisma.fundingTrack, refPrefix('FUND'));
    const ref = `FUND-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`;
    const created = await this.prisma.fundingTrack.create({
      data: {
        ref,
        name: input.name.trim(),
        instrument: input.instrument,
        funder: input.funder.trim(),
        amountSought: input.amountSought,
        currency: input.currency ?? 'RWF',
        ventureCode: input.ventureCode ?? null,
        ownerId: input.ownerId,
        stage: input.stage ?? 'identified',
        unlocks: [...(input.unlocks ?? [])],
        evidence: input.evidence ?? null,
        blocker: input.blocker ?? null,
        decisionBy: input.decisionBy ?? null,
        grantRef: input.grantRef ?? null,
      },
    });
    await this.access.allow(actor, RESOURCE, 'create', ref);
    return created;
  }

  async list(actor: Actor, filters: { ventureCode?: string; stage?: FundingStage } = {}) {
    await this.access.assertRole(actor, 'initiative:read', RESOURCE, 'list');
    const rows = await this.prisma.fundingTrack.findMany({
      where: {
        ...(filters.ventureCode ? { ventureCode: filters.ventureCode } : {}),
        ...(filters.stage ? { stage: filters.stage } : {}),
      },
      orderBy: [{ stage: 'asc' }, { amountSought: 'desc' }],
    });
    await this.access.allow(actor, RESOURCE, 'list');
    return rows;
  }

  async update(
    actor: Actor,
    ref: string,
    input: Partial<CreateFundingInput> & { closedAt?: Date },
  ) {
    await this.access.assertRole(actor, 'initiative:write', RESOURCE, 'update', ref);
    const existing = await this.prisma.fundingTrack.findUnique({ where: { ref } });
    if (!existing) throw new NotFoundException(`funding track ${ref} not found`);
    if (input.stage === 'closed' && !existing.closedAt && !input.closedAt)
      input = { ...input, closedAt: new Date() };

    const updated = await this.prisma.fundingTrack.update({
      where: { ref },
      data: {
        ...(input.name ? { name: input.name.trim() } : {}),
        ...(input.stage ? { stage: input.stage } : {}),
        ...(input.amountSought ? { amountSought: input.amountSought } : {}),
        ...(input.ownerId ? { ownerId: input.ownerId } : {}),
        ...(input.unlocks ? { unlocks: [...input.unlocks] } : {}),
        ...(input.evidence !== undefined ? { evidence: input.evidence } : {}),
        ...(input.blocker !== undefined ? { blocker: input.blocker } : {}),
        ...(input.decisionBy !== undefined ? { decisionBy: input.decisionBy } : {}),
        ...(input.closedAt !== undefined ? { closedAt: input.closedAt } : {}),
      },
    });
    await this.access.allow(actor, RESOURCE, 'update', ref);
    return updated;
  }

  /**
   * One venture, presentable on its own.
   *
   * Deliberately returns nothing from any other venture. This is what gets shown to a
   * funder who is being asked to back charging and has no business seeing the vehicle
   * supply pipeline — the independence the founder asked for, enforced by the query rather
   * than by remembering to scroll past.
   */
  async byVenture(actor: Actor, ventureCode: string) {
    await this.access.assertRole(actor, 'initiative:read', RESOURCE, 'venture', ventureCode);
    const [tracks, initiatives, systems] = await Promise.all([
      this.prisma.fundingTrack.findMany({
        where: { ventureCode },
        orderBy: { amountSought: 'desc' },
      }),
      this.prisma.initiative.findMany({
        where: { ventureCode, status: 'active' },
        orderBy: [{ attention: 'asc' }, { ref: 'asc' }],
      }),
      this.prisma.systemRecord.findMany({ where: { ventureCode, status: { not: 'retired' } } }),
    ]);
    const live = tracks.filter((t) => LIVE.includes(t.stage));
    await this.access.allow(actor, RESOURCE, 'venture', ventureCode);
    return {
      ventureCode,
      sought: live.reduce((a, t) => a + t.amountSought, 0),
      closed: tracks.filter((t) => t.stage === 'closed').reduce((a, t) => a + t.amountSought, 0),
      tracks,
      running: initiatives.filter((i) => i.attention === 'runs').length,
      held: initiatives.filter((i) => i.attention === 'holds').length,
      initiatives,
      systems: systems.length,
    };
  }

  /**
   * The cross-push map — the part of the strategy that is usually only in someone's head.
   *
   * For every live track, which initiatives it releases and whether those are currently
   * held. A track that unlocks nothing held is worth asking about: either the money is not
   * actually needed for anything, or the dependency was never recorded.
   */
  async unlockMap(actor: Actor) {
    await this.access.assertRole(actor, 'review', RESOURCE, 'unlocks');
    const tracks = await this.prisma.fundingTrack.findMany({
      where: { stage: { in: LIVE } },
      orderBy: [{ stage: 'asc' }, { amountSought: 'desc' }],
    });
    const refs = [...new Set(tracks.flatMap((t) => t.unlocks))];
    const inits = await this.prisma.initiative.findMany({
      where: { ref: { in: refs } },
      select: { ref: true, name: true, attention: true, ventureCode: true, ownerId: true },
    });
    const byRef = new Map(inits.map((i) => [i.ref, i]));

    const rows = tracks.map((t) => {
      const releases = t.unlocks.map((r) => byRef.get(r)).filter(Boolean) as typeof inits;
      return {
        ref: t.ref,
        name: t.name,
        funder: t.funder,
        instrument: t.instrument,
        stage: t.stage,
        ventureCode: t.ventureCode,
        amountSought: t.amountSought,
        currency: t.currency,
        blocker: t.blocker,
        decisionBy: t.decisionBy,
        releases,
        heldReleases: releases.filter((i) => i.attention === 'holds').length,
        /** Named refs that are not in the register. Recorded intent with nowhere to land. */
        danglingRefs: t.unlocks.filter((r) => !byRef.has(r)),
      };
    });

    await this.access.allow(actor, RESOURCE, 'unlocks');
    return {
      totalSought: tracks.reduce((a, t) => a + t.amountSought, 0),
      liveTracks: tracks.length,
      /** Tracks that release nothing currently held — the dependency was never written down. */
      unlocksNothing: rows
        .filter((r) => r.heldReleases === 0)
        .map((r) => ({ ref: r.ref, name: r.name })),
      tracks: rows,
    };
  }
}
