import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import type { Actor } from '@uza/contracts';
import { CurrentActor } from '../platform/auth/current-actor.decorator';
import { CommentService } from './comment/comment.service';
import { BlockerService } from './blocker/blocker.service';
import { DigestService } from './digest/digest.service';
import { COMMENT_SUBJECTS } from './umurimo-access';

const COMMENT_KIND = ['comment', 'request'] as const;

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
