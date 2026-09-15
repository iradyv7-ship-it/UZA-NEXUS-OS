import { Injectable, BadRequestException } from '@nestjs/common';
import type { Actor } from '@uza/contracts';
import { PlanningAccessService } from '../planning-authz.service';
import { InitiativeService } from '../initiative/initiative.service';
import { ResponsibilityService } from '../responsibility/responsibility.service';
import { IntakeService } from '../../intake/intake.service';
import { ventureForGitSignalTitle } from '../../intake/repo-venture-map';

const RESOURCE = 'ventureOverview';

/** How many recent commits across the whole estate to scan before filtering to one venture.
 * `IntakeService.list` caps at 200 regardless; this just states the cap explicitly here too,
 * since a venture with heavy recent activity elsewhere in the estate could otherwise starve
 * a quieter one out of the same fixed window. */
const GIT_SIGNAL_SCAN_LIMIT = 200;

/**
 * "One page per venture" — the first real slice of the founder's 2026-09-15 direction that
 * UZA Nexus should have access to every UZA Solutions project and surface it by venture, not
 * just as one undifferentiated feed. See `docs/nexus-executive-layer.md` §10.
 *
 * Deliberately a read-only COMPOSITION over three already-real, already-tested sources —
 * `InitiativeService`, `ResponsibilityService`, `IntakeService` — never a second copy of
 * their data. Each keeps its own authorisation and, for signals, its own lane-redaction
 * discipline (git-activity titles are already safe to show — see `IntakeService.list`'s own
 * projection, which never returns raw `body`); this service adds nothing new to trust, it
 * only asks three things the same question and returns the answers together.
 *
 * Gated on `initiative:all` (ceo/venture_manager) rather than a new capability: a per-venture
 * cross-cutting view is exactly the kind of unrestricted visibility that capability already
 * means, and adding a parallel capability for the same trust level would be the kind of
 * duplicated policy this register's own discipline argues against.
 */
@Injectable()
export class VentureOverviewService {
  constructor(
    private readonly access: PlanningAccessService,
    private readonly initiatives: InitiativeService,
    private readonly responsibilities: ResponsibilityService,
    private readonly intake: IntakeService,
  ) {}

  async overview(actor: Actor, ventureCode: string) {
    const code = ventureCode?.trim().toUpperCase();
    if (!code) {
      throw new BadRequestException('ventureCode is required');
    }
    await this.access.assertRole(actor, 'initiative:all', RESOURCE, 'read', code);

    const [initiatives, responsibilities, recentSignals] = await Promise.all([
      this.initiatives.list(actor, { ventureCode: code }),
      this.responsibilities.list(actor, { ventureCode: code }),
      this.intake.list(actor, { source: 'git_commit', limit: GIT_SIGNAL_SCAN_LIMIT }),
    ]);

    const recentGitActivity = recentSignals.filter(
      (signal) => ventureForGitSignalTitle(signal.title) === code,
    );

    await this.access.allow(actor, RESOURCE, 'read', code);

    return {
      ventureCode: code,
      generatedAt: new Date().toISOString(),
      initiatives,
      responsibilities,
      recentGitActivity,
      counts: {
        initiatives: initiatives.length,
        responsibilities: responsibilities.length,
        recentGitActivity: recentGitActivity.length,
      },
    };
  }
}
