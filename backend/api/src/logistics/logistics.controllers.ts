import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
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
import type { Actor, Destination, Minor, TrackingSource, VarianceDecision } from '@uza/contracts';
import { CurrentActor } from '../platform/auth/current-actor.decorator';
import { ReceivingService } from './warehouse/receiving.service';
import { ReleaseService, type CargoTypeValue } from './warehouse/release.service';
import { ContainerService, type EntryPortValue } from './logistics/container.service';
import { FreightService } from './logistics/freight.service';
import { TrackingService } from './logistics/tracking.service';
import { DeliveryService } from './logistics/delivery.service';
import { PartnerPortalService } from './logistics/partner-portal.service';
import { ShipmentDetailsService } from './logistics/shipment-details.service';
import { ConsigneeService } from './logistics/consignee.service';
import { PartnerRateService } from './logistics/partner-rate.service';

const DESTINATIONS: readonly Destination[] = ['KIGALI', 'GOMA', 'BUKAVU', 'UZA_STOCK', 'OTHER'];
const TRACKING_SOURCES: readonly TrackingSource[] = ['carrier', 'partner', 'uza', 'estimated'];
const VARIANCE_DECISIONS: readonly VarianceDecision[] = [
  'client_pays',
  'uza_absorbs',
  'reduce_qty',
];
const ENTRY_PORTS: readonly EntryPortValue[] = ['MOMBASA', 'DAR_ES_SALAAM'];
const CARGO_TYPES: readonly CargoTypeValue[] = ['CONSOLIDATED', 'LOOSE'];
// Free-string venture tag, same convention as the Command Center register (no shared enum
// exists — see the Shipment.ventureCode doc comment in schema.prisma).
const VENTURE_CODES = ['GROUP', 'BULK', 'MOBILITY', 'EMPOWER', 'CLOUD', 'NEXUS'] as const;

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
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  packageRefs!: string[];
}

class LoadableQueryDto {
  @ApiPropertyOptional({ enum: DESTINATIONS }) @IsOptional() @IsIn(DESTINATIONS) destination?: Destination;
}

class AllocateDestinationDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  packageRefs!: string[];
  @ApiProperty({ enum: DESTINATIONS }) @IsIn(DESTINATIONS) destination!: Destination;
}

class CreateShipmentDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  packageRefs!: string[];
  @ApiProperty() @IsString() container!: string;
  @ApiProperty() @IsString() carrier!: string;
  @ApiProperty({ description: 'Planned ETD — never the actual; see ShipmentDetailsService.' })
  @IsString()
  etdPlanned!: string;
  @ApiProperty({ description: 'Planned ETA — never the actual; see ShipmentDetailsService.' })
  @IsString()
  etaPlanned!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() partnerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() vesselName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() voyageNumber?: string;
  @ApiPropertyOptional({ enum: ENTRY_PORTS }) @IsOptional() @IsIn(ENTRY_PORTS) entryPort?: EntryPortValue;
  @ApiPropertyOptional({ enum: VENTURE_CODES }) @IsOptional() @IsIn(VENTURE_CODES) ventureCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() consigneeRef?: string;
}

class UpdateShipmentDetailsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() vesselName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() voyageNumber?: string;
  @ApiPropertyOptional({ enum: ENTRY_PORTS }) @IsOptional() @IsIn(ENTRY_PORTS) entryPort?: EntryPortValue;
  @ApiPropertyOptional() @IsOptional() @IsString() etdActual?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() etaActual?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() container?: string;
  @ApiPropertyOptional({ enum: VENTURE_CODES }) @IsOptional() @IsIn(VENTURE_CODES) ventureCode?: string;
}

class CargoDetailsDto {
  @ApiPropertyOptional({ enum: CARGO_TYPES }) @IsOptional() @IsIn(CARGO_TYPES) cargoType?: CargoTypeValue;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) pricePerCbmMinor?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() photoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() goodsDescription?: string;
}

class ConsigneeDto {
  @ApiProperty() @IsString() @MinLength(1) name!: string;
  @ApiProperty() @IsString() @MinLength(1) phone!: string;
  @ApiProperty() @IsString() @MinLength(1) address!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() tinNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() email?: string;
}

class AttachConsigneeDto {
  @ApiProperty() @IsString() consigneeRef!: string;
}

class CurrentRateQueryDto {
  @ApiProperty({ enum: DESTINATIONS }) @IsIn(DESTINATIONS) destination!: Destination;
}

class RecordPartnerRateDto {
  @ApiProperty() @IsString() partnerId!: string;
  @ApiProperty({ enum: DESTINATIONS }) @IsIn(DESTINATIONS) destination!: Destination;
  @ApiProperty() @IsInt() @Min(1) ratePerRevenueTonMinor!: number;
  @ApiPropertyOptional({ enum: ENTRY_PORTS }) @IsOptional() @IsIn(ENTRY_PORTS) entryPort?: EntryPortValue;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
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
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;
}

class DeliverDto {
  @ApiProperty() @IsString() shipmentRef!: string;
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  packageRefs!: string[];
  @ApiProperty() @IsString() podRef!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() office?: string;
}

@ApiTags('logistics: receiving')
@ApiBearerAuth()
@Controller('receiving')
export class ReceivingController {
  constructor(private readonly receiving: ReceivingService) {}

  @Post()
  @ApiOperation({
    summary: 'Receive a lot; reconcile measured-vs-declared, freeze on hard stop (package:create)',
  })
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

  @Get('loadable')
  @ApiOperation({
    summary:
      'Packages ready to load — QC-released, no hold, destinated, not yet on a shipment ' +
      '(package:read). Feeds the container-booking form.',
  })
  listLoadable(@CurrentActor() actor: Actor, @Query() q: LoadableQueryDto) {
    return this.release.listLoadable(actor, q.destination);
  }

  @Patch(':packageRef/cargo')
  @ApiOperation({
    summary:
      'Set the customer-facing cargo line — type, price-per-CBM, photo, goods description ' +
      '(package:update). Never touches the internal revenueTon cost-allocation numbers.',
  })
  setCargoDetails(
    @CurrentActor() actor: Actor,
    @Param('packageRef') packageRef: string,
    @Body() dto: CargoDetailsDto,
  ) {
    return this.release.setCargoDetails(actor, packageRef, dto);
  }
}

@ApiTags('logistics: containers')
@ApiBearerAuth()
@Controller('containers')
export class ContainerController {
  constructor(
    private readonly containers: ContainerService,
    private readonly details: ShipmentDetailsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Book a container through the three ordered gates (shipment:create)' })
  create(@CurrentActor() actor: Actor, @Body() dto: CreateShipmentDto) {
    return this.containers.createShipment(actor, dto);
  }

  @Patch(':shipmentRef')
  @ApiOperation({
    summary:
      'Update vessel/voyage/entry-port/actual-dates/venture, or correct the container ' +
      'number (re-notifies client + customer-care on a container change; shipment:create). ' +
      'Never touches the three booking gates.',
  })
  updateDetails(
    @CurrentActor() actor: Actor,
    @Param('shipmentRef') shipmentRef: string,
    @Body() dto: UpdateShipmentDetailsDto,
  ) {
    return this.details.updateDetails(actor, shipmentRef, dto);
  }

  @Get(':shipmentRef/timing')
  @ApiOperation({
    summary:
      'Departure/arrival/transit-time, derived from the planned/actual pair, never stored ' +
      '(shipment:read)',
  })
  timing(@CurrentActor() actor: Actor, @Param('shipmentRef') shipmentRef: string) {
    return this.details.readWithTiming(actor, shipmentRef);
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
    return this.freight.recordBilledWeight(
      actor,
      shipmentRef,
      dto.billedRevenueTon,
      dto.freightPaidMinor as Minor,
    );
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
  track(
    @CurrentActor() actor: Actor,
    @Param('shipmentRef') shipmentRef: string,
    @Body() dto: TrackDto,
  ) {
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
  @ApiOperation({
    summary: 'Shipment timeline, each event tagged confirmed vs estimated (shipment:read)',
  })
  timeline(@CurrentActor() actor: Actor, @Param('shipmentRef') shipmentRef: string) {
    return this.tracking.timeline(actor, shipmentRef);
  }

  @Post(':shipmentRef/delay')
  @ApiOperation({ summary: 'Delay a shipment; fans out to five parties (shipment:create)' })
  delay(
    @CurrentActor() actor: Actor,
    @Param('shipmentRef') shipmentRef: string,
    @Body() dto: DelayDto,
  ) {
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
  @ApiOperation({
    summary: 'Deliver with POD; gated on full payment (delivery:create, shipment-scoped)',
  })
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
  @ApiOperation({
    summary: 'List the caller’s assigned shipments (shipment:read, scoped; freight cost masked)',
  })
  listShipments(@CurrentActor() actor: Actor, @Query() q: PartnerShipmentsQueryDto) {
    return this.portal.listShipments(actor, { limit: q.limit, offset: q.offset });
  }

  @Get('shipments/:ref')
  @ApiOperation({
    summary: 'Read an assigned shipment (shipment:read, scoped; freight cost masked)',
  })
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

@ApiTags('logistics: shipments')
@ApiBearerAuth()
@Controller('shipments')
export class ShipmentQueryController {
  // Deliberately delegates to PartnerPortalService rather than re-querying Prisma directly:
  // its authorize()+shipmentScopeWhere()+mask() pipeline is the SAME scoping mirror this
  // module's tests pin (`list agrees with inScope`) — for an internal role (venture_manager,
  // ceo, ...) `shipmentScopeWhere` returns `{}` (unfiltered) and `mask` leaves their
  // permitted fields unmasked, so this is exactly "list/read the shipments I can see",
  // whether the caller is Imari or Cecilia's ops workspace. Duplicating that logic under a
  // second name would be the drift the constitution's "no duplicate types/logic" rule exists
  // to prevent.
  constructor(private readonly portal: PartnerPortalService) {}

  @Get()
  @ApiOperation({ summary: 'List shipments in the caller’s scope (shipment:read)' })
  list(@CurrentActor() actor: Actor, @Query() q: PartnerShipmentsQueryDto) {
    return this.portal.listShipments(actor, { limit: q.limit, offset: q.offset });
  }

  @Get(':ref')
  @ApiOperation({ summary: 'Read a shipment in the caller’s scope (shipment:read)' })
  read(@CurrentActor() actor: Actor, @Param('ref') ref: string) {
    return this.portal.readShipment(actor, ref);
  }
}

@ApiTags('logistics: consignees')
@ApiBearerAuth()
@Controller('consignees')
export class ConsigneeController {
  constructor(private readonly consignees: ConsigneeService) {}

  @Post()
  @ApiOperation({ summary: 'Create a consignee — the receiving party (package:update)' })
  create(@CurrentActor() actor: Actor, @Body() dto: ConsigneeDto) {
    return this.consignees.create(actor, dto);
  }

  @Get(':ref')
  @ApiOperation({ summary: 'Read a consignee (package:update)' })
  read(@CurrentActor() actor: Actor, @Param('ref') ref: string) {
    return this.consignees.read(actor, ref);
  }

  @Post('packages/:packageRef/attach')
  @ApiOperation({ summary: "Attach a consignee to a package's shipment communications (package:update)" })
  attachToPackage(
    @CurrentActor() actor: Actor,
    @Param('packageRef') packageRef: string,
    @Body() dto: AttachConsigneeDto,
  ) {
    return this.consignees.attachToPackage(actor, packageRef, dto.consigneeRef);
  }

  @Post('shipments/:shipmentRef/attach')
  @ApiOperation({
    summary: 'Attach a consignee as the default receiving party for a shipment (shipment:create)',
  })
  attachToShipment(
    @CurrentActor() actor: Actor,
    @Param('shipmentRef') shipmentRef: string,
    @Body() dto: AttachConsigneeDto,
  ) {
    return this.consignees.attachToShipment(actor, shipmentRef, dto.consigneeRef);
  }
}

@ApiTags('logistics: partner rates')
@ApiBearerAuth()
@Controller('partner-rates')
export class PartnerRateController {
  constructor(private readonly rates: PartnerRateService) {}

  @Post()
  @ApiOperation({
    summary:
      'Append a weekly (or ad hoc) freight-partner rate — append-only, never an update ' +
      '(shipment:create)',
  })
  record(@CurrentActor() actor: Actor, @Body() dto: RecordPartnerRateDto) {
    return this.rates.recordWeeklyRate(actor, dto);
  }

  @Get(':partnerId/history')
  @ApiOperation({ summary: 'Full append-only rate history for a partner (shipment:read)' })
  history(@CurrentActor() actor: Actor, @Param('partnerId') partnerId: string) {
    return this.rates.history(actor, partnerId);
  }

  @Get(':partnerId/current')
  @ApiOperation({
    summary: 'The latest recorded rate for a partner+destination (shipment:read)',
  })
  current(
    @CurrentActor() actor: Actor,
    @Param('partnerId') partnerId: string,
    @Query() q: CurrentRateQueryDto,
  ) {
    return this.rates.currentRate(actor, partnerId, q.destination);
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
  ShipmentQueryController,
  ConsigneeController,
  PartnerRateController,
];
