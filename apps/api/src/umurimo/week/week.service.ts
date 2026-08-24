import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Actor } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { UmurimoAccessService } from '../umurimo-authz.service';
import { WorkspaceService } from '../workspace/workspace.service';
import { seesAllWeeks } from '../umurimo-access';
import { blockerRef } from '../umurimo-ids';
import { mondayOf, weekKey, planRef, weeklyReportRef } from '../../planning/planning-ids';

const RESOURCE = 'week';

/** One line of a person's weekly plan. Stored in `Plan.objectives` as JSON. */
export interface Objective {
  text: string;
  status: 'todo' | 'done' | 'dropped';
  /** Where it came from. A line the person wrote themselves outranks one the meeting gave them. */
  source: 'minutes' | 'self';
  /**
   * How it was finished, or why it was dropped. Free text, one line.
   *
   * Borrowed from the task board the team already uses, where a completed card carries a
   * completion note. It is the difference between a record that says something happened and
   * one that says what happened, and it costs the writer five seconds.
   */
  note?: string;
}

const OBJECTIVE_STATUS = ['todo', 'done', 'dropped'] as const;

/** One person's row out of the meeting. */
export interface MinuteEntry {
  ownerId: string;
  /** What they finished last week. */
  shipped?: string;
  /** Free text; each item in `blockers` also becomes a Blocker row that must acquire an owner. */
  blocked?: string[];
  /** What they need FROM someone else. */
  asking?: string;
  /** What they committed to. Becomes the draft objectives on their week plan. */
  committed?: string[];
}

/**
 * The weekly loop: minutes in, plans out, reports back.
 *
 * The shape the founder asked for, and the reason each step exists:
 *
 *   1. The meeting happens and the minutes are posted here in one call. Nobody retypes
 *      anything, which is the only way minutes ever actually reach a system.
 *   2. Each person's commitments land on THEIR week plan as **draft** objectives. Draft, not
 *      active — a commitment recorded by someone else in a meeting is a claim about a person,
 *      not yet an agreement with them.
 *   3. They open their week, and add, edit or drop. That act flips the plan to active, and it
 *      is what turns the minutes into a plan they own rather than a list they were given.
 *   4. At the end of the week the system asks for the report. `nudges()` is what asks.
 *
 * **The nudge does not exempt anybody, including the CEO.** A weekly discipline the founder is
 * outside of is a reporting line, not a discipline, and everybody can see that within a month.
 */
@Injectable()
export class WeekService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: UmurimoAccessService,
    private readonly workspace: WorkspaceService,
  ) {}

  // ------------------------------------------------------------------ minutes in

  /**
   * Post the minutes of a weekly review. Idempotent on `[ownerId, level, periodKey]`, so
   * re-posting a corrected set updates rather than duplicating — which matters, because the
   * first version of any minutes is wrong.
   */
  async ingestMinutes(actor: Actor, entries: MinuteEntry[], forWeek?: Date) {
    await this.access.assertRole(actor, 'minutes:ingest', RESOURCE, 'create');

    if (!entries.length) throw new BadRequestException('no minutes to post');

    const weekOf = mondayOf(forWeek ?? new Date());
    const period = weekKey(weekOf);
    const created = { plans: 0, reports: 0, blockers: 0, objectives: 0 };

    for (const entry of entries) {
      const objectives: Objective[] = (entry.committed ?? [])
        .map((t) => t.trim())
        .filter(Boolean)
        .map((text) => ({ text, status: 'todo' as const, source: 'minutes' as const }));

      const blocked = (entry.blocked ?? []).map((b) => b.trim()).filter(Boolean);
      const shipped = (entry.shipped ?? '').trim();
      const asking = (entry.asking ?? '').trim();

      // Somebody who said nothing is not given an empty plan. They appear in `silent` instead,
      // which is the honest record and the one worth acting on.
      if (!objectives.length && !blocked.length && !shipped && !asking) continue;

      await this.prisma.$transaction(async (tx) => {
        const existing = await tx.plan.findUnique({
          where: {
            ownerId_level_periodKey: { ownerId: entry.ownerId, level: 'week', periodKey: period },
          },
        });

        const plan = existing
          ? await tx.plan.update({
              where: { ref: existing.ref },
              // Objectives the person already edited are NOT overwritten by a re-post; the
              // meeting does not get to undo somebody's own correction.
              data: existing.status === 'draft' ? { objectives: objectives as unknown as object[] } : {},
            })
          : await tx.plan.create({
              data: {
                ref: planRef((await tx.plan.count()) + 1),
                ownerId: entry.ownerId,
                level: 'week',
                periodKey: period,
                objectives: objectives as unknown as object[],
                status: 'draft',
              },
            });
        if (!existing) created.plans += 1;
        created.objectives += objectives.length;

        const report = await tx.weeklyReport.upsert({
          where: { planRef: plan.ref },
          create: {
            ref: weeklyReportRef((await tx.weeklyReport.count()) + 1),
            planRef: plan.ref,
            ownerId: entry.ownerId,
            periodKey: period,
            highlights: shipped || '(nothing recorded)',
            blockers: blocked.join('\n') || null,
            nextWeek: objectives.map((o) => o.text).join('\n') || null,
            asking: asking || null,
          },
          update: {
            highlights: shipped || undefined,
            blockers: blocked.join('\n') || undefined,
            asking: asking || undefined,
          },
        });
        created.reports += 1;

        // Each blocker becomes a row with a NULL owner and a NULL date, on purpose: that is
        // what `unowned()` surfaces, and clearing that list is the discipline of the meeting.
        for (const summary of blocked) {
          const already = await tx.blocker.findFirst({
            where: { reportRef: report.ref, summary, clearedAt: null },
          });
          if (already) continue;
          await tx.blocker.create({
            data: {
              ref: blockerRef((await tx.blocker.count()) + 1),
              reportRef: report.ref,
              raisedBy: entry.ownerId,
              summary,
            },
          });
          created.blockers += 1;
        }
      });
    }

    await this.access.allow(actor, RESOURCE, 'create', period);

    const filed = await this.prisma.weeklyReport.findMany({
      where: { periodKey: period },
      select: { ownerId: true },
    });
    const staff = await this.prisma.user.findMany({
      where: { kind: 'employee', disabledAt: null },
      select: { ref: true },
    });
    const filedSet = new Set(filed.map((f) => f.ownerId));

    return {
      weekOf,
      periodKey: period,
      created,
      silent: staff.map((s) => s.ref).filter((r) => !filedSet.has(r)),
    };
  }

  // ------------------------------------------------------------------ the person's own week

  /**
   * My week. The half that says what I owe, and the half that says what I am owed — and the
   * second is why anybody opens it a second time.
   */
  async myWeek(actor: Actor, forWeek?: Date) {
    await this.access.assertRole(actor, 'week:read', RESOURCE, 'read');

    const weekOf = mondayOf(forWeek ?? new Date());
    const period = weekKey(weekOf);

    const plan = await this.prisma.plan.findUnique({
      where: { ownerId_level_periodKey: { ownerId: actor.userId, level: 'week', periodKey: period } },
      include: { weeklyReport: true },
    });

    const [iOwn, iRaised, askedOfMe] = await Promise.all([
      this.prisma.blocker.findMany({
        where: { ownerId: actor.userId, clearedAt: null },
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
      }),
      // Raised by me and still nobody's — the list I should be chasing, not waiting on.
      this.prisma.blocker.findMany({
        where: { raisedBy: actor.userId, clearedAt: null, OR: [{ ownerId: null }, { dueAt: null }] },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.comment.findMany({
        where: { kind: 'request', resolvedAt: null, mentions: { has: actor.userId } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    await this.access.allow(actor, RESOURCE, 'read', period);

    return {
      weekOf,
      periodKey: period,
      plan: plan
        ? { ref: plan.ref, status: plan.status, objectives: (plan.objectives ?? []) as unknown as Objective[] }
        : null,
      /** Draft means the minutes proposed it and I have not agreed to it yet. */
      needsMyConfirmation: plan?.status === 'draft',
      reportFiled: Boolean(plan?.weeklyReport),
      iOwe: iOwn,
      waitingOnSomebody: iRaised,
      askedOfMe,
    };
  }

  /**
   * Add, edit or drop my objectives, and thereby agree to them.
   *
   * The status flip from draft to active is the whole point of the step. Until a person has
   * touched their own plan, what exists is a record of what a meeting said about them.
   */
  async confirmWeek(actor: Actor, objectives: Objective[], forWeek?: Date) {
    await this.access.assertRole(actor, 'week:confirm', RESOURCE, 'update');

    const weekOf = mondayOf(forWeek ?? new Date());
    const period = weekKey(weekOf);

    const clean = objectives
      .map((o) => ({
        text: (o.text ?? '').trim(),
        status: OBJECTIVE_STATUS.includes(o.status) ? o.status : ('todo' as const),
        source: o.source === 'minutes' ? ('minutes' as const) : ('self' as const),
        ...((o.note ?? '').trim() ? { note: (o.note ?? '').trim() } : {}),
      }))
      .filter((o) => o.text);

    if (!clean.length) {
      throw new BadRequestException('a week with no objectives is not a plan — write at least one');
    }

    const existing = await this.prisma.plan.findUnique({
      where: { ownerId_level_periodKey: { ownerId: actor.userId, level: 'week', periodKey: period } },
    });

    const plan = existing
      ? await this.prisma.plan.update({
          where: { ref: existing.ref },
          data: { objectives: clean as unknown as object[], status: 'active' },
        })
      : await this.prisma.plan.create({
          data: {
            ref: planRef((await this.prisma.plan.count()) + 1),
            ownerId: actor.userId,
            level: 'week',
            periodKey: period,
            objectives: clean as unknown as object[],
            status: 'active',
          },
        });

    await this.access.allow(actor, RESOURCE, 'update', plan.ref);
    return plan;
  }

  // ------------------------------------------------------------------ the end-of-week ask

  /**
   * What the system should be asking for, and of whom.
   *
   * Internal roles get their own outstanding items. Executives get everyone's — but the list
   * includes the executive, because a weekly discipline the founder sits outside of is not a
   * discipline. `everyone` is returned as refs and counts, never as a ranking.
   */
  async nudges(actor: Actor, forWeek?: Date) {
    await this.access.assertRole(actor, 'week:read', RESOURCE, 'list');

    const weekOf = mondayOf(forWeek ?? new Date());
    const period = weekKey(weekOf);
    const now = new Date();

    const [plans, reports, staff, overdue] = await Promise.all([
      this.prisma.plan.findMany({ where: { level: 'week', periodKey: period } }),
      this.prisma.weeklyReport.findMany({ where: { periodKey: period }, select: { ownerId: true } }),
      this.prisma.user.findMany({
        where: { kind: 'employee', disabledAt: null },
        select: { ref: true },
      }),
      this.prisma.blocker.findMany({
        where: { clearedAt: null, ownerId: { not: null }, dueAt: { not: null, lt: now } },
        select: { ref: true, ownerId: true, summary: true, dueAt: true },
      }),
    ]);

    const unconfirmed = plans.filter((p) => p.status === 'draft').map((p) => p.ownerId);
    const filed = new Set(reports.map((r) => r.ownerId));
    const noPlan = staff.map((s) => s.ref).filter((r) => !plans.some((p) => p.ownerId === r));
    const noReport = staff.map((s) => s.ref).filter((r) => !filed.has(r));

    const mine = {
      confirmYourPlan: unconfirmed.includes(actor.userId),
      writeYourReport: !filed.has(actor.userId),
      overdueBlockers: overdue.filter((b) => b.ownerId === actor.userId),
    };

    await this.access.allow(actor, RESOURCE, 'list', period);

    if (!seesAllWeeks(actor.role)) return { weekOf, periodKey: period, mine };

    return {
      weekOf,
      periodKey: period,
      mine,
      everyone: { unconfirmed, noPlan, noReport, overdueBlockers: overdue },
      counts: {
        staff: staff.length,
        unconfirmed: unconfirmed.length,
        noPlan: noPlan.length,
        noReport: noReport.length,
        overdueBlockers: overdue.length,
      },
    };
  }

  /**
   * The week, scored.
   *
   * Graded against **what this person said they would do** — never against a target somebody
   * set for them, and never against anybody else. That is the only basis on which a weekly
   * score is fair, and it is also the only one that survives being shown to the person, which
   * it always is: every number here is visible to its subject, computed from records they
   * wrote, and every one of them is contestable by editing the record.
   *
   * Four parts, and each answers a question a person can act on:
   *
   *   kept    - of what you committed to, how much did you finish?
   *   onTime  - did you agree your week and send your report?
   *   cleared - of the problems you took, how many did you solve, and how many went past?
   *   answered- of the requests aimed at you, how many did you answer?
   *
   * There is deliberately no measure of VOLUME. Counting objectives rewards writing many
   * small ones, and within a month that is exactly what the register would fill up with.
   */
  async scorecard(actor: Actor, forWeek?: Date) {
    await this.access.assertRole(actor, 'week:read', RESOURCE, 'read');

    const weekOf = mondayOf(forWeek ?? new Date());
    const period = weekKey(weekOf);
    const now = new Date();

    const plan = await this.prisma.plan.findUnique({
      where: { ownerId_level_periodKey: { ownerId: actor.userId, level: 'week', periodKey: period } },
      include: { weeklyReport: true },
    });
    const objectives = ((plan?.objectives ?? []) as unknown as Objective[]).filter(
      (o) => o.status !== 'dropped',
    );
    const done = objectives.filter((o) => o.status === 'done').length;

    const [mineOpen, mineCleared, requests] = await Promise.all([
      this.prisma.blocker.findMany({ where: { ownerId: actor.userId, clearedAt: null } }),
      this.prisma.blocker.count({
        where: { ownerId: actor.userId, clearedAt: { gte: weekOf } },
      }),
      this.prisma.comment.findMany({
        where: { kind: 'request', mentions: { has: actor.userId } },
        select: { resolvedAt: true },
      }),
    ]);
    const late = mineOpen.filter((b) => b.dueAt && b.dueAt < now).length;
    const answered = requests.filter((r) => r.resolvedAt).length;

    const pct = (a: number, b: number) => (b === 0 ? null : Math.round((a / b) * 100));

    // The measured half. Self-declared ticks say what a person believes they did; the mirrored
    // workspace tasks say what was actually closed, with a date on it. Where both exist the
    // measurement is the one to trust, and it is reported separately rather than blended so
    // nobody has to wonder which they are looking at.
    const nextWeek = new Date(weekOf);
    nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);
    const tasks = await this.workspace.completion(actor.userId, weekOf, nextWeek);

    await this.access.allow(actor, RESOURCE, 'read', period);

    return {
      weekOf,
      periodKey: period,
      kept: { done, of: objectives.length, pct: pct(done, objectives.length) },
      onTime: {
        planAgreed: plan?.status === 'active',
        reportSent: Boolean(plan?.weeklyReport),
      },
      cleared: { solved: mineCleared, stillOpen: mineOpen.length, late },
      answered: { answered, of: requests.length, pct: pct(answered, requests.length) },
      /**
       * From the workspace, not from a tick. Empty until the bridge is pushing, and empty is
       * honest — see `/umurimo/workspace/health` for whether it is alive at all.
       */
      tasks,
      /**
       * A word, not a number out of a hundred. A precise-looking score invites comparison
       * between people, which is the one thing this must not become - and a number computed
       * from four small counts is not precise enough to deserve one.
       */
      standing: this.standing(
        pct(done, objectives.length),
        plan?.status === 'active',
        Boolean(plan?.weeklyReport),
        late + tasks.overdue,
      ),
    };
  }

  private standing(keptPct: number | null, agreed: boolean, sent: boolean, late: number) {
    if (!agreed && !sent) return 'nothing recorded';
    if (late > 0) return 'something is late';
    if (keptPct === null) return 'in progress';
    if (keptPct >= 80 && sent) return 'a good week';
    if (keptPct >= 50) return 'partly done';
    return 'behind';
  }

  /** File the weekly report against my own plan. */
  async fileReport(
    actor: Actor,
    input: { highlights: string; blockers?: string; nextWeek?: string; asking?: string },
    forWeek?: Date,
  ) {
    await this.access.assertRole(actor, 'week:confirm', RESOURCE, 'update');

    const period = weekKey(mondayOf(forWeek ?? new Date()));
    const plan = await this.prisma.plan.findUnique({
      where: { ownerId_level_periodKey: { ownerId: actor.userId, level: 'week', periodKey: period } },
    });
    if (!plan) throw new NotFoundException(`no week plan for ${period} — confirm your plan first`);

    const highlights = input.highlights.trim();
    if (!highlights) throw new BadRequestException('say what you finished, even if it is nothing');

    const report = await this.prisma.weeklyReport.upsert({
      where: { planRef: plan.ref },
      create: {
        ref: weeklyReportRef((await this.prisma.weeklyReport.count()) + 1),
        planRef: plan.ref,
        ownerId: actor.userId,
        periodKey: period,
        highlights,
        blockers: input.blockers?.trim() || null,
        nextWeek: input.nextWeek?.trim() || null,
        asking: input.asking?.trim() || null,
      },
      update: {
        highlights,
        blockers: input.blockers?.trim() ?? undefined,
        nextWeek: input.nextWeek?.trim() ?? undefined,
        asking: input.asking?.trim() ?? undefined,
      },
    });

    await this.access.allow(actor, RESOURCE, 'update', report.ref);
    return report;
  }
}
