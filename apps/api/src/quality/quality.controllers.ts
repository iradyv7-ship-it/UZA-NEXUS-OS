import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { Actor } from '@uza/contracts';
import { CurrentActor } from '../platform/auth/current-actor.decorator';
import { VisitService } from './visit/visit.service';
import { InspectionService } from './inspection/inspection.service';
import { CapaService } from './capa/capa.service';
import type { InspectionStage } from './inspection/inspection.types';

const STAGES: readonly InspectionStage[] = [
  'pre_production',
  'during_production',
  'pre_shipment',
  'warehouse',
];
const EVIDENCE_KINDS = ['photo', 'video', 'measurement'] as const;

class AssignVisitDto {
  @ApiProperty() @IsString() poRef!: string;
  @ApiProperty() @IsString() inspectorId!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() clientRequestId?: string;
}

class EvidenceDto {
  @ApiProperty({ enum: EVIDENCE_KINDS }) @IsIn(EVIDENCE_KINDS) kind!:
    'photo' | 'video' | 'measurement';
  @ApiProperty() @IsString() uri!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() lotRef?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() packageRef?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() note?: string;
}

class RecordInspectionDto {
  @ApiProperty() @IsString() visitRef!: string;
  @ApiProperty({ enum: STAGES }) @IsIn(STAGES) stage!: InspectionStage;
  @ApiProperty() @IsInt() @Min(0) critical!: number;
  @ApiProperty() @IsInt() @Min(0) major!: number;
  @ApiProperty() @IsInt() @Min(0) minor!: number;
  @ApiProperty({ required: false, type: [EvidenceDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EvidenceDto)
  evidence?: EvidenceDto[];
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() capturedOffline?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsString() clientRequestId?: string;
}

class DraftCapaDto {
  @ApiProperty() @IsString() @MinLength(1) text!: string;
  @ApiProperty() @IsString() draftedBy!: string;
}

class CloseCapaDto {
  @ApiProperty() @IsString() reinspectionRef!: string;
}

@ApiTags('quality: visits')
@ApiBearerAuth()
@Controller('visits')
export class VisitController {
  constructor(private readonly visits: VisitService) {}

  @Post()
  @ApiOperation({ summary: 'Assign a factory visit; notifies the inspector (visit:create)' })
  assign(@CurrentActor() actor: Actor, @Body() dto: AssignVisitDto) {
    return this.visits.assign(actor, dto);
  }

  @Get(':ref')
  @ApiOperation({ summary: 'Read a visit + inspections (visit:read)' })
  read(@CurrentActor() actor: Actor, @Param('ref') ref: string) {
    return this.visits.read(actor, ref);
  }
}

@ApiTags('quality: inspections')
@ApiBearerAuth()
@Controller('inspections')
export class InspectionController {
  constructor(private readonly inspections: InspectionService) {}

  @Post()
  @ApiOperation({
    summary: 'Record an inspection; a critical defect fails + opens a CAPA (inspection:create)',
  })
  record(@CurrentActor() actor: Actor, @Body() dto: RecordInspectionDto) {
    return this.inspections.record(actor, dto);
  }

  @Get('po/:poRef/releasable')
  @ApiOperation({
    summary: 'QC release gate: throws GATE_QC_NOT_RELEASED if any CAPA is open (inspection:read)',
  })
  async releasable(@CurrentActor() actor: Actor, @Param('poRef') poRef: string) {
    await this.inspections.assertReleasable(actor, poRef);
    return { poRef, releasable: true };
  }

  @Get(':ref')
  @ApiOperation({ summary: 'Read an inspection + evidence (inspection:read)' })
  read(@CurrentActor() actor: Actor, @Param('ref') ref: string) {
    return this.inspections.read(actor, ref);
  }
}

@ApiTags('quality: capas')
@ApiBearerAuth()
@Controller('capas')
export class CapaController {
  constructor(private readonly capas: CapaService) {}

  @Post(':ref/draft')
  @ApiOperation({ summary: 'Draft a corrective action; does not close (capa:update)' })
  draft(@CurrentActor() actor: Actor, @Param('ref') ref: string, @Body() dto: DraftCapaDto) {
    return this.capas.draftCorrectiveAction(actor, ref, dto.text, dto.draftedBy);
  }

  @Post(':ref/close')
  @ApiOperation({
    summary: 'Close a CAPA against a passing reinspection; human-only (capa:approve)',
  })
  close(@CurrentActor() actor: Actor, @Param('ref') ref: string, @Body() dto: CloseCapaDto) {
    return this.capas.close(actor, ref, dto.reinspectionRef);
  }

  @Get(':ref')
  @ApiOperation({ summary: 'Read a CAPA (capa:read)' })
  read(@CurrentActor() actor: Actor, @Param('ref') ref: string) {
    return this.capas.read(actor, ref);
  }
}

export const QUALITY_CONTROLLERS = [VisitController, InspectionController, CapaController];
