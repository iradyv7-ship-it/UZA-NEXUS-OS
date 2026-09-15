import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Actor } from '@uza/contracts';
import { CurrentActor } from '../platform/auth/current-actor.decorator';
import { PlanningAccessService } from '../planning/planning-authz.service';
import { EmpowerClientService } from './empower-client.service';

const RESOURCE = 'empower';

/**
 * UZA Empower, seen from the operating layer.
 *
 * Read-only, and gated on the same capability that opens the initiative register
 * (`initiative:read` — ceo, venture_manager, finance). Nothing here can write to Empower;
 * decisions and corrections happen in the Mobility admin app, by people with the roles for
 * them. Nexus is where Yves watches the programme move, beside every other venture.
 */
@ApiTags('empower')
@Controller('empower')
export class EmpowerController {
  constructor(
    private readonly client: EmpowerClientService,
    private readonly access: PlanningAccessService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Is the bridge to the Mobility API configured and answering?' })
  async status(@CurrentActor() actor: Actor) {
    await this.access.assertRole(actor, 'initiative:read', RESOURCE, 'status');
    const probe = await this.client.safe<{ generatedAt: string }>('/academy/impact');
    await this.access.allow(actor, RESOURCE, 'status');
    return {
      configured: this.client.configured,
      reachable: probe.ok,
      error: probe.error,
      mobilityApiUrl: process.env.MOBILITY_API_URL ?? null,
    };
  }

  @Get('impact')
  @ApiOperation({
    summary:
      'The academy impact report — delivery, cost, comprehension, repayment comparison, and what is not measured',
  })
  async impact(
    @CurrentActor() actor: Actor,
    @Query('costPerParticipantHourRwf') rate?: string,
    @Query('rwfPerEur') fx?: string,
  ) {
    await this.access.assertRole(actor, 'initiative:read', RESOURCE, 'impact');
    const qs = new URLSearchParams();
    if (rate) qs.set('costPerParticipantHourRwf', rate);
    if (fx) qs.set('rwfPerEur', fx);
    const r = await this.client.safe<unknown>(`/academy/impact${qs.size ? `?${qs}` : ''}`);
    await this.access.allow(actor, RESOURCE, 'impact');
    return r;
  }

  @Get('covenants')
  @ApiOperation({
    summary: 'Every open covenant warning across active Empower loans — UZA’s own view',
  })
  async covenants(@CurrentActor() actor: Actor) {
    await this.access.assertRole(actor, 'initiative:read', RESOURCE, 'covenants');
    const r = await this.client.safe<unknown>('/admin/wallets/covenants');
    await this.access.allow(actor, RESOURCE, 'covenants');
    return r;
  }

  @Get('applications')
  @ApiOperation({ summary: 'Fund applications, newest first, as the intake screen lists them' })
  async applications(@CurrentActor() actor: Actor, @Query('status') status?: string) {
    await this.access.assertRole(actor, 'initiative:read', RESOURCE, 'applications');
    const r = await this.client.safe<unknown>(
      `/financing/fund-applications${status ? `?status=${encodeURIComponent(status)}` : ''}`,
    );
    await this.access.allow(actor, RESOURCE, 'applications');
    return r;
  }
}
