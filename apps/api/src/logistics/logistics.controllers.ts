import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type {
  Actor,
  Destination,
  Minor,
  TrackingSource,
  VarianceDecision,
} from '@uza/contracts';
import { CurrentActor } from '../platform/auth/current-actor.decorator';
import { ReceivingService } from './warehouse/receiving.service';
import { ReleaseService } from './warehouse/release.service';
import { ContainerService } from './logistics/container.service';
import { FreightService } from './logistics/freight.service';
import { TrackingService } from './logistics/tracking.service';
import { DeliveryService } from './logistics/delivery.service';
import { PartnerPortalService } from './logistics/partner-portal.service';

const DESTINATIONS: readonly Destination[] = ['KIGALI', 'GOMA', 'BUKAVU', 'UZA_STOCK', 'OTHER'];
const TRACKING_SOURCES: readonly TrackingSource[] = ['carrier', 'partner', 'uza', 'estimated'];
const VARIANCE_DECISIONS: readonly VarianceDecision[] = ['client_pays', 'uza_absorbs', 'reduce_qty'];

class PackageSpecDto {
  @ApiProperty() @IsNumber() kg!: number;
  @ApiProperty() @IsNumber() cbm!: number;
}

class ReceiveDto {
  @ApiProperty() @IsString() orderRef!: string;
  @ApiProperty() @IsString() customerRef!: string;
  @ApiProperty() @IsString() poRef!: string;
  @ApiProperty() @IsNumber() declaredCbm!: number;
  @ApiProperty() @IsNumber() declaredKg!: number;
  @ApiProperty({ type: [PackageSpecDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PackageSpecDto)
  packages!: PackageSpecDto[];
  @ApiProperty({ required: false }) @IsOptional() @IsString() clientRequestId?: string;
}

class ResolveVarianceDto {
  @ApiProperty() @IsString() lotRef!: string;
  @ApiProperty({ enum: VARIANCE_DECISIONS }) @IsIn(VARIANCE_DECISIONS) decision!: VarianceDecision;
  @ApiProperty({ required: false }) @IsOptional() @IsString() note?: string;
}

class QcReleaseDto {
  @ApiProperty({ type: [String] }) @IsArray() @ArrayNotEmpty() @IsString({ each: true }) packageRefs!: string[];
}

class AllocateDestinationDto {
  @ApiProperty({ type: [String] }) @IsArray() @ArrayNotEmpty() @IsString({ each: true }) packageRefs!: string[];
  @ApiProperty({ enum: DESTINATIONS }) @IsIn(DESTINATIONS) destination!: Destination;
}

class CreateShipmentDto {
  @ApiProperty({ type: [String] }) @IsArray() @ArrayNotEmpty() @IsString({ each: true }) packageRefs!: string[];
  @ApiProperty() @IsString() container!: string;
  @ApiProperty() @IsString() carrier!: string;
  @ApiProperty() @IsString() etd!: string;
  @ApiProperty() @IsString() eta!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() partnerId?: string;
}

class RecordBilledWeightDto {
  @ApiProperty() @IsNumber() billedRevenueTon!: number;
  @ApiProperty() @IsInt() freightPaidMinor!: number;
}

class TrackDto {
  @ApiProperty() @IsString() @MinLength(1) milestone!: string;
  @ApiProperty({ enum: TRACKING_SOURCES }) @IsIn(TRACKING_SOURCES) source!: TrackingSource;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() occurredAt?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() note?: string;
}

class DelayDto {
  @ApiProperty() @IsString() newEta!: string;
  @ApiProperty() @IsString() @MinLength(1) reason!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() agentId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() ownerId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() frontOfficeId?: string;
}

class PartnerShipmentsQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit = 20;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  offset = 0;
}

class DeliverDto {
  @ApiProperty() @IsString() shipmentRef!: string;
  @ApiProperty({ type: [String] }) @IsArray() @ArrayNotEmpty() @IsString({ each: true }) packageRefs!: string[];
  @ApiProperty() @IsString() podRef!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() office?: string;
}

@ApiTags('logistics: receiving')
@ApiBearerAuth()
@Controller('receiving')
export class ReceivingController {
  constructor(private readonly receiving: ReceivingService) {}

  @Post()
  @ApiOperation({ summary: 'Receive a lot; reconcile measured-vs-declared, freeze on hard stop (package:create)' })
  receive(@CurrentActor() actor: Actor, @Body() dto: ReceiveDto) {
    return this.receiving.receivePackages(actor, dto);
  }

  @Post('variance')
  @ApiOperation({ summary: 'Resolve a commercial variance hold on a lot (package:update)' })
  resolveVariance(@CurrentActor() actor: Actor, @Body() dto: ResolveVarianceDto) {
    return this.receiving.resolveVariance(actor, dto.lotRef, dto.decision, dto.note ?? '');
  }
}

@ApiTags('logistics: release')
@ApiBearerAuth()
@Controller('release')
export class ReleaseController {
  constructor(private readonly release: ReleaseService) {}

  @Post('qc')
  @ApiOperation({ summary: 'QC-release packages (qcReleased only; package:update)' })
  qcRelease(@CurrentActor() actor: Actor, @Body() dto: QcReleaseDto) {
    return this.release.qcRelease(actor, dto.packageRefs);
  }

  @Post('destination')
  @ApiOperation({ summary: 'Allocate a destination to packages (package:update)' })
  allocateDestination(@CurrentActor() actor: Actor, @Body() dto: AllocateDestinationDto) {
    return this.release.allocateDestination(actor, dto.packageRefs, dto.destination);
  }
}

@ApiTags('logistics: containers')
@ApiBearerAuth()
@Controller('containers')
export class ContainerController {
  constructor(private readonly containers: ContainerService) {}

  @Post()
  @ApiOperation({ summary: 'Book a container through the three ordered gates (shipment:create)' })
  create(@CurrentActor() actor: Actor, @Body() dto: CreateShipmentDto) {
    return this.containers.createShipment(actor, dto);
  }
}

@ApiTags('logistics: freight')
@ApiBearerAuth()
@Controller('freight')
export class FreightController {
  constructor(private readonly freight: FreightService) {}

  @Post(':shipmentRef/billed-weight')
  @ApiOperation({ summary: 'Record forwarder billed weight; flags a claim (shipment:create)' })
  recordBilledWeight(
    @CurrentActor() actor: Actor,
    @Param('shipmentRef') shipmentRef: string,
    @Body() dto: RecordBilledWeightDto,
  ) {
    return this.freight.recordBilledWeight(actor, shipmentRef, dto.billedRevenueTon, dto.freightPaidMinor as Minor);
  }

  @Post(':shipmentRef/allocate')
  @ApiOperation({ summary: 'Allocate freight pro-rata by revenue ton (shipment:create)' })
  allocate(@CurrentActor() actor: Actor, @Param('shipmentRef') shipmentRef: string) {
    return this.freight.allocateFreight(actor, shipmentRef);
  }
}

@ApiTags('logistics: tracking')
@ApiBearerAuth()
@Controller('tracking')
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  @Post(':shipmentRef/events')
  @ApiOperation({ summary: 'Add a tracking event; confirmed vs estimated derived (shipment:read)' })
  track(@CurrentActor() actor: Actor, @Param('shipmentRef') shipmentRef: string, @Body() dto: TrackDto) {
    return this.tracking.track(
      actor,
      shipmentRef,
      dto.milestone,
      dto.source,
      dto.occurredAt ? new Date(dto.occurredAt) : undefined,
      dto.note,
    );
  }

  @Get(':shipmentRef/timeline')
  @ApiOperation({ summary: 'Shipment timeline, each event tagged confirmed vs estimated (shipment:read)' })
  timeline(@CurrentActor() actor: Actor, @Param('shipmentRef') shipmentRef: string) {
    return this.tracking.timeline(actor, shipmentRef);
  }

  @Post(':shipmentRef/delay')
  @ApiOperation({ summary: 'Delay a shipment; fans out to five parties (shipment:create)' })
  delay(@CurrentActor() actor: Actor, @Param('shipmentRef') shipmentRef: string, @Body() dto: DelayDto) {
    return this.tracking.delayShipment(actor, shipmentRef, dto.newEta, dto.reason, {
      ...(dto.agentId ? { agentId: dto.agentId } : {}),
      ...(dto.ownerId ? { ownerId: dto.ownerId } : {}),
      ...(dto.frontOfficeId ? { frontOfficeId: dto.frontOfficeId } : {}),
    });
  }
}

@ApiTags('logistics: delivery')
@ApiBearerAuth()
@Controller('deliveries')
export class DeliveryController {
  constructor(private readonly delivery: DeliveryService) {}

  @Post()
  @ApiOperation({ summary: 'Deliver with POD; gated on full payment (delivery:create, shipment-scoped)' })
  deliver(@CurrentActor() actor: Actor, @Body() dto: DeliverDto) {
    return this.delivery.deliver(actor, dto);
  }
}

@ApiTags('logistics: partner portal')
@ApiBearerAuth()
@Controller('partner-portal')
export class PartnerPortalController {
  constructor(private readonly portal: PartnerPortalService) {}

  @Get('shipments')
  @ApiOperation({ summary: 'List the caller’s assigned shipments (shipment:read, scoped; freight cost masked)' })
  listShipments(@CurrentActor() actor: Actor, @Query() q: PartnerShipmentsQueryDto) {
    return this.portal.listShipments(actor, { limit: q.limit, offset: q.offset });
  }

  @Get('shipments/:ref')
  @ApiOperation({ summary: 'Read an assigned shipment (shipment:read, scoped; freight cost masked)' })
  readShipment(@CurrentActor() actor: Actor, @Param('ref') ref: string) {
    return this.portal.readShipment(actor, ref);
  }

  @Get('shipments/:ref/packages')
  @ApiOperation({ summary: 'Read a shipment’s packages (package:read, scoped)' })
  readPackages(@CurrentActor() actor: Actor, @Param('ref') ref: string) {
    return this.portal.readPackages(actor, ref);
  }

  @Get('shipments/:ref/delivery')
  @ApiOperation({ summary: 'Read a shipment’s delivery (delivery:read, scoped)' })
  readDelivery(@CurrentActor() actor: Actor, @Param('ref') ref: string) {
    return this.portal.readDelivery(actor, ref);
  }
}

export const LOGISTICS_CONTROLLERS = [
  ReceivingController,
  ReleaseController,
  ContainerController,
  FreightController,
  TrackingController,
  DeliveryController,
  PartnerPortalController,
];
