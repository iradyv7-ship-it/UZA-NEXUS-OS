import { Module } from '@nestjs/common';
import { AuditService } from '../platform/audit/audit.service';
import { PlanningAccessService } from './planning-authz.service';
import { InitiativeService } from './initiative/initiative.service';
import { DecisionService } from './decision/decision.service';
import { ReviewService } from './review/review.service';
import { AdvisorService } from './advisor/advisor.service';
import {
  PlanningInitiativeController,
  PlanningDecisionController,
  PlanningReviewController,
} from './planning.controllers';

/**
 * Nexas Planning & Reviews — the register.
 *
 * Four things, and nothing more: what UZA is running (Initiative), who said it moved
 * (InitiativeCheckin), what is waiting on the CEO (ExecDecision), and the one weekly read
 * that derives the rest (ReviewService). AdvisorService puts Claude on top of that same
 * read, so the advisor and the review can never disagree about the state of the business.
 *
 * Authorisation is the module-local `PLANNING_ACCESS` policy enforced at the SERVICE layer
 * and audited into the shared append-only log. PrismaService is global.
 */
@Module({
  providers: [AuditService, PlanningAccessService, InitiativeService, DecisionService, ReviewService, AdvisorService],
  controllers: [PlanningInitiativeController, PlanningDecisionController, PlanningReviewController],
  exports: [InitiativeService, DecisionService, ReviewService, AdvisorService],
})
export class PlanningModule {}
