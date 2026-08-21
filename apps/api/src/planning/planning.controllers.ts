import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsDateString, IsIn, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { Actor } from '@uza/contracts';
import { CurrentActor } from '../platform/auth/current-actor.decorator';
import { InitiativeService } from './initiative/initiative.service';
import { DecisionService } from './decision/decision.service';
import { ReviewService } from './review/review.service';
import { AdvisorService } from './advisor/advisor.service';

const ATTENTION = ['runs', 'holds', 'parked'] as const;
const INITIATIVE_KIND = ['client', 'internal', 'venture'] as const;
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
