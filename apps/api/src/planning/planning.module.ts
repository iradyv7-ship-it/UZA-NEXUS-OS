import { Module } from '@nestjs/common';
import { AuditService } from '../platform/audit/audit.service';
import { PlanningAccessService } from './planning-authz.service';
import { InitiativeService } from './initiative/initiative.service';
import { DecisionService } from './decision/decision.service';
import { ReviewService } from './review/review.service';
import { ResponsibilityService } from './responsibility/responsibility.service';
import { EstateService } from './estate/estate.service';
import { MemoService } from './memo/memo.service';
import { FundingService } from './funding/funding.service';
import { AdvisorService } from './advisor/advisor.service';
import {
  PlanningInitiativeController,
  PlanningDecisionController,
  PlanningReviewController,
  PlanningResponsibilityController,
  PlanningEstateController,
  PlanningMemoController,
  PlanningFundingController,
} from './planning.controllers';

/**
 * Nexas Planning & Reviews — the register.
 *
 * Five things, and nothing more: what UZA is running (Initiative), who said it moved
 * (InitiativeCheckin), what is waiting on the CEO (ExecDecision), who is permanently on
 * the hook for what (Responsibility), and the one weekly read that derives the rest
 * (ReviewService). AdvisorService puts Claude on top of that same read, so the advisor
 * and the review can never disagree about the state of the business.
 *
 * Responsibility is the one that is not a project. "Francois verifies documents on every
 * shipment" is true continuously and is never finished — as a task it becomes a hundred
 * identical tasks, as an initiative it can never be closed. Keeping it separate is what
 * makes "who covers this when they are away" and "how many approvals sit with one person"
 * answerable at all.
 *
 * Authorisation is the module-local `PLANNING_ACCESS` policy enforced at the SERVICE layer
 * and audited into the shared append-only log. PrismaService is global.
 */
@Module({
  providers: [
    AuditService,
    PlanningAccessService,
    InitiativeService,
    DecisionService,
    ResponsibilityService,
    EstateService,
    MemoService,
    FundingService,
    ReviewService,
    AdvisorService,
  ],
  controllers: [
    PlanningInitiativeController,
    PlanningDecisionController,
    PlanningResponsibilityController,
    PlanningEstateController,
    PlanningMemoController,
    PlanningFundingController,
    PlanningReviewController,
  ],
  exports: [
    InitiativeService,
    DecisionService,
    ResponsibilityService,
    EstateService,
    MemoService,
    FundingService,
    ReviewService,
    AdvisorService,
  ],
})
export class PlanningModule {}
