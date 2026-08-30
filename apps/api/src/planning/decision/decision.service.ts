import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Actor } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { PlanningAccessService } from '../planning-authz.service';
import { decisionRef, nextSequence, refPrefix } from '../planning-ids';

const RESOURCE = 'execDecision';

export interface RaiseDecisionInput {
  readonly question: string;
  readonly context?: string;
  readonly initiativeRef?: string;
}

export interface AnswerDecisionInput {
  readonly answer: string;
}

export interface DeferDecisionInput {
  readonly deferredTo: Date;
}

/**
 * Decisions waiting on the CEO.
 *
 * This table is the bottleneck metric. Nothing else in the system reports honestly on
 * whether the founder is the constraint — a dashboard of tasks shows the organisation
 * working; a queue of unanswered decisions shows where it is stopped, and by whom.
 *
 * Anyone internal may raise one. Only ceo/venture_manager may answer. A decision can be
 * deferred, but only TO A DATE — an open-ended "later" is what this model exists to
 * prevent, so `deferredTo` is required and a deferral without one is refused.
 */
@Injectable()
export class DecisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: PlanningAccessService,
  ) {}

  async raise(actor: Actor, input: RaiseDecisionInput) {
    await this.access.assertRole(actor, 'decision:create', RESOURCE, 'create');
    if (!input.question.trim()) throw new BadRequestException('a decision needs a question');
    if (!input.question.includes('?')) {
      throw new BadRequestException(
        'state it as a question — a decision the CEO cannot answer yes or no to is a discussion, not a decision',
      );
    }
    if (input.initiativeRef) {
      const init = await this.prisma.initiative.findUnique({ where: { ref: input.initiativeRef } });
      if (!init) throw new NotFoundException(`initiative ${input.initiativeRef} not found`);
    }

    const seq = await nextSequence(this.prisma.execDecision, refPrefix('DEC'));
    const ref = decisionRef(seq);
    const created = await this.prisma.execDecision.create({
      data: {
        ref,
        question: input.question.trim(),
        context: input.context?.trim() || null,
        initiativeRef: input.initiativeRef ?? null,
        raisedById: actor.userId,
        status: 'open',
      },
    });
    await this.access.allow(actor, RESOURCE, 'create', ref);
    return created;
  }

  /** The queue, oldest first — because age is the signal, not count. */
  async open(actor: Actor) {
    await this.access.assertRole(actor, 'decision:read', RESOURCE, 'list');
    const rows = await this.prisma.execDecision.findMany({
      where: { status: 'open' },
      orderBy: { raisedAt: 'asc' },
    });
    const now = Date.now();
    await this.access.allow(actor, RESOURCE, 'list');
    return rows.map((d) => ({
      ...d,
      ageDays: Math.floor((now - d.raisedAt.getTime()) / 86_400_000),
    }));
  }

  async answer(actor: Actor, ref: string, input: AnswerDecisionInput) {
    // `decision:answer` is executive-only. An initiative owner may raise a decision;
    // only the CEO or venture manager may close one.
    await this.access.assertRole(actor, 'decision:answer', RESOURCE, 'answer', ref);
    if (!input.answer.trim()) throw new BadRequestException('an answer cannot be empty');
    const existing = await this.prisma.execDecision.findUnique({ where: { ref } });
    if (!existing) throw new NotFoundException(`decision ${ref} not found`);
    if (existing.status === 'answered') {
      throw new BadRequestException(
        `decision ${ref} was already answered — raise a new one instead`,
      );
    }

    const updated = await this.prisma.execDecision.update({
      where: { ref },
      data: {
        status: 'answered',
        answer: input.answer.trim(),
        answeredById: actor.userId,
        answeredAt: new Date(),
      },
    });
    await this.access.allow(actor, RESOURCE, 'answer', ref);
    return updated;
  }

  async defer(actor: Actor, ref: string, input: DeferDecisionInput) {
    await this.access.assertRole(actor, 'decision:answer', RESOURCE, 'defer', ref);
    if (!input.deferredTo || Number.isNaN(input.deferredTo.getTime())) {
      throw new BadRequestException('a decision may be deferred, but only to a date');
    }
    if (input.deferredTo.getTime() <= Date.now()) {
      throw new BadRequestException('deferredTo must be in the future');
    }
    const existing = await this.prisma.execDecision.findUnique({ where: { ref } });
    if (!existing) throw new NotFoundException(`decision ${ref} not found`);

    const updated = await this.prisma.execDecision.update({
      where: { ref },
      data: { status: 'deferred', deferredTo: input.deferredTo },
    });
    await this.access.allow(actor, RESOURCE, 'defer', ref);
    return updated;
  }

  /**
   * The bottleneck metric itself: how many decisions are waiting, how long the oldest
   * has waited, and the mean age. If `oldestDays` climbs past a few days the founder
   * is the constraint — measurably, rather than as an impression.
   */
  async bottleneck(actor: Actor) {
    await this.access.assertRole(actor, 'decision:read', RESOURCE, 'metric');
    const open = await this.prisma.execDecision.findMany({
      where: { status: 'open' },
      select: { ref: true, question: true, raisedAt: true, raisedById: true },
      orderBy: { raisedAt: 'asc' },
    });
    const now = Date.now();
    const ages = open.map((d) => (now - d.raisedAt.getTime()) / 86_400_000);
    const deferredDue = await this.prisma.execDecision.count({
      where: { status: 'deferred', deferredTo: { lte: new Date() } },
    });
    await this.access.allow(actor, RESOURCE, 'metric');
    return {
      openCount: open.length,
      oldestDays: ages.length ? Math.floor(Math.max(...ages)) : 0,
      meanAgeDays: ages.length
        ? Math.round((ages.reduce((a, b) => a + b, 0) / ages.length) * 10) / 10
        : 0,
      deferredNowDue: deferredDue,
      oldest: open.slice(0, 5),
    };
  }
}
