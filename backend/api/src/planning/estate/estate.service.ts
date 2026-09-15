import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { CheckOutcome, SystemKind, SystemStatus, SystemVisibility } from '@prisma/client';
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
 * A verification older than this no longer counts as current.
 *
 * Two weeks is chosen against how fast this estate moves, not from a standard. The
 * point is that green has a shelf life: a passing run from three weeks ago tells you
 * about a codebase that no longer exists, and presenting it as current is the failure
 * this whole model is meant to prevent.
 */
const VERIFICATION_STALE_DAYS = 14;

export interface RecordVerificationInput {
  readonly systemRef: string;
  readonly verifiedAt?: Date;
  readonly typecheck?: CheckOutcome;
  readonly tests?: CheckOutcome;
  readonly imageBuilds?: CheckOutcome;
  readonly testsPassed?: number;
  readonly testsTotal?: number;
  readonly gaps?: string;
  readonly verifiedBy: string;
  readonly notes?: string;
}

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
    for (const s of all)
      byVenture[s.ventureCode ?? 'unassigned'] =
        (byVenture[s.ventureCode ?? 'unassigned'] ?? 0) + 1;

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
        .map((s) => ({
          ref: s.ref,
          name: s.name,
          supersededBy: s.supersededBy,
          repoUrl: s.repoUrl,
        })),
      /** Nothing pushed in two months, and still not marked dormant or retired. */
      silent: all
        .filter((s) => {
          const d = age(s.lastPushAt);
          return d !== null && d > DORMANT_DAYS && s.status !== 'dormant';
        })
        .map((s) => ({
          ref: s.ref,
          name: s.name,
          ownerId: s.ownerId,
          daysSincePush: age(s.lastPushAt),
        })),
      /** A system with no venture is a system nobody has decided the purpose of. */
      unassigned: all.filter((s) => !s.ventureCode).map((s) => ({ ref: s.ref, name: s.name })),
    };
  }

  /**
   * Record one run of a system's checks.
   *
   * Append-only: a later run is a new row, never an edit. That is what turns a status
   * field into a trend, and a trend is the thing that shows a system stuck at
   * "nearly done" for two months.
   */
  async recordVerification(actor: Actor, input: RecordVerificationInput) {
    await this.access.assertRole(actor, 'initiative:create', RESOURCE, 'verify');

    const system = await this.prisma.systemRecord.findUnique({ where: { ref: input.systemRef } });
    if (!system) throw new NotFoundException(`no system ${input.systemRef}`);

    const { testsPassed, testsTotal, tests } = input;

    // Refuse an incoherent measurement rather than storing it. A row saying the suite
    // passed while fewer tests passed than ran is worse than no row: it is a number
    // somebody will quote.
    if (testsPassed !== undefined && testsPassed < 0) {
      throw new BadRequestException('testsPassed cannot be negative');
    }
    if (testsTotal !== undefined && testsTotal < 0) {
      throw new BadRequestException('testsTotal cannot be negative');
    }
    if (testsPassed !== undefined && testsTotal !== undefined && testsPassed > testsTotal) {
      throw new BadRequestException('testsPassed cannot exceed testsTotal');
    }
    if (
      tests === 'pass' &&
      testsPassed !== undefined &&
      testsTotal !== undefined &&
      testsPassed < testsTotal
    ) {
      throw new BadRequestException('tests cannot be "pass" while some tests did not pass');
    }
    if (!input.verifiedBy?.trim()) {
      throw new BadRequestException('a verification needs to say who ran it');
    }

    const verifiedAt = input.verifiedAt ?? new Date();
    if (verifiedAt.getTime() > Date.now() + 60_000) {
      // A future timestamp would sit at the top of the history and never go stale.
      throw new BadRequestException('a verification cannot be dated in the future');
    }

    const seq = await nextSequence(this.prisma.systemVerification, refPrefix('VER'));
    const ref = `VER-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`;

    const created = await this.prisma.systemVerification.create({
      data: {
        ref,
        systemRef: input.systemRef,
        verifiedAt,
        typecheck: input.typecheck ?? 'not_run',
        tests: tests ?? 'not_run',
        imageBuilds: input.imageBuilds ?? 'not_run',
        ...(testsPassed !== undefined ? { testsPassed } : {}),
        ...(testsTotal !== undefined ? { testsTotal } : {}),
        ...(input.gaps !== undefined ? { gaps: input.gaps } : {}),
        verifiedBy: input.verifiedBy.trim(),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });

    await this.access.allow(actor, RESOURCE, 'verify', input.systemRef);
    return created;
  }

  /**
   * What the founder opens to see where each system stands.
   *
   * Every system, its most recent measurement, and — the part that matters — whether
   * that measurement is still current. A system with no verification is not reported as
   * failing; it is reported as UNVERIFIED, which is a different and more common problem,
   * and conflating the two is how a genuinely broken system hides among the unmeasured
   * ones.
   */
  async readiness(actor: Actor) {
    await this.access.assertRole(actor, 'initiative:read', RESOURCE, 'readiness');

    const systems = await this.prisma.systemRecord.findMany({
      where: { status: { not: 'retired' } },
      orderBy: [{ ventureCode: 'asc' }, { name: 'asc' }],
      include: {
        verifications: { orderBy: { verifiedAt: 'desc' }, take: 2 },
      },
    });

    const now = Date.now();
    // Floored at zero. A row timestamped slightly ahead of the clock — a seed, an
    // importer, a machine whose time drifted — must read as "today", never as
    // "-1 days ago", which is how it rendered before this line existed.
    const daysSince = (d: Date) => Math.max(0, Math.floor((now - d.getTime()) / 86_400_000));

    const rows = systems.map((s) => {
      const [latest, previous] = s.verifications;

      if (!latest) {
        return {
          ref: s.ref,
          name: s.name,
          ventureCode: s.ventureCode,
          status: s.status,
          ownerId: s.ownerId,
          state: 'unverified' as const,
          lastVerifiedAt: null,
          daysSinceVerified: null,
          checks: null,
          gaps: null,
          trend: null,
        };
      }

      const age = daysSince(latest.verifiedAt);
      const failing =
        latest.typecheck === 'fail' || latest.tests === 'fail' || latest.imageBuilds === 'fail';

      // Order matters: failing beats stale. A run that failed three weeks ago is still
      // a failure, and calling it "stale" would let it drop off the list quietly.
      const state = failing
        ? ('failing' as const)
        : age > VERIFICATION_STALE_DAYS
          ? ('stale' as const)
          : ('green' as const);

      // Trend needs two comparable runs with real counts. Without them it is null
      // rather than a guess.
      const trend =
        previous && latest.testsTotal != null && previous.testsTotal != null
          ? latest.testsTotal > previous.testsTotal
            ? 'growing'
            : latest.testsTotal < previous.testsTotal
              ? 'shrinking'
              : 'flat'
          : null;

      return {
        ref: s.ref,
        name: s.name,
        ventureCode: s.ventureCode,
        status: s.status,
        ownerId: s.ownerId,
        state,
        lastVerifiedAt: latest.verifiedAt,
        daysSinceVerified: age,
        checks: {
          typecheck: latest.typecheck,
          tests: latest.tests,
          imageBuilds: latest.imageBuilds,
          testsPassed: latest.testsPassed,
          testsTotal: latest.testsTotal,
          verifiedBy: latest.verifiedBy,
        },
        gaps: latest.gaps,
        trend,
      };
    });

    const count = (s: string) => rows.filter((r) => r.state === s).length;

    return {
      systems: rows,
      summary: {
        total: rows.length,
        green: count('green'),
        failing: count('failing'),
        stale: count('stale'),
        unverified: count('unverified'),
        /** Tests across every system whose latest run reported a count. */
        testsPassing: rows.reduce((n, r) => n + (r.checks?.testsPassed ?? 0), 0),
      },
      /**
       * Said plainly, because a dashboard that only shows green numbers trains people
       * to stop reading it.
       */
      caveat:
        'Green means the checks that exist passed when they were last run. It does not mean the system is finished — read the gaps column for what is built but not yet connected.',
    };
  }
}
