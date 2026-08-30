import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { Actor } from '@uza/contracts';
import { CurrentActor } from '../platform/auth/current-actor.decorator';
import { CommentService } from './comment/comment.service';
import { BlockerService } from './blocker/blocker.service';
import { DigestService } from './digest/digest.service';
import { WeekService } from './week/week.service';
import { WorkspaceService } from './workspace/workspace.service';
import { COMMENT_SUBJECTS } from './umurimo-access';

const COMMENT_KIND = ['comment', 'request'] as const;
const OBJECTIVE_STATUS = ['todo', 'done', 'dropped'] as const;
const OBJECTIVE_SOURCE = ['minutes', 'self'] as const;
const TASK_STATUS = ['todo', 'in_progress', 'done'] as const;

// ---------- DTOs ----------
class PostCommentDto {
  @IsIn(COMMENT_SUBJECTS) subjectType!: (typeof COMMENT_SUBJECTS)[number];
  @IsString() @MinLength(1) subjectRef!: string;
  @IsString() @MinLength(1) body!: string;
  @IsOptional() @IsIn(COMMENT_KIND) kind?: (typeof COMMENT_KIND)[number];
  @IsOptional() @IsString() parentRef?: string;
}
class EditCommentDto {
  @IsString() @MinLength(1) body!: string;
}
class ResolveCommentDto {
  @IsOptional() @IsString() note?: string;
}
class RaiseBlockerDto {
  @IsString() @MinLength(1) reportRef!: string;
  @IsString() @MinLength(1) summary!: string;
}
class OwnBlockerDto {
  @IsString() @MinLength(1) ownerId!: string;
  @IsDateString() dueAt!: string;
}
class ClearBlockerDto {
  @IsString() @MinLength(1) note!: string;
}
class WeekQuery {
  @IsOptional() @IsDateString() week?: string;
}
class MinuteEntryDto {
  @IsString() @MinLength(1) ownerId!: string;
  @IsOptional() @IsString() shipped?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) blocked?: string[];
  @IsOptional() @IsString() asking?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) committed?: string[];
}
class IngestMinutesDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => MinuteEntryDto) entries!: MinuteEntryDto[];
  @IsOptional() @IsDateString() week?: string;
}
class ObjectiveDto {
  @IsString() @MinLength(1) text!: string;
  @IsIn(OBJECTIVE_STATUS) status!: (typeof OBJECTIVE_STATUS)[number];
  @IsIn(OBJECTIVE_SOURCE) source!: (typeof OBJECTIVE_SOURCE)[number];
  @IsOptional() @IsString() note?: string;
}
class ConfirmWeekDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => ObjectiveDto) objectives!: ObjectiveDto[];
  @IsOptional() @IsDateString() week?: string;
}
class PushTaskDto {
  @IsString() @MinLength(1) externalId!: string;
  @IsString() @MinLength(1) title!: string;
  @IsIn(TASK_STATUS) status!: (typeof TASK_STATUS)[number];
  @IsOptional() @IsString() assigneeEmail?: string;
  @IsOptional() @IsString() project?: string;
  @IsOptional() @IsString() priority?: string;
  @IsOptional() @IsString() url?: string;
  @IsOptional() @IsDateString() createdAt?: string;
  @IsOptional() @IsDateString() deadline?: string;
  @IsOptional() @IsDateString() completedAt?: string;
  @IsOptional() @IsString() completionNote?: string;
}
class PushTasksDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => PushTaskDto) tasks!: PushTaskDto[];
}
class FileReportDto {
  @IsString() @MinLength(1) highlights!: string;
  @IsOptional() @IsString() blockers?: string;
  @IsOptional() @IsString() nextWeek?: string;
  @IsOptional() @IsString() asking?: string;
  @IsOptional() @IsDateString() week?: string;
}

/**
 * Comments on a record. Not a chat API — every route requires a subject from the allowlist,
 * so there is no endpoint that accepts a message which is not about a piece of work.
 */
@ApiTags('umurimo')
@ApiBearerAuth()
@Controller('umurimo/comments')
export class UmurimoCommentController {
  constructor(private readonly comments: CommentService) {}

  @Post()
  post(@CurrentActor() actor: Actor, @Body() dto: PostCommentDto) {
    return this.comments.post(actor, dto);
  }

  @Get(':subjectType/:subjectRef')
  thread(
    @CurrentActor() actor: Actor,
    @Param('subjectType') subjectType: string,
    @Param('subjectRef') subjectRef: string,
  ) {
    return this.comments.thread(actor, subjectType, subjectRef);
  }

  @Patch(':ref')
  edit(@CurrentActor() actor: Actor, @Param('ref') ref: string, @Body() dto: EditCommentDto) {
    return this.comments.edit(actor, ref, dto.body);
  }

  @Patch(':ref/resolve')
  resolve(@CurrentActor() actor: Actor, @Param('ref') ref: string, @Body() dto: ResolveCommentDto) {
    return this.comments.resolve(actor, ref, dto.note);
  }
}

/** Blockers raised in a weekly review, and the two queries that keep the meeting honest. */
@ApiTags('umurimo')
@ApiBearerAuth()
@Controller('umurimo/blockers')
export class UmurimoBlockerController {
  constructor(private readonly blockers: BlockerService) {}

  @Post()
  raise(@CurrentActor() actor: Actor, @Body() dto: RaiseBlockerDto) {
    return this.blockers.raise(actor, dto.reportRef, dto.summary);
  }

  /** Raised but not assigned — the set that must be empty before the meeting ends. */
  @Get('unowned')
  unowned(@CurrentActor() actor: Actor) {
    return this.blockers.unowned(actor);
  }

  /** Assigned, dated, and past the date. A different failure from `unowned`. */
  @Get('overdue')
  overdue(@CurrentActor() actor: Actor) {
    return this.blockers.overdue(actor);
  }

  /** What I owe. */
  @Get('mine')
  mine(@CurrentActor() actor: Actor) {
    return this.blockers.mine(actor);
  }

  @Get('week')
  week(@CurrentActor() actor: Actor, @Query() q: WeekQuery) {
    return this.blockers.week(actor, q.week ? new Date(q.week) : undefined);
  }

  @Patch(':ref/own')
  own(@CurrentActor() actor: Actor, @Param('ref') ref: string, @Body() dto: OwnBlockerDto) {
    return this.blockers.own(actor, ref, dto.ownerId, new Date(dto.dueAt));
  }

  @Patch(':ref/clear')
  clear(@CurrentActor() actor: Actor, @Param('ref') ref: string, @Body() dto: ClearBlockerDto) {
    return this.blockers.clear(actor, ref, dto.note);
  }
}

/** The one read the weekly meeting is run against. */
@ApiTags('umurimo')
@ApiBearerAuth()
@Controller('umurimo/digest')
export class UmurimoDigestController {
  constructor(private readonly digest: DigestService) {}

  @Get()
  week(@CurrentActor() actor: Actor, @Query() q: WeekQuery) {
    return this.digest.week(actor, q.week ? new Date(q.week) : undefined);
  }
}

/**
 * The weekly loop: minutes in, plans out, reports back.
 *
 * `POST /umurimo/week/minutes` is the one the meeting uses — the whole review lands in a single
 * call so nobody retypes anything, which is the only way minutes ever reach a system.
 */
@ApiTags('umurimo')
@ApiBearerAuth()
@Controller('umurimo/week')
export class UmurimoWeekController {
  constructor(private readonly week: WeekService) {}

  /** Post the minutes of a weekly review. Idempotent per person per week. */
  @Post('minutes')
  minutes(@CurrentActor() actor: Actor, @Body() dto: IngestMinutesDto) {
    return this.week.ingestMinutes(actor, dto.entries, dto.week ? new Date(dto.week) : undefined);
  }

  /** My week — what I owe, what I am owed, and whether I still have to agree to it. */
  @Get('mine')
  mine(@CurrentActor() actor: Actor, @Query() q: WeekQuery) {
    return this.week.myWeek(actor, q.week ? new Date(q.week) : undefined);
  }

  /** Add, edit or drop my objectives. This is the act that turns minutes into my plan. */
  @Patch('mine')
  confirm(@CurrentActor() actor: Actor, @Body() dto: ConfirmWeekDto) {
    return this.week.confirmWeek(actor, dto.objectives, dto.week ? new Date(dto.week) : undefined);
  }

  /** File my weekly report. */
  @Post('report')
  report(@CurrentActor() actor: Actor, @Body() dto: FileReportDto) {
    return this.week.fileReport(actor, dto, dto.week ? new Date(dto.week) : undefined);
  }

  /** My week, scored against what I said I would do. Visible to me, always. */
  @Get('scorecard')
  scorecard(@CurrentActor() actor: Actor, @Query() q: WeekQuery) {
    return this.week.scorecard(actor, q.week ? new Date(q.week) : undefined);
  }

  /** What the system should be asking for, and of whom. Includes the founder. */
  @Get('nudges')
  nudges(@CurrentActor() actor: Actor, @Query() q: WeekQuery) {
    return this.week.nudges(actor, q.week ? new Date(q.week) : undefined);
  }
}

/**
 * The bridge from the team workspace. Push in, read out, never write back.
 */
@ApiTags('umurimo')
@ApiBearerAuth()
@Controller('umurimo/workspace')
export class UmurimoWorkspaceController {
  constructor(private readonly workspace: WorkspaceService) {}

  /** Receive a batch of tasks. Idempotent on externalId. Unmatched assignees are returned. */
  @Post('tasks')
  push(@CurrentActor() actor: Actor, @Body() dto: PushTasksDto) {
    return this.workspace.pushTasks(actor, dto.tasks);
  }

  /** My open tasks, as the workspace knows them. */
  @Get('mine')
  mine(@CurrentActor() actor: Actor) {
    return this.workspace.mine(actor);
  }

  /** Is the bridge alive, and is anybody's work invisible to it? */
  @Get('health')
  health(@CurrentActor() actor: Actor) {
    return this.workspace.health(actor);
  }
}
