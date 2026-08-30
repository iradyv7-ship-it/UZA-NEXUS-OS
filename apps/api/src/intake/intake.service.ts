import { nextSequence } from '../platform/ids/next-sequence';
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Actor } from '@uza/contracts';
import type { SignalSource, SignalStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlanningAccessService } from '../planning/planning-authz.service';
import { classify, redact } from './intake-lanes';
import type { Signal } from '@prisma/client';
import type { CapturedSignal } from './sources/captured-signal';
import { ClaudeCodeSource } from './sources/claude-code.source';
import { GmailSource } from './sources/gmail.source';
import { DocumentSource } from './sources/document.source';

const RESOURCE = 'signal';

/** How far back a first sweep reaches when there is nothing in the table yet. */
const COLD_START_DAYS = 14;

export interface PromoteInput {
  /** What the human created from it — an initiative ref, a decision ref, a task ref. */
  readonly promotedRef: string;
}

/**
 * Intake — everything that arrives from outside the register.
 *
 * The rule that governs this whole module: **a signal never becomes an initiative on its
 * own.** Sweeps capture, rules classify, the advisor proposes, and a person decides. The
 * register is only worth reading because everything in it was put there deliberately, and
 * an ingester with write access to it would end that within a week.
 *
 * Lane discipline is enforced here rather than at the controller, for the same reason the
 * rest of Nexus checks authorisation at the service layer: a second caller added later
 * gets the rule for free instead of having to remember it.
 */
@Injectable()
export class IntakeService {
  private readonly logger = new Logger(IntakeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: PlanningAccessService,
    private readonly claudeCode: ClaudeCodeSource,
    private readonly gmail: GmailSource,
    private readonly documents: DocumentSource,
  ) {}

  private seesPrivate(actor: Actor): boolean {
    return actor.role === 'ceo';
  }

  /**
   * `body` is stored RAW, deliberately — redaction is applied fresh at each point the text
   * actually leaves the system (triage.service.ts does the same before a model call), so
   * the choice of what counts as "leaving" stays in one place instead of being baked into
   * storage. An HTTP response to a caller is one of those points and, until this fix, was
   * the one place that skipped it: read()/add()/promote()/dismiss() all returned the raw
   * row, so a phone number in a signal's body that never tripped a wall term or a
   * RESTRICTED keyword (classify() only pattern-matches title+body for THOSE, not for bare
   * PII) reached any of the five intake:read roles unredacted — the exact leak this
   * module's own header comment describes as the reason it exists.
   */
  private redactBody<T extends Signal>(signal: T): T {
    return { ...signal, body: redact(signal.body) };
  }

  /** The instant the last sweep reached. Derived from the data, so it survives a restart. */
  private async watermark(): Promise<Date> {
    const latest = await this.prisma.signal.findFirst({
      orderBy: { capturedAt: 'desc' },
      select: { capturedAt: true },
    });
    return latest?.capturedAt ?? new Date(Date.now() - COLD_START_DAYS * 86_400_000);
  }

  /**
   * Run every configured source and file what comes back.
   *
   * Called by the scheduler and by the sweep endpoint. Safe to run at any frequency: each
   * source is incremental, and `[source, externalId]` is unique, so an overlapping sweep
   * re-files nothing.
   */
  async sweep(): Promise<{ captured: number; private: number; bySource: Record<string, number> }> {
    const since = await this.watermark();
    const batches = await Promise.all([
      this.claudeCode.collect(since).catch((e) => this.failed('claude_code', e)),
      this.gmail.collect(since).catch((e) => this.failed('email', e)),
      this.documents.collect(since).catch((e) => this.failed('artifact', e)),
    ]);

    const captured = batches.flat();
    const bySource: Record<string, number> = {};
    let privateCount = 0;
    let written = 0;

    for (const signal of captured) {
      const stored = await this.record(signal);
      if (!stored) continue;
      written += 1;
      bySource[signal.source] = (bySource[signal.source] ?? 0) + 1;
      if (stored.lane === 'private') privateCount += 1;
    }

    this.logger.log(
      `sweep: ${written} new signals since ${since.toISOString()} (${privateCount} private)`,
    );
    return { captured: written, private: privateCount, bySource };
  }

  private failed(source: string, err: unknown): CapturedSignal[] {
    this.logger.error(`source ${source} failed: ${(err as Error).message}`);
    return []; // one broken source must not take the sweep down with it
  }

  /**
   * Classify and store one captured signal. Returns null if it was already filed.
   *
   * Classification happens BEFORE the row is written, never after — there is no window in
   * which a walled signal exists in the table as shared.
   */
  private async record(input: CapturedSignal) {
    const existing = await this.prisma.signal.findUnique({
      where: { source_externalId: { source: input.source, externalId: input.externalId } },
      select: { ref: true },
    });
    if (existing) return null;

    const { lane, wallTags } = classify(input.title, input.body);
    const seq = await nextSequence(
      this.prisma.signal,
      (n) => `SIG-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`,
    );
    const ref = `SIG-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`;

    return this.prisma.signal.create({
      data: {
        ref,
        source: input.source,
        externalId: input.externalId,
        lane,
        wallTags: [...wallTags],
        // The title is a shared field even on a private signal — it is what appears in a
        // count. Redact it too.
        title: redact(input.title).slice(0, 200),
        body: input.body,
        occurredAt: input.occurredAt,
        status: 'new',
      },
    });
  }

  /** Type it in yourself. The same rules apply — an idea typed in is still classified. */
  async add(actor: Actor, input: { title: string; body: string }) {
    await this.access.assertRole(actor, 'intake:write', RESOURCE, 'create');
    if (!input.title.trim() || !input.body.trim())
      throw new BadRequestException('a signal needs a title and a body');
    const created = await this.record({
      source: 'manual' as SignalSource,
      externalId: `${actor.userId}:${input.title.trim().slice(0, 60)}:${Date.now()}`,
      title: input.title.trim(),
      body: input.body.trim(),
      occurredAt: new Date(),
    });
    await this.access.allow(actor, RESOURCE, 'create', created?.ref);
    return created ? this.redactBody(created) : created;
  }

  async list(
    actor: Actor,
    filters: { status?: SignalStatus; source?: SignalSource; limit?: number } = {},
  ) {
    await this.access.assertRole(actor, 'intake:read', RESOURCE, 'list');
    const where: Record<string, unknown> = {};
    if (filters.status) where.status = filters.status;
    if (filters.source) where.source = filters.source;
    // The lane filter is not optional and not a parameter. Anyone but the CEO sees shared.
    if (!this.seesPrivate(actor)) where.lane = 'shared';

    const rows = await this.prisma.signal.findMany({
      where,
      orderBy: [{ status: 'asc' }, { occurredAt: 'desc' }],
      take: Math.min(filters.limit ?? 50, 200),
      // `body` is deliberately excluded from the list projection. A queue is scanned, and
      // raw captured text does not belong in something that gets scanned.
      select: {
        ref: true,
        source: true,
        lane: true,
        title: true,
        summary: true,
        wallTags: true,
        status: true,
        proposedInitiativeRef: true,
        proposedAction: true,
        proposedConfidence: true,
        occurredAt: true,
        capturedAt: true,
      },
    });
    await this.access.allow(actor, RESOURCE, 'list');
    return rows;
  }

  /** The full record, with body redacted the same way a model call redacts it. Lane-checked individually. */
  async read(actor: Actor, ref: string) {
    await this.access.assertRole(actor, 'intake:read', RESOURCE, 'read', ref);
    const found = await this.prisma.signal.findUnique({ where: { ref } });
    if (!found) throw new NotFoundException(`signal ${ref} not found`);
    if (found.lane === 'private' && !this.seesPrivate(actor)) {
      return this.access.denyScope(actor, RESOURCE, 'read', ref);
    }
    await this.access.allow(actor, RESOURCE, 'read', ref);
    return this.redactBody(found);
  }

  /**
   * Mark a signal as having become something. `promotedRef` is whatever the human created
   * — this method does not create it, and that is the point.
   */
  async promote(actor: Actor, ref: string, input: PromoteInput) {
    await this.access.assertRole(actor, 'intake:write', RESOURCE, 'promote', ref);
    const signal = await this.read(actor, ref);
    if (signal.status === 'promoted') throw new BadRequestException(`${ref} was already promoted`);
    if (!input.promotedRef.trim()) throw new BadRequestException('name what you created from it');

    const updated = await this.prisma.signal.update({
      where: { ref },
      data: {
        status: 'promoted',
        promotedRef: input.promotedRef.trim(),
        resolvedById: actor.userId,
        resolvedAt: new Date(),
      },
    });
    await this.access.allow(actor, RESOURCE, 'promote', ref);
    return this.redactBody(updated);
  }

  async dismiss(actor: Actor, ref: string, reason: string) {
    await this.access.assertRole(actor, 'intake:write', RESOURCE, 'dismiss', ref);
    const signal = await this.read(actor, ref);
    if (!reason.trim()) {
      throw new BadRequestException(
        'say why — a queue emptied without reasons teaches nothing about what to stop capturing',
      );
    }
    const updated = await this.prisma.signal.update({
      where: { ref: signal.ref },
      data: {
        status: 'dismissed',
        dismissedReason: reason.trim(),
        resolvedById: actor.userId,
        resolvedAt: new Date(),
      },
    });
    await this.access.allow(actor, RESOURCE, 'dismiss', ref);
    return this.redactBody(updated);
  }

  /**
   * Move a private signal into the shared lane. CEO only, and it exists because the rules
   * are deliberately coarse: a signal that merely mentions the lender in passing will be
   * walled, and someone has to be able to say "this one is fine".
   *
   * There is no method for the reverse. A signal that has been shared cannot be un-shared,
   * because by then it has been read.
   */
  async share(actor: Actor, ref: string) {
    await this.access.assertRole(actor, 'intake:declassify', RESOURCE, 'share', ref);
    const signal = await this.prisma.signal.findUnique({ where: { ref } });
    if (!signal) throw new NotFoundException(`signal ${ref} not found`);
    if (signal.lane === 'shared') return this.redactBody(signal);

    const updated = await this.prisma.signal.update({ where: { ref }, data: { lane: 'shared' } });
    await this.access.allow(actor, RESOURCE, 'share', ref);
    return this.redactBody(updated);
  }

  /** What is sitting in the queue, and how stale the oldest of it is. */
  async queue(actor: Actor) {
    await this.access.assertRole(actor, 'intake:read', RESOURCE, 'queue');
    const laneFilter = this.seesPrivate(actor) ? {} : { lane: 'shared' as const };
    const [pending, oldest] = await Promise.all([
      this.prisma.signal.groupBy({
        by: ['source', 'status'],
        where: { status: { in: ['new', 'triaged'] }, ...laneFilter },
        _count: { _all: true },
      }),
      this.prisma.signal.findFirst({
        where: { status: { in: ['new', 'triaged'] }, ...laneFilter },
        orderBy: { occurredAt: 'asc' },
        select: { ref: true, title: true, occurredAt: true },
      }),
    ]);
    await this.access.allow(actor, RESOURCE, 'queue');
    return {
      pending: pending.map((p) => ({ source: p.source, status: p.status, count: p._count._all })),
      oldest,
      oldestDays: oldest ? Math.floor((Date.now() - oldest.occurredAt.getTime()) / 86_400_000) : 0,
    };
  }
}
