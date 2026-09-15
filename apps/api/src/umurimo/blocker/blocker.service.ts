import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Actor } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { UmurimoAccessService } from '../umurimo-authz.service';
import { seesAllBlockers } from '../umurimo-access';
import { blockerRef } from '../umurimo-ids';
import { mondayOf, nextSequence, refPrefix } from '../../planning/planning-ids';

const RESOURCE = 'blocker';

/**
 * Blockers — the one meeting discipline this module exists to enforce.
 *
 * A blocker with no owner and no date is a complaint. A blocker with both is work. The rule
 * agreed for the weekly review is that none of the first kind survives the meeting it was
 * raised in, and `unowned()` is what makes that checkable in ten seconds instead of by
 * re-reading the minutes.
 *
 * The schema stored blockers only as free text on `WeeklyReport.blockers` before this, which
 * made the check impossible — you cannot query prose for an absent owner. That is the whole
 * reason for the table.
 *
 * Raising is friction-free and so is taking ownership: any internal role may do both. Routing
 * ownership through a manager guarantees the assignment does not happen in the meeting, which
 * is the only moment everyone is present.
 */
@Injectable()
export class BlockerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: UmurimoAccessService,
  ) {}

  /** Raise a blocker against a weekly report. Deliberately requires nothing but a sentence. */
  async raise(actor: Actor, reportRef: string, summary: string) {
    await this.access.assertRole(actor, 'blocker:raise', RESOURCE, 'create', reportRef);

    const clean = summary.trim();
    if (!clean)
      throw new BadRequestException('a blocker needs a sentence saying what is in the way');

    const report = await this.prisma.weeklyReport.findUnique({
      where: { ref: reportRef },
      select: { ref: true },
    });
    if (!report) throw new NotFoundException(`weekly report ${reportRef} not found`);

    const seq = await nextSequence(this.prisma.blocker, refPrefix('BLK'));
    const created = await this.prisma.blocker.create({
      data: { ref: blockerRef(seq), reportRef, raisedBy: actor.userId, summary: clean },
    });

    await this.access.allow(actor, RESOURCE, 'create', created.ref);
    return created;
  }

  /**
   * Give a blocker a name and a date.
   *
   * Both are required together on purpose. An owner with no date is a person who has been
   * volunteered; a date with no owner is a wish. Accepting one for yourself and assigning one
   * to a colleague are the same call, because in the meeting they are the same act.
   */
  async own(actor: Actor, ref: string, ownerId: string, dueAt: Date) {
    await this.access.assertRole(actor, 'blocker:own', RESOURCE, 'own', ref);

    const blocker = await this.mustFind(ref);
    if (blocker.clearedAt) throw new BadRequestException(`blocker ${ref} is already cleared`);
    if (Number.isNaN(dueAt.getTime())) {
      throw new BadRequestException('a valid due date is required to own a blocker');
    }

    const updated = await this.prisma.blocker.update({
      where: { ref },
      data: { ownerId, dueAt, ownedAt: blocker.ownedAt ?? new Date() },
    });
    await this.access.allow(actor, RESOURCE, 'own', ref);
    return updated;
  }

  /** Clear it, with a note saying how. The note is what makes the record worth keeping. */
  async clear(actor: Actor, ref: string, note: string) {
    await this.access.assertRole(actor, 'blocker:clear', RESOURCE, 'clear', ref);

    const blocker = await this.mustFind(ref);
    if (blocker.clearedAt) return blocker; // idempotent

    const clean = note.trim();
    if (!clean) {
      throw new BadRequestException(
        'say how it was cleared, or the record teaches nobody anything',
      );
    }

    const updated = await this.prisma.blocker.update({
      where: { ref },
      data: { clearedAt: new Date(), clearedBy: actor.userId, clearedNote: clean },
    });
    await this.access.allow(actor, RESOURCE, 'clear', ref);
    return updated;
  }

  /**
   * Open blockers that have no owner or no due date.
   *
   * This is the query the weekly meeting is run against. Everything it returns is something
   * that was said out loud and then not assigned, and the count going to zero before the
   * meeting ends is the only discipline that keeps people raising things at all — a team that
   * watches blockers get discussed and dropped stops raising them within a month.
   */
  async unowned(actor: Actor) {
    await this.access.assertRole(actor, 'blocker:read', RESOURCE, 'list');
    const rows = await this.prisma.blocker.findMany({
      where: { clearedAt: null, OR: [{ ownerId: null }, { dueAt: null }] },
      orderBy: { createdAt: 'asc' },
    });
    await this.access.allow(actor, RESOURCE, 'list');
    return rows;
  }

  /**
   * Blockers that are owned, dated, and past their date.
   *
   * Separate from `unowned` because they are a different failure: one is a team that did not
   * assign, the other is a person who did not deliver. Reporting them together hides both.
   */
  async overdue(actor: Actor, asOf: Date = new Date()) {
    await this.access.assertRole(actor, 'blocker:read', RESOURCE, 'list');
    const rows = await this.prisma.blocker.findMany({
      where: { clearedAt: null, dueAt: { not: null, lt: asOf }, ownerId: { not: null } },
      orderBy: { dueAt: 'asc' },
    });
    await this.access.allow(actor, RESOURCE, 'list');
    return rows;
  }

  /** My open blockers — the half of the per-person view that says what I owe. */
  async mine(actor: Actor) {
    await this.access.assertRole(actor, 'blocker:read', RESOURCE, 'list');
    const rows = await this.prisma.blocker.findMany({
      where: { clearedAt: null, ownerId: actor.userId },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
    });
    await this.access.allow(actor, RESOURCE, 'list');
    return rows;
  }

  /**
   * Everything raised in a given week, for anyone the actor may see.
   *
   * `seesAllBlockers` is the widening: an executive gets the organisation, everyone else gets
   * what they raised or own. A person browsing every blocker in the company is surveillance,
   * not participation, and the module is explicitly not that.
   */
  async week(actor: Actor, forWeek?: Date) {
    await this.access.assertRole(actor, 'blocker:read', RESOURCE, 'list');
    const weekOf = mondayOf(forWeek ?? new Date());
    const nextWeek = new Date(weekOf);
    nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);

    const scope = seesAllBlockers(actor.role)
      ? {}
      : { OR: [{ raisedBy: actor.userId }, { ownerId: actor.userId }] };

    const rows = await this.prisma.blocker.findMany({
      where: { createdAt: { gte: weekOf, lt: nextWeek }, ...scope },
      orderBy: { createdAt: 'asc' },
    });
    await this.access.allow(actor, RESOURCE, 'list');
    return rows;
  }

  private async mustFind(ref: string) {
    const blocker = await this.prisma.blocker.findUnique({ where: { ref } });
    if (!blocker) throw new NotFoundException(`blocker ${ref} not found`);
    return blocker;
  }
}
