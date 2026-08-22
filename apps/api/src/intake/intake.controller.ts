import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import type { Actor } from '@uza/contracts';
import { CurrentActor } from '../platform/auth/current-actor.decorator';
import { IntakeService } from './intake.service';
import { TriageService } from './triage.service';

const SOURCES = ['claude_code', 'artifact', 'email', 'manual'] as const;
const STATUSES = ['new', 'triaged', 'promoted', 'dismissed'] as const;

class ListQuery {
  @IsOptional() @IsIn(STATUSES) status?: (typeof STATUSES)[number];
  @IsOptional() @IsIn(SOURCES) source?: (typeof SOURCES)[number];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}
class AddDto {
  @IsString() @MinLength(1) title!: string;
  @IsString() @MinLength(1) body!: string;
}
class PromoteDto {
  @IsString() @MinLength(1) promotedRef!: string;
}
class DismissDto {
  @IsString() @MinLength(1) reason!: string;
}

@ApiTags('intake')
@ApiBearerAuth()
@Controller('intake/signals')
export class IntakeController {
  constructor(
    private readonly intake: IntakeService,
    private readonly triage: TriageService,
  ) {}

  @Get()
  list(@CurrentActor() actor: Actor, @Query() q: ListQuery) {
    return this.intake.list(actor, q);
  }

  /** How much is waiting and how stale it is. Static paths precede `:ref`. */
  @Get('queue')
  queue(@CurrentActor() actor: Actor) {
    return this.intake.queue(actor);
  }

  @Post()
  add(@CurrentActor() actor: Actor, @Body() dto: AddDto) {
    return this.intake.add(actor, dto);
  }

  /** Run every configured source now, rather than waiting for the schedule. */
  @Post('sweep')
  async sweep(@CurrentActor() actor: Actor) {
    await this.intake.list(actor, { limit: 1 }); // role gate, and it audits the access
    return this.intake.sweep();
  }

  @Post('triage')
  runTriage(@CurrentActor() actor: Actor) {
    return this.triage.run(actor);
  }

  @Get(':ref')
  read(@CurrentActor() actor: Actor, @Param('ref') ref: string) {
    return this.intake.read(actor, ref);
  }

  /**
   * Record that a person turned this into something. Nexus does not create the initiative
   * or the decision here — you create it, then say what you created.
   */
  @Post(':ref/promote')
  promote(@CurrentActor() actor: Actor, @Param('ref') ref: string, @Body() dto: PromoteDto) {
    return this.intake.promote(actor, ref, dto);
  }

  @Post(':ref/dismiss')
  dismiss(@CurrentActor() actor: Actor, @Param('ref') ref: string, @Body() dto: DismissDto) {
    return this.intake.dismiss(actor, ref, dto.reason);
  }

  /** CEO only. There is no reverse of this. */
  @Post(':ref/share')
  share(@CurrentActor() actor: Actor, @Param('ref') ref: string) {
    return this.intake.share(actor, ref);
  }
}
