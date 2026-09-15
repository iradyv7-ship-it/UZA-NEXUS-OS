import { Injectable } from '@nestjs/common';
import type { Actor } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { UmurimoAccessService } from '../umurimo-authz.service';
import { mondayOf, weekKey } from '../../planning/planning-ids';

const RESOURCE = 'digest';

/**
 * The one read the weekly meeting is run against.
 *
 * `ReviewService` in the planning module already answers the founder's four questions about
 * INITIATIVES — what moved, what is held, what waits on me, what nobody filed. This answers
 * the four about PEOPLE, and the two are deliberately separate reads rather than one merged
 * dashboard: the first is about work, the second is about who is carrying it, and merging them
 * produces a screen that ranks humans by proxy.
 *
 * Everything here is derived. Nothing is typed in twice. And like the planning review, the
 * value is in what it surfaces that nobody wrote down:
 *
 *   - `unownedBlockers` — said out loud, then not assigned. Must be empty by the end.
 *   - `overdueBlockers` — assigned and then not delivered. A different failure.
 *   - `openAsks` — what people need FROM each other, unanswered.
 *   - `openRequests` — explicit requests for comment nobody has answered.
 *   - `silent` — who filed nothing at all. The most important list and the easiest to omit.
 */
@Injectable()
export class DigestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: UmurimoAccessService,
  ) {}

  async week(actor: Actor, forWeek?: Date) {
    await this.access.assertRole(actor, 'digest', RESOURCE, 'read');

    const weekOf = mondayOf(forWeek ?? new Date());
    const nextWeek = new Date(weekOf);
    nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);
    const period = weekKey(weekOf);
    const now = new Date();

    const [reports, unownedBlockers, overdueBlockers, openRequests, employees, profiles] =
      await Promise.all([
        this.prisma.weeklyReport.findMany({ where: { periodKey: period } }),
        this.prisma.blocker.findMany({
          where: { clearedAt: null, OR: [{ ownerId: null }, { dueAt: null }] },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.blocker.findMany({
          where: { clearedAt: null, ownerId: { not: null }, dueAt: { not: null, lt: now } },
          orderBy: { dueAt: 'asc' },
        }),
        this.prisma.comment.findMany({
          where: { kind: 'request', resolvedAt: null },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.user.findMany({
          where: { kind: 'employee', disabledAt: null },
          select: { ref: true },
        }),
        // Departments exist now, so the digest can be read by arm rather than as a
        // flat list of ten names. A founder scanning this on a Monday is asking
        // "which part of the company is stuck", not "who is stuck".
        this.prisma.employeeProfile.findMany({
          select: { userId: true, department: { select: { code: true, name: true } } },
        }),
      ]);

    const filed = new Set(reports.map((r) => r.ownerId));
    const deptOf = new Map(profiles.map((p) => [p.userId, p.department?.code ?? 'UNASSIGNED']));
    const deptName = new Map<string, string>([['UNASSIGNED', 'No department']]);
    for (const p of profiles) {
      if (p.department) deptName.set(p.department.code, p.department.name);
    }

    /**
     * One row per department: how many filed, how many did not, and what is
     * unassigned or late inside it. An arm where nobody filed is a different
     * problem from three individuals scattered across three arms, and a flat
     * list cannot tell those apart.
     */
    const byDepartment = [...deptName.keys()]
      .map((code) => {
        const people = employees.map((e) => e.ref).filter((ref) => deptOf.get(ref) === code);
        if (!people.length) return null;
        const inDept = (ownerId: string | null) => !!ownerId && deptOf.get(ownerId) === code;
        return {
          code,
          name: deptName.get(code) ?? code,
          people: people.length,
          filed: people.filter((ref) => filed.has(ref)).length,
          silent: people.filter((ref) => !filed.has(ref)),
          unowned: unownedBlockers.filter((b) => inDept(b.raisedBy)).length,
          overdue: overdueBlockers.filter((b) => inDept(b.ownerId)).length,
        };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .sort((a, b) => a.filed / a.people - b.filed / b.people);

    return {
      weekOf,
      periodKey: period,

      /** What people need from each other, unanswered. The field that makes the meeting a trade. */
      openAsks: reports
        .filter((r) => (r.asking ?? '').trim().length > 0)
        .map((r) => ({ ref: r.ref, ownerId: r.ownerId, asking: r.asking })),

      /**
       * Raised and then not assigned. The count going to zero before the meeting ends is the
       * discipline that keeps people raising things at all — a team that watches blockers get
       * discussed and dropped stops raising them within a month.
       */
      unownedBlockers,

      /** Assigned, dated, and past the date. Reported separately because it is a different failure. */
      overdueBlockers,

      /** Explicit requests for comment that nobody has answered. */
      openRequests,

      /**
       * Who filed nothing. A digest that only shows what people wrote flatters the
       * organisation; this one shows what they did not.
       */
      silent: employees.map((e) => e.ref).filter((ref) => !filed.has(ref)),

      /** Worst-filing arm first — the one worth asking about. */
      byDepartment,

      counts: {
        filed: reports.length,
        silent: employees.length - filed.size,
        unowned: unownedBlockers.length,
        overdue: overdueBlockers.length,
        openAsks: reports.filter((r) => (r.asking ?? '').trim().length > 0).length,
        openRequests: openRequests.length,
      },
    };
  }
}
