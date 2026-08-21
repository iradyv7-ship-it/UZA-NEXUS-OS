import { Injectable } from '@nestjs/common';
import type { Actor } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { PlanningAccessService } from '../planning-authz.service';
import { mondayOf, weekKey } from '../planning-ids';

const RESOURCE = 'review';

/**
 * The Monday review — one read that answers the only four questions worth asking:
 *
 *   1. What is running, and did it move last week?
 *   2. What is held, and is its review date now past?
 *   3. What is waiting on me?
 *   4. What did nobody file?
 *
 * Everything here is derived. Nothing is typed in twice. The value is that the silences
 * are visible: an initiative that filed no check-in appears in `silent`, and a held
 * initiative whose reviewAt has passed appears in `overdueReviews`. A dashboard that only
 * shows what people wrote flatters the organisation; this one shows what they didn't.
 */
@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: PlanningAccessService,
  ) {}

  async weekly(actor: Actor, forWeek?: Date) {
    await this.access.assertRole(actor, 'review', RESOURCE, 'read');
    const weekOf = mondayOf(forWeek ?? new Date());
    const now = new Date();

    const [initiatives, checkins, openDecisions, dueDeferrals, overdueTasks] = await Promise.all([
      this.prisma.initiative.findMany({
        where: { status: 'active' },
        orderBy: [{ attention: 'asc' }, { reviewAt: 'asc' }],
      }),
      this.prisma.initiativeCheckin.findMany({ where: { weekOf } }),
      this.prisma.execDecision.findMany({
        where: { status: 'open' },
        orderBy: { raisedAt: 'asc' },
      }),
      this.prisma.execDecision.findMany({
        where: { status: 'deferred', deferredTo: { lte: now } },
        orderBy: { deferredTo: 'asc' },
      }),
      this.prisma.commandTask.findMany({
        where: { status: { notIn: ['done', 'cancelled'] }, dueAt: { lt: now } },
        orderBy: { dueAt: 'asc' },
        take: 25,
      }),
    ]);

    const filed = new Map(checkins.map((c) => [c.initiativeRef, c]));
    const runs = initiatives.filter((i) => i.attention === 'runs');
    const holds = initiatives.filter((i) => i.attention === 'holds');

    const moved = runs
      .filter((i) => filed.has(i.ref))
      .map((i) => ({
        ref: i.ref,
        name: i.name,
        ventureCode: i.ventureCode,
        ownerId: i.ownerId,
        moved: filed.get(i.ref)!.moved,
        blocked: filed.get(i.ref)!.blocked,
        needsFromCeo: filed.get(i.ref)!.needsFromCeo,
      }));

    // The finding is the absence. A running initiative with no check-in is either not
    // running or has no owner in practice; either way the register is wrong.
    const silent = runs
      .filter((i) => !filed.has(i.ref))
      .map((i) => ({ ref: i.ref, name: i.name, ventureCode: i.ventureCode, ownerId: i.ownerId }));

    const overdueReviews = holds
      .filter((i) => i.reviewAt && i.reviewAt <= now)
      .map((i) => ({
        ref: i.ref,
        name: i.name,
        ventureCode: i.ventureCode,
        ownerId: i.ownerId,
        reviewAt: i.reviewAt,
        daysLate: Math.floor((now.getTime() - i.reviewAt!.getTime()) / 86_400_000),
      }));

    const escalations = moved.filter((m) => m.needsFromCeo).map((m) => ({
      initiativeRef: m.ref,
      name: m.name,
      needsFromCeo: m.needsFromCeo,
    }));

    const decisionAges = openDecisions.map((d) => (now.getTime() - d.raisedAt.getTime()) / 86_400_000);

    await this.access.allow(actor, RESOURCE, 'read');
    return {
      weekOf,
      weekKey: weekKey(weekOf),
      counts: {
        runs: runs.length,
        holds: holds.length,
        parked: initiatives.filter((i) => i.attention === 'parked').length,
        filed: moved.length,
        silent: silent.length,
        openDecisions: openDecisions.length,
        overdueTasks: overdueTasks.length,
      },
      /** The one number that says whether the founder is the constraint. */
      bottleneckDays: decisionAges.length ? Math.floor(Math.max(...decisionAges)) : 0,
      moved,
      silent,
      overdueReviews,
      escalations,
      decisions: openDecisions.map((d) => ({
        ref: d.ref,
        question: d.question,
        initiativeRef: d.initiativeRef,
        raisedById: d.raisedById,
        ageDays: Math.floor((now.getTime() - d.raisedAt.getTime()) / 86_400_000),
      })),
      deferralsNowDue: dueDeferrals.map((d) => ({ ref: d.ref, question: d.question, deferredTo: d.deferredTo })),
      overdueTasks: overdueTasks.map((t) => ({ ref: t.ref, title: t.title, assigneeId: t.assigneeId, dueAt: t.dueAt })),
    };
  }

  /**
   * The same picture, flattened to text. This is what the advisor is given as context and
   * what a weekly email would carry — one function so the two can never drift apart.
   */
  async brief(actor: Actor, forWeek?: Date): Promise<string> {
    const r = await this.weekly(actor, forWeek);
    const lines: string[] = [];
    lines.push(`UZA register — week of ${r.weekKey}`);
    lines.push(
      `${r.counts.runs} running, ${r.counts.holds} held, ${r.counts.parked} parked. ` +
        `${r.counts.filed} filed a check-in, ${r.counts.silent} did not. ` +
        `${r.counts.openDecisions} decisions waiting on the CEO (oldest ${r.bottleneckDays} days).`,
    );

    if (r.moved.length) {
      lines.push('', 'MOVED');
      for (const m of r.moved) {
        lines.push(`- [${m.ref}] ${m.name} (${m.ventureCode ?? 'unassigned'}, owner ${m.ownerId}): ${m.moved}`);
        if (m.blocked) lines.push(`  blocked: ${m.blocked}`);
      }
    }
    if (r.silent.length) {
      lines.push('', 'NO CHECK-IN FILED (running, but silent this week)');
      for (const s of r.silent) lines.push(`- [${s.ref}] ${s.name} (owner ${s.ownerId})`);
    }
    if (r.overdueReviews.length) {
      lines.push('', 'HELD PAST THEIR REVIEW DATE');
      for (const h of r.overdueReviews) lines.push(`- [${h.ref}] ${h.name} — ${h.daysLate} days late`);
    }
    if (r.decisions.length) {
      lines.push('', 'WAITING ON THE CEO');
      for (const d of r.decisions) {
        lines.push(`- [${d.ref}] ${d.question} (${d.ageDays}d${d.initiativeRef ? `, ${d.initiativeRef}` : ''})`);
      }
    }
    if (r.deferralsNowDue.length) {
      lines.push('', 'DEFERRED DECISIONS NOW DUE');
      for (const d of r.deferralsNowDue) lines.push(`- [${d.ref}] ${d.question}`);
    }
    if (r.escalations.length) {
      lines.push('', 'ASKED OF THE CEO IN CHECK-INS');
      for (const e of r.escalations) lines.push(`- [${e.initiativeRef}] ${e.name}: ${e.needsFromCeo}`);
    }
    if (r.overdueTasks.length) {
      lines.push('', 'OVERDUE TASKS');
      for (const t of r.overdueTasks) lines.push(`- [${t.ref}] ${t.title} (${t.assigneeId})`);
    }
    return lines.join('\n');
  }
}
