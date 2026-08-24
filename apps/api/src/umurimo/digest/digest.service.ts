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

    const [reports, unownedBlockers, overdueBlockers, openRequests, employees] = await Promise.all([
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
    ]);

    const filed = new Set(reports.map((r) => r.ownerId));

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
