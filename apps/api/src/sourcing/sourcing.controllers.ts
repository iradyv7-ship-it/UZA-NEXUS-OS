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
  MinLength,
} from 'class-validator';
import { Prisma } from '@prisma/client';
import type { Actor, Minor, SupplierLifecycle } from '@uza/contracts';
import { CurrentActor } from '../platform/auth/current-actor.decorator';
import { SupplierService } from './supplier/supplier.service';
import { RfqService } from './quote/rfq.service';
import { PurchaseOrderService } from './po/purchase-order.service';

const SUPPLIER_LIFECYCLES: readonly SupplierLifecycle[] = [
  'Discovered', 'Contacted', 'PreScreened', 'SampleRequested', 'SampleApproved',
  'TrialOrder', 'Verified', 'Preferred', 'StrategicPartner', 'Suspended', 'Blocked',
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
  @ApiProperty({ enum: SUPPLIER_LIFECYCLES }) @IsIn(SUPPLIER_LIFECYCLES) lifecycle!: SupplierLifecycle;
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
  @ApiProperty({ required: false, type: Object }) @IsOptional() @IsObject() detail?: Record<string, unknown>;
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
  @ApiProperty({ required: false, enum: QUOTE_BASES }) @IsOptional() @IsIn(QUOTE_BASES) basis?: 'EXW' | 'FOB';
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
  setLifecycle(@CurrentActor() actor: Actor, @Param('ref') ref: string, @Body() dto: SetLifecycleDto) {
    return this.suppliers.setLifecycle(actor, ref, dto.lifecycle);
  }

  @Post(':ref/certifications')
  @ApiOperation({ summary: 'Add a certification (supplier:update)' })
  addCertification(@CurrentActor() actor: Actor, @Param('ref') ref: string, @Body() dto: AddCertificationDto) {
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
  @ApiOperation({ summary: 'Record a supplier quote; FOB forces inlandSeparable=false (supplierQuote:create)' })
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
}

export const SOURCING_CONTROLLERS = [SupplierController, RfqController, PurchaseOrderController];
