import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';
import type { Actor } from '@uza/contracts';
import { CurrentActor } from '../auth/current-actor.decorator';
import { UzaIdService } from './uza-id.service';

/**
 * The UZA ID over HTTP — how the satellite systems adopt it.
 *
 * Every other UZA system calls POST /uza-id/resolve when it creates or first sees a
 * person, stores the returned ref next to its own record, and sends it back on anything
 * that later has to be joined up. That is the entire integration: one call, one field.
 *
 * NOTE ON PERSONAL DATA. `resolve` accepts a phone number and a national ID, and it does
 * NOT store either. They are normalised, hashed with a server-side pepper, and the
 * originals are discarded — so this endpoint can be called by a system that legitimately
 * holds them without that data spreading into Nexus. See uza-id.hash.ts.
 */

class ResolveDto {
  @IsString() @MinLength(1) system!: string;
  @IsString() @MinLength(1) externalId!: string;
  @IsString() @MinLength(1) displayName!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() nationalId?: string;
}

class LinkDto {
  @IsString() @MinLength(1) system!: string;
  @IsString() @MinLength(1) externalId!: string;
}

class MergeDto {
  @IsString() @MinLength(1) loserRef!: string;
  @IsString() @MinLength(1) winnerRef!: string;
}

class ConsentDto {
  @IsBoolean() granted!: boolean;
}

@ApiTags('uza-id')
@ApiBearerAuth()
@Controller('uza-id')
export class UzaIdController {
  constructor(private readonly ids: UzaIdService) {}

  /** Idempotent. Same (system, externalId) always returns the same UZA ID. */
  @Post('resolve')
  resolve(@CurrentActor() actor: Actor, @Body() dto: ResolveDto) {
    return this.ids.resolve(actor, dto);
  }

  /** Every system that knows this person, and what it calls them. */
  @Get(':ref/links')
  links(@CurrentActor() actor: Actor, @Param('ref') ref: string) {
    return this.ids.links(actor, ref);
  }

  /** Attach a record to a person a human has confirmed — used after an uncertain match. */
  @Post(':ref/links')
  async link(@CurrentActor() actor: Actor, @Param('ref') ref: string, @Body() dto: LinkDto) {
    await this.ids.link(actor, ref, dto.system, dto.externalId);
    return { ok: true };
  }

  /** Fold two records into one. The loser is tombstoned, never deleted. */
  @Post('merge')
  async merge(@CurrentActor() actor: Actor, @Body() dto: MergeDto) {
    await this.ids.merge(actor, dto.loserRef, dto.winnerRef);
    return { ok: true };
  }

  /** Consent to appear in aggregate impact reporting. Revocable. */
  @Post(':ref/reporting-consent')
  async consent(@CurrentActor() actor: Actor, @Param('ref') ref: string, @Body() dto: ConsentDto) {
    await this.ids.setReportingConsent(actor, ref, dto.granted);
    return { ok: true };
  }
}
