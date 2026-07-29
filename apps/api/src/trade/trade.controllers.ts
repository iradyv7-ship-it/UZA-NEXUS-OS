import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import type { OrderStatus, QuotationStatus } from '@prisma/client';
import type { Actor, CostRung, Incoterm, Minor } from '@uza/contracts';
import { INCOTERMS } from '@uza/contracts';
import { CurrentActor } from '../platform/auth/current-actor.decorator';
import { CustomerService } from './customer/customer.service';
import { IntakeService } from './intake/intake.service';
import { ProjectService } from './project/project.service';
import { QuotationService, type QuotationPricingInput } from './quotation/quotation.service';
import { OrderService } from './order/order.service';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

class CreateCustomerDto {
  @ApiProperty() @IsString() @MinLength(1) name!: string;
  @ApiProperty() @IsString() @MinLength(1) country!: string;
  @ApiProperty() @IsString() @MinLength(1) phone!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() agentId?: string;
}

class CreateLeadDto {
  @ApiProperty() @IsString() customerRef!: string;
  @ApiProperty() @IsString() @MinLength(1) rawText!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() agentId?: string;
}

class ClarifyLeadDto {
  @ApiProperty({ type: Object }) @IsObject() spec!: Record<string, unknown>;
}

class CreateProjectDto {
  @ApiProperty() @IsString() requestRef!: string;
  @ApiProperty() @IsString() @MinLength(1) name!: string;
  @ApiProperty() @IsString() owner!: string;
}

class CreateTaskDto {
  @ApiProperty() @IsString() @MinLength(1) title!: string;
  @ApiProperty() @IsString() accountable!: string;
  @ApiProperty() @IsString() responsible!: string;
}

class PricingDto {
  @ApiProperty() @IsInt() supplierUnitCostMinor!: number;
  @ApiProperty({ type: Object, description: 'Partial map of CostRung → estimated minor units' })
  @IsObject()
  estCostsMinor!: Record<string, number>;
  @ApiProperty() @IsInt() qty!: number;
  @ApiProperty({ description: 'Required margin as a fraction, e.g. 0.2' }) @IsNumber() requiredMargin!: number;
  @ApiProperty({ required: false, enum: INCOTERMS })
  @IsOptional()
  @IsIn(INCOTERMS)
  sellIncoterm?: Incoterm;
}

class BuildQuotationDto extends PricingDto {
  @ApiProperty() @IsString() projectRef!: string;
}

class CloseCostsDto {
  @ApiProperty({ type: Object, description: 'Partial map of CostRung → actual minor units' })
  @IsObject()
  actualsMinor!: Record<string, number>;
}

class CreateOrderDto {
  @ApiProperty() @IsString() quotationRef!: string;
}

class CancelOrderDto {
  @ApiProperty() @IsString() @MinLength(1) reason!: string;
}

// ---- list / work-queue query DTOs ------------------------------------------
// Query params arrive as strings; @Type(() => Number) coerces the pagination ints so the
// global ValidationPipe (transform:true) rejects non-numeric/out-of-range input with 400.

const QUOTATION_STATUSES = ['draft', 'approved', 'superseded'] as const;
const ORDER_STATUSES = [
  'awaiting_payment', 'procurement_active', 'in_transit', 'delivered', 'cancelled',
] as const;

class ListQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit = 20;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  offset = 0;
}

class ListProjectsQueryDto extends ListQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() customerRef?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() stage?: string;
}

class ListQuotationsQueryDto extends ListQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() projectRef?: string;
  @ApiPropertyOptional({ enum: QUOTATION_STATUSES })
  @IsOptional() @IsIn(QUOTATION_STATUSES) status?: QuotationStatus;
}

class ListOrdersQueryDto extends ListQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() customerRef?: string;
  @ApiPropertyOptional({ enum: ORDER_STATUSES })
  @IsOptional() @IsIn(ORDER_STATUSES) status?: OrderStatus;
}

const asPricing = (dto: PricingDto): QuotationPricingInput => ({
  supplierUnitCostMinor: dto.supplierUnitCostMinor as Minor,
  estCostsMinor: dto.estCostsMinor as Partial<Record<CostRung, Minor>>,
  qty: dto.qty,
  requiredMargin: dto.requiredMargin,
  ...(dto.sellIncoterm ? { sellIncoterm: dto.sellIncoterm } : {}),
});

// ---------------------------------------------------------------------------
// Controllers — thin: parse, call the service with the actor, return its result.
// All authorisation, scoping and masking live in the services.
// ---------------------------------------------------------------------------

@ApiTags('trade: customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomerController {
  constructor(private readonly customers: CustomerService) {}

  @Post()
  @ApiOperation({ summary: 'Create a customer (customer:create)' })
  create(@CurrentActor() actor: Actor, @Body() dto: CreateCustomerDto) {
    return this.customers.create(actor, dto);
  }

  @Get(':ref')
  @ApiOperation({ summary: 'Read a customer (customer:read, scoped + masked)' })
  read(@CurrentActor() actor: Actor, @Param('ref') ref: string) {
    return this.customers.read(actor, ref);
  }
}

@ApiTags('trade: intake')
@ApiBearerAuth()
@Controller('leads')
export class IntakeController {
  constructor(private readonly intake: IntakeService) {}

  @Post()
  @ApiOperation({ summary: 'Capture an unstructured enquiry as a Lead (lead:create)' })
  createLead(@CurrentActor() actor: Actor, @Body() dto: CreateLeadDto) {
    return this.intake.createLead(actor, dto);
  }

  @Post(':ref/clarify')
  @ApiOperation({ summary: 'Human confirmation → structured Request (request:create)' })
  clarifyLead(@CurrentActor() actor: Actor, @Param('ref') ref: string, @Body() dto: ClarifyLeadDto) {
    return this.intake.clarifyLead(actor, { leadRef: ref, spec: dto.spec });
  }
}

@ApiTags('trade: projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectController {
  constructor(private readonly projects: ProjectService) {}

  @Post()
  @ApiOperation({ summary: 'Create a project from a clarified request (project:create)' })
  create(@CurrentActor() actor: Actor, @Body() dto: CreateProjectDto) {
    return this.projects.create(actor, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List in-scope projects (project:read, scoped; updatedAt desc)' })
  list(@CurrentActor() actor: Actor, @Query() q: ListProjectsQueryDto) {
    return this.projects.list(
      actor,
      { customerRef: q.customerRef, stage: q.stage },
      { limit: q.limit, offset: q.offset },
    );
  }

  @Get(':ref')
  @ApiOperation({ summary: 'Read a project (project:read, scoped)' })
  read(@CurrentActor() actor: Actor, @Param('ref') ref: string) {
    return this.projects.read(actor, ref);
  }

  @Post(':ref/tasks')
  @ApiOperation({ summary: 'Add a RACI task to a project (task:create)' })
  createTask(@CurrentActor() actor: Actor, @Param('ref') ref: string, @Body() dto: CreateTaskDto) {
    return this.projects.createTask(actor, { projectRef: ref, ...dto });
  }
}

@ApiTags('trade: quotations')
@ApiBearerAuth()
@Controller('quotations')
export class QuotationController {
  constructor(private readonly quotations: QuotationService) {}

  @Post()
  @ApiOperation({ summary: 'Build a quotation for a project (quotation:create)' })
  build(@CurrentActor() actor: Actor, @Body() dto: BuildQuotationDto) {
    return this.quotations.build(actor, dto.projectRef, asPricing(dto));
  }

  @Get()
  @ApiOperation({ summary: 'List in-scope quotations (quotation:read, scoped; cost/margins masked; updatedAt desc)' })
  list(@CurrentActor() actor: Actor, @Query() q: ListQuotationsQueryDto) {
    return this.quotations.list(
      actor,
      { projectRef: q.projectRef, status: q.status },
      { limit: q.limit, offset: q.offset },
    );
  }

  @Post(':ref/revise')
  @ApiOperation({ summary: 'Revise a quotation → new version, supersedes predecessor (quotation:create)' })
  revise(@CurrentActor() actor: Actor, @Param('ref') ref: string, @Body() dto: PricingDto) {
    return this.quotations.revise(actor, ref, asPricing(dto));
  }

  @Post(':ref/approve')
  @ApiOperation({ summary: 'Approve a quotation, locking the quoted margin (quotation:approve)' })
  approve(@CurrentActor() actor: Actor, @Param('ref') ref: string) {
    return this.quotations.approve(actor, ref);
  }

  @Post(':ref/close-costs')
  @ApiOperation({ summary: 'Land actuals and recompute realized margin (margin:read)' })
  closeCosts(@CurrentActor() actor: Actor, @Param('ref') ref: string, @Body() dto: CloseCostsDto) {
    return this.quotations.closeCosts(actor, ref, dto.actualsMinor as Partial<Record<CostRung, Minor>>);
  }

  @Get(':ref')
  @ApiOperation({ summary: 'Read a quotation (quotation:read, scoped; cost/margins masked)' })
  read(@CurrentActor() actor: Actor, @Param('ref') ref: string) {
    return this.quotations.read(actor, ref);
  }
}

@ApiTags('trade: orders')
@ApiBearerAuth()
@Controller('orders')
export class OrderController {
  constructor(private readonly orders: OrderService) {}

  @Post()
  @ApiOperation({ summary: 'Create an order from an approved quotation (order:create)' })
  create(@CurrentActor() actor: Actor, @Body() dto: CreateOrderDto) {
    return this.orders.create(actor, dto.quotationRef);
  }

  @Get()
  @ApiOperation({ summary: 'List in-scope orders (order:read, scoped; updatedAt desc)' })
  list(@CurrentActor() actor: Actor, @Query() q: ListOrdersQueryDto) {
    return this.orders.list(
      actor,
      { status: q.status, customerRef: q.customerRef },
      { limit: q.limit, offset: q.offset },
    );
  }

  @Post(':ref/cancel')
  @ApiOperation({ summary: 'Cancel an order (order:update)' })
  cancel(@CurrentActor() actor: Actor, @Param('ref') ref: string, @Body() dto: CancelOrderDto) {
    return this.orders.cancel(actor, ref, dto.reason);
  }

  @Get(':ref')
  @ApiOperation({ summary: 'Read an order + installments (order:read, scoped)' })
  read(@CurrentActor() actor: Actor, @Param('ref') ref: string) {
    return this.orders.read(actor, ref);
  }
}

export const TRADE_CONTROLLERS = [
  CustomerController,
  IntakeController,
  ProjectController,
  QuotationController,
  OrderController,
];
