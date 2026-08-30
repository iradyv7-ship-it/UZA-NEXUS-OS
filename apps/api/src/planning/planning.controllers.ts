import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { Actor } from '@uza/contracts';
import { CurrentActor } from '../platform/auth/current-actor.decorator';
import { InitiativeService } from './initiative/initiative.service';
import { DecisionService } from './decision/decision.service';
import { ReviewService } from './review/review.service';
import { AdvisorService } from './advisor/advisor.service';
import { ResponsibilityService } from './responsibility/responsibility.service';
import { EstateService } from './estate/estate.service';
import { MemoService } from './memo/memo.service';
import { FundingService } from './funding/funding.service';

const ATTENTION = ['runs', 'holds', 'parked'] as const;
const INITIATIVE_KIND = ['client', 'internal', 'venture'] as const;
const FUND_INSTRUMENT = ['grant', 'concessional', 'debt', 'revolver', 'facility', 'equity', 'offtake'] as const;
const FUND_STAGE = ['identified', 'qualifying', 'preparing', 'submitted', 'in_diligence', 'approved', 'closed', 'declined', 'parked'] as const;
const SYS_KIND = ['repository', 'web_app', 'mobile_app', 'backend', 'admin_panel', 'prototype', 'document'] as const;
const SYS_STATUS = ['live', 'building', 'prototype', 'dormant', 'retired'] as const;
const SYS_VIS = ['public', 'private', 'unknown'] as const;
const CHECK_OUTCOME = ['pass', 'fail', 'not_applicable', 'not_run'] as const;
const MEMO_AUDIENCE = ['everyone', 'department', 'person'] as const;
const RESP_KIND = ['standing', 'gate', 'approval'] as const;
const RESP_TRIGGER = ['per_shipment', 'per_deal', 'per_request', 'daily', 'weekly', 'monthly', 'ad_hoc'] as const;
const INITIATIVE_STATUS = ['active', 'paused', 'done', 'cancelled'] as const;

// ---------- DTOs ----------
class CreateInitiativeDto {
  @IsString() @MinLength(1) name!: string;
  @IsIn(INITIATIVE_KIND) kind!: (typeof INITIATIVE_KIND)[number];
  @IsString() ownerId!: string;
  @IsOptional() @IsString() ventureCode?: string;
  @IsOptional() @IsString() clientName?: string;
  @IsOptional() @IsString() departmentCode?: string;
  @IsOptional() @IsIn(ATTENTION) attention?: (typeof ATTENTION)[number];
  @IsOptional() @IsString() nextAction?: string;
  @IsOptional() @IsDateString() reviewAt?: string;
  @IsOptional() @IsString() artifactUrl?: string;
  @IsOptional() @IsDateString() targetDate?: string;
}
class UpdateInitiativeDto {
  @IsOptional() @IsIn(ATTENTION) attention?: (typeof ATTENTION)[number];
  @IsOptional() @IsIn(INITIATIVE_STATUS) status?: (typeof INITIATIVE_STATUS)[number];
  @IsOptional() @IsString() ownerId?: string;
  @IsOptional() @IsString() nextAction?: string;
  @IsOptional() @IsDateString() reviewAt?: string;
  @IsOptional() @IsString() artifactUrl?: string;
}
class ListInitiativeQuery {
  @IsOptional() @IsIn(ATTENTION) attention?: (typeof ATTENTION)[number];
  @IsOptional() @IsString() ventureCode?: string;
  @IsOptional() @IsString() ownerId?: string;
}
class CheckinDto {
  @IsString() @MinLength(1) moved!: string;
  @IsOptional() @IsString() blocked?: string;
  @IsOptional() @IsString() needsFromCeo?: string;
  @IsOptional() @IsDateString() weekOf?: string;
}

class RaiseDecisionDto {
  @IsString() @MinLength(1) question!: string;
  @IsOptional() @IsString() context?: string;
  @IsOptional() @IsString() initiativeRef?: string;
}
class AnswerDecisionDto {
  @IsString() @MinLength(1) answer!: string;
}
class DeferDecisionDto {
  @IsDateString() deferredTo!: string;
}

class WeekQuery {
  @IsOptional() @IsDateString() week?: string;
}

class AdvisorTurnDto {
  @IsIn(['user', 'assistant']) role!: 'user' | 'assistant';
  @IsString() content!: string;
}
class AskDto {
  @IsString() @MinLength(1) question!: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AdvisorTurnDto)
  history?: AdvisorTurnDto[];
}

class CreateResponsibilityDto {
  @IsString() @MinLength(1) name!: string;
  @IsIn(RESP_KIND) kind!: (typeof RESP_KIND)[number];
  @IsString() ownerId!: string;
  @IsOptional() @IsString() backupId?: string;
  @IsOptional() @IsString() ventureCode?: string;
  @IsOptional() @IsIn(RESP_TRIGGER) trigger?: (typeof RESP_TRIGGER)[number];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) responseHours?: number;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsDateString() startsOn?: string;
}
class UpdateResponsibilityDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsIn(RESP_KIND) kind?: (typeof RESP_KIND)[number];
  @IsOptional() @IsString() ownerId?: string;
  @IsOptional() @IsString() backupId?: string;
  @IsOptional() @IsIn(RESP_TRIGGER) trigger?: (typeof RESP_TRIGGER)[number];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) responseHours?: number;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
class ListResponsibilityQuery {
  @IsOptional() @IsString() ventureCode?: string;
  @IsOptional() @IsIn(RESP_KIND) kind?: (typeof RESP_KIND)[number];
}

class CreateSystemDto {
  @IsString() @MinLength(1) name!: string;
  @IsIn(SYS_KIND) kind!: (typeof SYS_KIND)[number];
  @IsString() ownerId!: string;
  @IsOptional() @IsString() ventureCode?: string;
  @IsOptional() @IsIn(SYS_STATUS) status?: (typeof SYS_STATUS)[number];
  @IsOptional() @IsString() repoUrl?: string;
  @IsOptional() @IsString() liveUrl?: string;
  @IsOptional() @IsIn(SYS_VIS) visibility?: (typeof SYS_VIS)[number];
  @IsOptional() @IsDateString() lastPushAt?: string;
  @IsOptional() @IsString() supersededBy?: string;
  @IsOptional() @IsString() initiativeRef?: string;
  @IsOptional() @IsString() notes?: string;
}
class RecordVerificationDto {
  @IsOptional() @IsDateString() verifiedAt?: string;
  @IsOptional() @IsIn(CHECK_OUTCOME) typecheck?: (typeof CHECK_OUTCOME)[number];
  @IsOptional() @IsIn(CHECK_OUTCOME) tests?: (typeof CHECK_OUTCOME)[number];
  @IsOptional() @IsIn(CHECK_OUTCOME) imageBuilds?: (typeof CHECK_OUTCOME)[number];
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) testsPassed?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) testsTotal?: number;
  @IsOptional() @IsString() gaps?: string;
  @IsString() @MinLength(1) verifiedBy!: string;
  @IsOptional() @IsString() notes?: string;
}
class UpdateSystemDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsIn(SYS_STATUS) status?: (typeof SYS_STATUS)[number];
  @IsOptional() @IsString() ownerId?: string;
  @IsOptional() @IsString() ventureCode?: string;
  @IsOptional() @IsIn(SYS_VIS) visibility?: (typeof SYS_VIS)[number];
  @IsOptional() @IsString() supersededBy?: string;
  @IsOptional() @IsString() notes?: string;
}
class ListSystemQuery {
  @IsOptional() @IsString() ventureCode?: string;
  @IsOptional() @IsIn(SYS_STATUS) status?: (typeof SYS_STATUS)[number];
}

class SendMemoDto {
  @IsString() @MinLength(1) subject!: string;
  @IsString() @MinLength(1) body!: string;
  @IsIn(MEMO_AUDIENCE) audience!: (typeof MEMO_AUDIENCE)[number];
  @IsOptional() @IsString() departmentCode?: string;
  @IsOptional() @IsString() toId?: string;
  @IsOptional() @IsString() ventureCode?: string;
  @IsOptional() @IsBoolean() needsAck?: boolean;
  @IsOptional() @IsString() linkedRef?: string;
}

class CreateFundingDto {
  @IsString() @MinLength(1) name!: string;
  @IsIn(FUND_INSTRUMENT) instrument!: (typeof FUND_INSTRUMENT)[number];
  @IsString() @MinLength(1) funder!: string;
  @Type(() => Number) @IsNumber() @Min(1) amountSought!: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() ventureCode?: string;
  @IsString() ownerId!: string;
  @IsOptional() @IsIn(FUND_STAGE) stage?: (typeof FUND_STAGE)[number];
  @IsOptional() @IsArray() @IsString({ each: true }) unlocks?: string[];
  @IsOptional() @IsString() evidence?: string;
  @IsOptional() @IsString() blocker?: string;
  @IsOptional() @IsDateString() decisionBy?: string;
  @IsOptional() @IsString() grantRef?: string;
}
class UpdateFundingDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsIn(FUND_STAGE) stage?: (typeof FUND_STAGE)[number];
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) amountSought?: number;
  @IsOptional() @IsString() ownerId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) unlocks?: string[];
  @IsOptional() @IsString() evidence?: string;
  @IsOptional() @IsString() blocker?: string;
  @IsOptional() @IsDateString() decisionBy?: string;
}
class ListFundingQuery {
  @IsOptional() @IsString() ventureCode?: string;
  @IsOptional() @IsIn(FUND_STAGE) stage?: (typeof FUND_STAGE)[number];
}

const date = (v?: string): Date | undefined => (v ? new Date(v) : undefined);

@ApiTags('planning')
@ApiBearerAuth()
@Controller('planning/initiatives')
export class PlanningInitiativeController {
  constructor(private readonly initiatives: InitiativeService) {}

  @Post()
  create(@CurrentActor() actor: Actor, @Body() dto: CreateInitiativeDto) {
    return this.initiatives.create(actor, {
      ...dto,
      reviewAt: date(dto.reviewAt),
      targetDate: date(dto.targetDate),
    });
  }
  @Get()
  list(@CurrentActor() actor: Actor, @Query() q: ListInitiativeQuery) {
    return this.initiatives.list(actor, q);
  }
  /** Placed before `:ref` so "missing-checkins" is not read as an initiative ref. */
  @Get('missing-checkins')
  missing(@CurrentActor() actor: Actor) {
    return this.initiatives.missingCheckins(actor);
  }
  @Get(':ref')
  read(@CurrentActor() actor: Actor, @Param('ref') ref: string) {
    return this.initiatives.byRef(actor, ref);
  }
  @Patch(':ref')
  update(@CurrentActor() actor: Actor, @Param('ref') ref: string, @Body() dto: UpdateInitiativeDto) {
    return this.initiatives.update(actor, ref, { ...dto, reviewAt: date(dto.reviewAt) });
  }
  @Post(':ref/checkin')
  checkin(@CurrentActor() actor: Actor, @Param('ref') ref: string, @Body() dto: CheckinDto) {
    return this.initiatives.checkin(actor, { ...dto, initiativeRef: ref, weekOf: date(dto.weekOf) });
  }
}

@ApiTags('planning')
@ApiBearerAuth()
@Controller('planning/decisions')
export class PlanningDecisionController {
  constructor(private readonly decisions: DecisionService) {}

  @Post()
  raise(@CurrentActor() actor: Actor, @Body() dto: RaiseDecisionDto) {
    return this.decisions.raise(actor, dto);
  }
  @Get()
  open(@CurrentActor() actor: Actor) {
    return this.decisions.open(actor);
  }
  @Get('bottleneck')
  bottleneck(@CurrentActor() actor: Actor) {
    return this.decisions.bottleneck(actor);
  }
  @Post(':ref/answer')
  answer(@CurrentActor() actor: Actor, @Param('ref') ref: string, @Body() dto: AnswerDecisionDto) {
    return this.decisions.answer(actor, ref, dto);
  }
  @Post(':ref/defer')
  defer(@CurrentActor() actor: Actor, @Param('ref') ref: string, @Body() dto: DeferDecisionDto) {
    return this.decisions.defer(actor, ref, { deferredTo: new Date(dto.deferredTo) });
  }
}

@ApiTags('planning')
@ApiBearerAuth()
@Controller('planning/responsibilities')
export class PlanningResponsibilityController {
  constructor(private readonly responsibilities: ResponsibilityService) {}

  @Post()
  create(@CurrentActor() actor: Actor, @Body() dto: CreateResponsibilityDto) {
    return this.responsibilities.create(actor, { ...dto, startsOn: date(dto.startsOn) });
  }
  @Get()
  list(@CurrentActor() actor: Actor, @Query() q: ListResponsibilityQuery) {
    return this.responsibilities.list(actor, q);
  }
  /** Where the organisation is concentrated, and where it has no backup. Before `:userRef`. */
  @Get('concentration')
  concentration(@CurrentActor() actor: Actor) {
    return this.responsibilities.concentration(actor);
  }
  @Get('person/:userRef')
  forPerson(@CurrentActor() actor: Actor, @Param('userRef') userRef: string) {
    return this.responsibilities.forPerson(actor, userRef);
  }
  @Patch(':ref')
  update(@CurrentActor() actor: Actor, @Param('ref') ref: string, @Body() dto: UpdateResponsibilityDto) {
    return this.responsibilities.update(actor, ref, dto);
  }
}

@ApiTags('planning')
@ApiBearerAuth()
@Controller('planning/systems')
export class PlanningEstateController {
  constructor(private readonly estate: EstateService) {}

  @Post()
  create(@CurrentActor() actor: Actor, @Body() dto: CreateSystemDto) {
    return this.estate.create(actor, { ...dto, lastPushAt: date(dto.lastPushAt) });
  }
  @Get()
  list(@CurrentActor() actor: Actor, @Query() q: ListSystemQuery) {
    return this.estate.list(actor, q);
  }
  /** Duplicates, public source and silence — derived, not typed in. Before `:ref`. */
  @Get('health')
  health(@CurrentActor() actor: Actor) {
    return this.estate.health(actor);
  }
  /**
   * Where every system stands: last measured run, whether it is still current, and
   * what is built but not connected. Before `:ref`, or the router reads it as a ref.
   */
  @Get('readiness')
  readiness(@CurrentActor() actor: Actor) {
    return this.estate.readiness(actor);
  }
  @Post(':ref/verifications')
  verify(
    @CurrentActor() actor: Actor,
    @Param('ref') ref: string,
    @Body() dto: RecordVerificationDto,
  ) {
    return this.estate.recordVerification(actor, {
      ...dto,
      systemRef: ref,
      verifiedAt: date(dto.verifiedAt),
    });
  }
  @Patch(':ref')
  update(@CurrentActor() actor: Actor, @Param('ref') ref: string, @Body() dto: UpdateSystemDto) {
    return this.estate.update(actor, ref, dto);
  }
}

@ApiTags('planning')
@ApiBearerAuth()
@Controller('planning/memos')
export class PlanningMemoController {
  constructor(private readonly memos: MemoService) {}

  @Post()
  send(@CurrentActor() actor: Actor, @Body() dto: SendMemoDto) {
    return this.memos.send(actor, dto);
  }
  @Get()
  inbox(@CurrentActor() actor: Actor) {
    return this.memos.inbox(actor);
  }
  @Get('sent')
  sent(@CurrentActor() actor: Actor) {
    return this.memos.sent(actor);
  }
  @Get(':ref/receipts')
  receipts(@CurrentActor() actor: Actor, @Param('ref') ref: string) {
    return this.memos.receipts(actor, ref);
  }
  @Post(':ref/read')
  read(@CurrentActor() actor: Actor, @Param('ref') ref: string) {
    return this.memos.markRead(actor, ref);
  }
  @Post(':ref/ack')
  ack(@CurrentActor() actor: Actor, @Param('ref') ref: string) {
    return this.memos.acknowledge(actor, ref);
  }
}

@ApiTags('planning')
@ApiBearerAuth()
@Controller('planning/funding')
export class PlanningFundingController {
  constructor(private readonly funding: FundingService) {}

  @Post()
  create(@CurrentActor() actor: Actor, @Body() dto: CreateFundingDto) {
    return this.funding.create(actor, { ...dto, decisionBy: date(dto.decisionBy) });
  }
  @Get()
  list(@CurrentActor() actor: Actor, @Query() q: ListFundingQuery) {
    return this.funding.list(actor, q);
  }
  /** Which money releases which work. Static path, so it precedes `:ref`. */
  @Get('unlocks')
  unlocks(@CurrentActor() actor: Actor) {
    return this.funding.unlockMap(actor);
  }
  /** One venture, presentable on its own — nothing from any other venture is returned. */
  @Get('venture/:code')
  venture(@CurrentActor() actor: Actor, @Param('code') code: string) {
    return this.funding.byVenture(actor, code.toUpperCase());
  }
  @Patch(':ref')
  update(@CurrentActor() actor: Actor, @Param('ref') ref: string, @Body() dto: UpdateFundingDto) {
    return this.funding.update(actor, ref, { ...dto, decisionBy: date(dto.decisionBy) });
  }
}

@ApiTags('planning')
@ApiBearerAuth()
@Controller('planning/review')
export class PlanningReviewController {
  constructor(
    private readonly review: ReviewService,
    private readonly advisor: AdvisorService,
  ) {}

  @Get()
  weekly(@CurrentActor() actor: Actor, @Query() q: WeekQuery) {
    return this.review.weekly(actor, date(q.week));
  }
  /** The same review as plain text — what a weekly email carries, and what the advisor reads. */
  @Get('brief')
  async brief(@CurrentActor() actor: Actor, @Query() q: WeekQuery) {
    return { brief: await this.review.brief(actor, date(q.week)) };
  }
  @Post('ask')
  ask(@CurrentActor() actor: Actor, @Body() dto: AskDto) {
    return this.advisor.ask(actor, dto);
  }
  @Post('read-my-week')
  readMyWeek(@CurrentActor() actor: Actor) {
    return this.advisor.weeklyRead(actor);
  }
}
