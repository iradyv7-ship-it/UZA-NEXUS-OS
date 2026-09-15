import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Actor } from '@uza/contracts';
import { CurrentActor } from '../../platform/auth/current-actor.decorator';
import { VentureOverviewService } from './venture-overview.service';

@ApiTags('planning')
@ApiBearerAuth()
@Controller('planning/ventures')
export class PlanningVentureOverviewController {
  constructor(private readonly ventureOverview: VentureOverviewService) {}

  @Get(':code/overview')
  overview(@CurrentActor() actor: Actor, @Param('code') code: string) {
    return this.ventureOverview.overview(actor, code);
  }
}
