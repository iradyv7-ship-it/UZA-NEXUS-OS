import { Module } from '@nestjs/common';
import { AuditService } from '../platform/audit/audit.service';
import { UmurimoAccessService } from './umurimo-authz.service';
import { CommentService } from './comment/comment.service';
import { BlockerService } from './blocker/blocker.service';
import { DigestService } from './digest/digest.service';
import { WeekService } from './week/week.service';
import {
  UmurimoCommentController,
  UmurimoBlockerController,
  UmurimoDigestController,
  UmurimoWeekController,
} from './umurimo.controllers';

/**
 * UMURIMO — the people-and-work layer.
 *
 * Nexus answers "what is the company doing". Umurimo answers "who is doing it, and how are
 * they". Two questions, two audiences, two sets of rules: the register is counterparty-walled
 * (the supplier and the lender must never appear in each other's view), while this module
 * holds employee data, which is a different sensitivity governed by different law.
 *
 * **It is a module inside Nexus, not a separate deployment, and that is deliberate.** It has
 * its own access policy (`umurimo-access.ts`), its own readable ids (`umurimo-ids.ts`) and no
 * direct joins across into planning beyond a ref — so the seam for a future split is already
 * cut. What it does NOT have is its own authentication, user model, database or host, because
 * paying for those before there is a second customer buys nothing. Design for the split; pay
 * for it later.
 *
 * Three things, and nothing more:
 *
 *  - **Comment** — why a record is the way it is, attached to the record. Not chat. Every
 *    comment must name a subject from a fixed allowlist, so there is nowhere to put a message
 *    that is not about a specific piece of work. The rule: if the message would be meaningless
 *    without knowing which record it concerns, it belongs here; otherwise it belongs in
 *    WhatsApp, and a system that tries to replace WhatsApp loses in three weeks and leaves a
 *    register that is wrong, which is worse than none.
 *
 *  - **Blocker** — with a NULLABLE owner and due date, both surfaced. The schema previously
 *    held blockers as prose on `WeeklyReport.blockers`, which cannot be queried for an absent
 *    owner. This table exists so "nothing leaves the meeting unassigned" is checkable in ten
 *    seconds rather than by re-reading the minutes.
 *
 *  - **Digest** — the weekly read. Deliberately separate from `ReviewService`, which answers
 *    the same four questions about initiatives. Merging a work dashboard with a people
 *    dashboard produces a screen that ranks humans by proxy, and this module is explicitly not
 *    that: it reports upward on work, never on people.
 *
 * `WeeklyReport` is NOT redefined here. Planning already owns it; this module added one column
 * (`asking`) and relates to it. Two tables called WeeklyReport would disagree within a month.
 *
 * Authorisation is the module-local `UMURIMO_ACCESS` policy, enforced at the SERVICE layer and
 * audited into the same append-only log as the platform and planning gates. PrismaService is
 * global.
 */
@Module({
  providers: [
    AuditService,
    UmurimoAccessService,
    CommentService,
    BlockerService,
    DigestService,
    WeekService,
  ],
  controllers: [
    UmurimoCommentController,
    UmurimoBlockerController,
    UmurimoDigestController,
    UmurimoWeekController,
  ],
  exports: [CommentService, BlockerService, DigestService, WeekService],
})
export class UmurimoModule {}
