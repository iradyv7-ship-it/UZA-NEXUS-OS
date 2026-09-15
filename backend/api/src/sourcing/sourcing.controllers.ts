import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { Prisma } from '@prisma/client';
import type { Actor, Minor, SupplierLifecycle } from '@uza/contracts';
import { CurrentActor } from '../platform/auth/current-actor.decorator';
import { SupplierService } from './supplier/supplier.service';
import { RfqService } from './quote/rfq.service';
import { PurchaseOrderService } from './po/purchase-order.service';
import { SupplierOfferService, type OfferAttachmentKind } from './offer/supplier-offer.service';
import { SupplierDealService } from './deal/supplier-deal.service';

const SUPPLIER_LIFECYCLES: readonly SupplierLifecycle[] = [
  'Discovered',
  'Contacted',
  'PreScreened',
  'SampleRequested',
  'SampleApproved',
  'TrialOrder',
  'Verified',
  'Preferred',
  'StrategicPartner',
  'Suspended',
  'Blocked',
];
const QUOTE_BASES = ['EXW', 'FOB'] as const;

class RegisterSupplierDto {
  @ApiProperty() @IsString() @MinLength(1) nameEn!: string;
  @ApiProperty() @IsString() @MinLength(1) nameZh!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() country?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() relationshipOwnerId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() clientRequestId?: string;
}

class SetLifecycleDto {
  @ApiProperty({ enum: SUPPLIER_LIFECYCLES })
  @IsIn(SUPPLIER_LIFECYCLES)
  lifecycle!: SupplierLifecycle;
}

class AddCertificationDto {
  @ApiProperty() @IsString() @MinLength(1) name!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() issuer?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() number?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() issuedAt?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() expiresAt?: string;
}

class CreateRfqDto {
  @ApiProperty() @IsString() projectRef!: string;
  @ApiProperty({ required: false, type: Object }) @IsOptional() @IsObject() detail?: Record<
    string,
    unknown
  >;
  @ApiProperty({ required: false }) @IsOptional() @IsString() clientRequestId?: string;
}

class AddQuoteDto {
  @ApiProperty() @IsString() supplierRef!: string;
  @ApiProperty() @IsString() projectRef!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() rfqRef?: string;
  @ApiProperty() @IsInt() unitCostMinor!: number;
  @ApiProperty() @IsInt() moq!: number;
  @ApiProperty() @IsInt() leadTimeDays!: number;
  @ApiProperty() @IsNumber() unitCbm!: number;
  @ApiProperty() @IsNumber() unitKg!: number;
  @ApiProperty({ required: false, enum: QUOTE_BASES }) @IsOptional() @IsIn(QUOTE_BASES) basis?:
    'EXW' | 'FOB';
  @ApiProperty({ required: false }) @IsOptional() @IsString() clientRequestId?: string;
}

class CreatePurchaseOrderDto {
  @ApiProperty() @IsString() supplierRef!: string;
  @ApiProperty() @IsString() orderRef!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() quoteRef?: string;
  @ApiProperty() @IsInt() qty!: number;
  @ApiProperty() @IsInt() unitCostMinor!: number;
  @ApiProperty() @IsNumber() unitCbm!: number;
  @ApiProperty() @IsNumber() unitKg!: number;
  @ApiProperty({ required: false, enum: QUOTE_BASES }) @IsOptional() @IsIn(QUOTE_BASES) basis?:
    'EXW' | 'FOB';
  @ApiProperty({ required: false }) @IsOptional() @IsString() clientRequestId?: string;
}

class AssignOriginForwarderDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() forwarderRef?: string;
  @ApiProperty() @IsString() @MinLength(1) forwarderName!: string;
}

const OFFER_ATTACHMENT_KINDS = ['image', 'inspection_report', 'battery_health_certificate'] as const;

class SubmitOfferDto {
  @ApiProperty() @IsString() supplierRef!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() projectRef?: string;
  @ApiProperty() @IsInt() unitCostMinor!: number;
  @ApiProperty() @IsInt() qty!: number;
  @ApiProperty() @IsInt() moq!: number;
  @ApiProperty() @IsInt() leadTimeDays!: number;
  @ApiProperty() @IsNumber() unitCbm!: number;
  @ApiProperty() @IsNumber() unitKg!: number;
  @ApiProperty({ required: false, enum: QUOTE_BASES }) @IsOptional() @IsIn(QUOTE_BASES) basis?:
    'EXW' | 'FOB';
  @ApiProperty({ required: false }) @IsOptional() @IsString() supplierContact?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() clientRequestId?: string;
}

class AddOfferAttachmentDto {
  @ApiProperty({ enum: OFFER_ATTACHMENT_KINDS }) @IsIn(OFFER_ATTACHMENT_KINDS) kind!:
    OfferAttachmentKind;
  @ApiProperty() @IsString() uri!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() note?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() clientRequestId?: string;
}

class DecideOfferDto {
  @ApiProperty() @IsString() @MinLength(1) decidedBy!: string;
}

class ReserveDealDto {
  @ApiProperty() @IsString() offerRef!: string;
  @ApiProperty() @IsString() @MinLength(1) confirmedBy!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() clientRequestId?: string;
}

class RecordDealInspectionDto {
  @ApiProperty() @IsInt() @Min(0) critical!: number;
  @ApiProperty() @IsInt() @Min(0) major!: number;
  @ApiProperty() @IsInt() @Min(0) minor!: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() inspectionRef?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() clientRequestId?: string;
}

class MarkBalanceDueDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() clientRequestId?: string;
}

class ConfirmBalancePaidDto {
  @ApiProperty() @IsString() @MinLength(1) confirmedBy!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() clientRequestId?: string;
}

@ApiTags('sourcing: suppliers')
@ApiBearerAuth()
@Controller('suppliers')
export class SupplierController {
  constructor(private readonly suppliers: SupplierService) {}

  @Post()
  @ApiOperation({ summary: 'Register a supplier (supplier:create)' })
  register(@CurrentActor() actor: Actor, @Body() dto: RegisterSupplierDto) {
    return this.suppliers.register(actor, dto);
  }

  @Patch(':ref/lifecycle')
  @ApiOperation({ summary: 'Advance/suspend a supplier lifecycle (supplier:update)' })
  setLifecycle(
    @CurrentActor() actor: Actor,
    @Param('ref') ref: string,
    @Body() dto: SetLifecycleDto,
  ) {
    return this.suppliers.setLifecycle(actor, ref, dto.lifecycle);
  }

  @Post(':ref/certifications')
  @ApiOperation({ summary: 'Add a certification (supplier:update)' })
  addCertification(
    @CurrentActor() actor: Actor,
    @Param('ref') ref: string,
    @Body() dto: AddCertificationDto,
  ) {
    return this.suppliers.addCertification(actor, ref, {
      name: dto.name,
      ...(dto.issuer ? { issuer: dto.issuer } : {}),
      ...(dto.number ? { number: dto.number } : {}),
      ...(dto.issuedAt ? { issuedAt: new Date(dto.issuedAt) } : {}),
      ...(dto.expiresAt ? { expiresAt: new Date(dto.expiresAt) } : {}),
    });
  }

  @Get(':ref')
  @ApiOperation({ summary: 'Read a supplier (supplier:read, masked)' })
  read(@CurrentActor() actor: Actor, @Param('ref') ref: string) {
    return this.suppliers.read(actor, ref);
  }
}

@ApiTags('sourcing: rfqs & quotes')
@ApiBearerAuth()
@Controller()
export class RfqController {
  constructor(private readonly rfqs: RfqService) {}

  @Post('rfqs')
  @ApiOperation({ summary: 'Create an RFQ against a project (rfq:create)' })
  createRfq(@CurrentActor() actor: Actor, @Body() dto: CreateRfqDto) {
    return this.rfqs.createRfq(actor, {
      projectRef: dto.projectRef,
      ...(dto.detail ? { detail: dto.detail as Prisma.InputJsonValue } : {}),
      ...(dto.clientRequestId ? { clientRequestId: dto.clientRequestId } : {}),
    });
  }

  @Post('supplier-quotes')
  @ApiOperation({
    summary: 'Record a supplier quote; FOB forces inlandSeparable=false (supplierQuote:create)',
  })
  addQuote(@CurrentActor() actor: Actor, @Body() dto: AddQuoteDto) {
    return this.rfqs.addQuote(actor, { ...dto, unitCostMinor: dto.unitCostMinor as Minor });
  }

  @Get('supplier-quotes/:ref')
  @ApiOperation({ summary: 'Read a supplier quote (supplierQuote:read, cost masked)' })
  read(@CurrentActor() actor: Actor, @Param('ref') ref: string) {
    return this.rfqs.read(actor, ref);
  }
}

@ApiTags('sourcing: purchase orders')
@ApiBearerAuth()
@Controller('purchase-orders')
export class PurchaseOrderController {
  constructor(private readonly purchaseOrders: PurchaseOrderService) {}

  @Post()
  @ApiOperation({ summary: 'Issue a purchase order; publishes po.issued (po:create)' })
  create(@CurrentActor() actor: Actor, @Body() dto: CreatePurchaseOrderDto) {
    return this.purchaseOrders.create(actor, { ...dto, unitCostMinor: dto.unitCostMinor as Minor });
  }

  @Get(':ref')
  @ApiOperation({ summary: 'Read a purchase order (po:read, cost/total masked)' })
  read(@CurrentActor() actor: Actor, @Param('ref') ref: string) {
    return this.purchaseOrders.read(actor, ref);
  }

  @Patch(':ref/origin-forwarder')
  @ApiOperation({
    summary:
      'Record who books the sea leg for this PO — UZA always arranges its own ocean ' +
      'freight regardless of basis (po:update)',
  })
  assignOriginForwarder(
    @CurrentActor() actor: Actor,
    @Param('ref') ref: string,
    @Body() dto: AssignOriginForwarderDto,
  ) {
    return this.purchaseOrders.assignOriginForwarder(actor, ref, dto);
  }
}

@ApiTags('sourcing: supplier self-service (staff-relayed)')
@ApiBearerAuth()
@Controller('supplier-offers')
export class SupplierOfferController {
  constructor(private readonly offers: SupplierOfferService) {}

  @Post()
  @ApiOperation({
    summary:
      'Staff-relayed submission of a supplier-proposed deal, not in response to an RFQ ' +
      '(supplierQuote:create). A full supplier login is a pending contract request.',
  })
  submit(@CurrentActor() actor: Actor, @Body() dto: SubmitOfferDto) {
    return this.offers.submit(actor, { ...dto, unitCostMinor: dto.unitCostMinor as Minor });
  }

  @Post(':ref/attachments')
  @ApiOperation({
    summary:
      'Attach evidence (image / inspection report / battery-health certificate) to an ' +
      'offer (supplierQuote:update)',
  })
  addAttachment(
    @CurrentActor() actor: Actor,
    @Param('ref') ref: string,
    @Body() dto: AddOfferAttachmentDto,
  ) {
    return this.offers.addAttachment(actor, ref, dto);
  }

  @Post(':ref/accept')
  @ApiOperation({ summary: 'Accept an offer (supplierQuote:update)' })
  accept(@CurrentActor() actor: Actor, @Param('ref') ref: string, @Body() dto: DecideOfferDto) {
    return this.offers.accept(actor, ref, dto.decidedBy);
  }

  @Post(':ref/decline')
  @ApiOperation({ summary: 'Decline an offer (supplierQuote:update)' })
  decline(@CurrentActor() actor: Actor, @Param('ref') ref: string, @Body() dto: DecideOfferDto) {
    return this.offers.decline(actor, ref, dto.decidedBy);
  }

  @Get(':ref')
  @ApiOperation({ summary: 'Read an offer + attachments (supplierQuote:read, cost masked)' })
  read(@CurrentActor() actor: Actor, @Param('ref') ref: string) {
    return this.offers.read(actor, ref);
  }
}

@ApiTags('sourcing: supplier deals (two-stage payment)')
@ApiBearerAuth()
@Controller('supplier-deals')
export class SupplierDealController {
  constructor(private readonly deals: SupplierDealService) {}

  @Post()
  @ApiOperation({
    summary:
      'Reserve a unit against an accepted offer; confirms the booking fee was paid — ' +
      'human-only (po:approve)',
  })
  reserve(@CurrentActor() actor: Actor, @Body() dto: ReserveDealDto) {
    return this.deals.reserve(actor, dto);
  }

  @Post(':ref/inspection')
  @ApiOperation({
    summary:
      'Record the deal inspection outcome, graded by the shared threshold (critical>0 ' +
      'fails); gates whether the balance step is reachable (po:update)',
  })
  recordInspection(
    @CurrentActor() actor: Actor,
    @Param('ref') ref: string,
    @Body() dto: RecordDealInspectionDto,
  ) {
    return this.deals.recordInspectionResult(actor, ref, dto);
  }

  @Post(':ref/balance-due')
  @ApiOperation({
    summary: 'Open the balance step; requires a passing inspection — human-only (po:approve)',
  })
  markBalanceDue(
    @CurrentActor() actor: Actor,
    @Param('ref') ref: string,
    @Body() dto: MarkBalanceDueDto,
  ) {
    return this.deals.markBalanceDue(actor, ref, dto.clientRequestId);
  }

  @Post(':ref/balance-paid')
  @ApiOperation({ summary: 'Confirm the balance was paid — human-only (po:approve)' })
  confirmBalancePaid(
    @CurrentActor() actor: Actor,
    @Param('ref') ref: string,
    @Body() dto: ConfirmBalancePaidDto,
  ) {
    return this.deals.confirmBalancePaid(actor, ref, dto.confirmedBy, dto.clientRequestId);
  }

  @Get(':ref')
  @ApiOperation({ summary: 'Read a deal + transition log (po:read, money masked)' })
  read(@CurrentActor() actor: Actor, @Param('ref') ref: string) {
    return this.deals.read(actor, ref);
  }
}

export const SOURCING_CONTROLLERS = [
  SupplierController,
  RfqController,
  PurchaseOrderController,
  SupplierOfferController,
  SupplierDealController,
];
