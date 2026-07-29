import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import type { PaymentStatus } from '@prisma/client';
import type { Actor, InstallmentTrigger, Minor } from '@uza/contracts';
import { CurrentActor } from '../platform/auth/current-actor.decorator';
import { InvoiceService } from './invoice/invoice.service';
import { PaymentService } from './payment/payment.service';
import { CommissionService } from './commission/commission.service';
import { ForwarderClaimService } from './claim/forwarder-claim.service';
import { PettyCashService, type PettyCashKind } from './petty-cash/petty-cash.service';
import { SupplierBankService } from './supplier-bank/supplier-bank.service';

const TRIGGERS: readonly InstallmentTrigger[] = ['confirmation', 'pre_loading', 'pre_release'];
const PETTY_CASH_KINDS: readonly PettyCashKind[] = ['float', 'expense', 'replenishment'];
const CLAIM_STATUSES = ['submitted', 'recovered', 'written_off'] as const;
const PAYMENT_STATUSES = ['pending_verification', 'verified', 'rejected'] as const;

class UploadProofDto {
  @ApiProperty() @IsString() invoiceRef!: string;
  @ApiProperty() @IsInt() amountMinor!: number;
  @ApiProperty() @IsString() proofRef!: string;
  @ApiProperty({ enum: TRIGGERS }) @IsIn(TRIGGERS) targetTrigger!: InstallmentTrigger;
}

class RejectPaymentDto {
  @ApiProperty() @IsString() @MinLength(1) reason!: string;
}

// Query params arrive as strings; @Type(() => Number) coerces the pagination ints so the
// global ValidationPipe (transform:true) rejects non-numeric/out-of-range input with 400.
class ListPaymentsQueryDto {
  @ApiPropertyOptional({ enum: PAYMENT_STATUSES })
  @IsOptional() @IsIn(PAYMENT_STATUSES) status?: PaymentStatus;

  @ApiPropertyOptional() @IsOptional() @IsString() invoiceRef?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit = 20;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  offset = 0;
}

class RecordPayoutDto {
  @ApiProperty() @IsString() agentId!: string;
  @ApiProperty() @IsString() orderRef!: string;
  @ApiProperty() @IsInt() amountMinor!: number;
}

class SetClaimStatusDto {
  @ApiProperty({ enum: CLAIM_STATUSES }) @IsIn(CLAIM_STATUSES) status!: 'submitted' | 'recovered' | 'written_off';
}

class RecordPettyCashDto {
  @ApiProperty() @IsString() office!: string;
  @ApiProperty() @IsInt() amountMinor!: number;
  @ApiProperty({ enum: PETTY_CASH_KINDS }) @IsIn(PETTY_CASH_KINDS) kind!: PettyCashKind;
  @ApiProperty() @IsString() @MinLength(1) memo!: string;
}

class RequestBankChangeDto {
  @ApiProperty() @IsString() supplierRef!: string;
  @ApiProperty() @IsString() accountName!: string;
  @ApiProperty() @IsString() iban!: string;
  @ApiProperty() @IsString() bankName!: string;
}

@ApiTags('finance: invoices')
@ApiBearerAuth()
@Controller('invoices')
export class InvoiceController {
  constructor(private readonly invoices: InvoiceService) {}

  @Get('order/:orderRef/release-eligibility')
  @ApiOperation({ summary: 'Fully-paid determination for goods release (invoice:read, scoped)' })
  releaseEligibility(@CurrentActor() actor: Actor, @Param('orderRef') orderRef: string) {
    return this.invoices.releaseEligibility(actor, orderRef);
  }

  @Get('order/:orderRef')
  @ApiOperation({ summary: 'Read the invoice for an order (invoice:read, scoped + masked)' })
  readByOrder(@CurrentActor() actor: Actor, @Param('orderRef') orderRef: string) {
    return this.invoices.readByOrder(actor, orderRef);
  }

  @Get(':ref')
  @ApiOperation({ summary: 'Read an invoice + installments (invoice:read, scoped + masked)' })
  read(@CurrentActor() actor: Actor, @Param('ref') ref: string) {
    return this.invoices.read(actor, ref);
  }
}

@ApiTags('finance: payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}

  @Post()
  @ApiOperation({ summary: 'Capture a payment proof (payment:create, scoped)' })
  uploadProof(@CurrentActor() actor: Actor, @Body() dto: UploadProofDto) {
    return this.payments.uploadProof(actor, { ...dto, amountMinor: dto.amountMinor as Minor });
  }

  @Post(':ref/verify')
  @ApiOperation({ summary: 'FINANCE-ONLY verification; settles named installment (payment:approve)' })
  verify(@CurrentActor() actor: Actor, @Param('ref') ref: string) {
    return this.payments.verify(actor, ref);
  }

  @Post(':ref/reject')
  @ApiOperation({ summary: 'Reject a captured payment (payment:approve)' })
  reject(@CurrentActor() actor: Actor, @Param('ref') ref: string, @Body() dto: RejectPaymentDto) {
    return this.payments.reject(actor, ref, dto.reason);
  }

  @Get()
  @ApiOperation({
    summary: 'List in-scope payments — the verification queue (payment:read, scoped; updatedAt desc)',
  })
  list(@CurrentActor() actor: Actor, @Query() q: ListPaymentsQueryDto) {
    return this.payments.list(
      actor,
      { status: q.status, invoiceRef: q.invoiceRef },
      { limit: q.limit, offset: q.offset },
    );
  }

  @Get(':ref')
  @ApiOperation({ summary: 'Read a payment (payment:read, scoped + masked)' })
  read(@CurrentActor() actor: Actor, @Param('ref') ref: string) {
    return this.payments.read(actor, ref);
  }
}

@ApiTags('finance: commission')
@ApiBearerAuth()
@Controller('commissions')
export class CommissionController {
  constructor(private readonly commission: CommissionService) {}

  @Post('payouts')
  @ApiOperation({ summary: 'Record a commission payout (commission:payout)' })
  recordPayout(@CurrentActor() actor: Actor, @Body() dto: RecordPayoutDto) {
    return this.commission.recordPayout(actor, { ...dto, amountMinor: dto.amountMinor as Minor });
  }

  @Get('agents/:agentId/balance')
  @ApiOperation({ summary: 'Running commission balance for an agent (commission:read, scoped)' })
  balance(@CurrentActor() actor: Actor, @Param('agentId') agentId: string) {
    return this.commission.balanceFor(actor, agentId);
  }

  @Get('agents/:agentId/ledger')
  @ApiOperation({ summary: 'Full commission ledger for an agent (commission:read, scoped)' })
  ledger(@CurrentActor() actor: Actor, @Param('agentId') agentId: string) {
    return this.commission.ledgerFor(actor, agentId);
  }
}

@ApiTags('finance: forwarder claims')
@ApiBearerAuth()
@Controller('forwarder-claims')
export class ForwarderClaimController {
  constructor(private readonly claims: ForwarderClaimService) {}

  @Get(':ref')
  @ApiOperation({ summary: 'Read a forwarder claim (claim:read)' })
  read(@CurrentActor() actor: Actor, @Param('ref') ref: string) {
    return this.claims.read(actor, ref);
  }

  @Patch(':ref/status')
  @ApiOperation({ summary: 'Move a claim through its recovery lifecycle (claim:update)' })
  setStatus(@CurrentActor() actor: Actor, @Param('ref') ref: string, @Body() dto: SetClaimStatusDto) {
    return this.claims.setStatus(actor, ref, dto.status);
  }
}

@ApiTags('finance: petty cash')
@ApiBearerAuth()
@Controller('petty-cash')
export class PettyCashController {
  constructor(private readonly pettyCash: PettyCashService) {}

  @Post()
  @ApiOperation({ summary: 'Record a petty-cash movement (pettyCash:create)' })
  record(@CurrentActor() actor: Actor, @Body() dto: RecordPettyCashDto) {
    return this.pettyCash.record(actor, { ...dto, amountMinor: dto.amountMinor as Minor });
  }

  @Get(':office/balance')
  @ApiOperation({ summary: 'Petty-cash balance for an office (pettyCash:read)' })
  balance(@CurrentActor() actor: Actor, @Param('office') office: string) {
    return this.pettyCash.balance(actor, office);
  }
}

@ApiTags('finance: supplier bank')
@ApiBearerAuth()
@Controller('supplier-bank')
export class SupplierBankController {
  constructor(private readonly bank: SupplierBankService) {}

  @Post('changes')
  @ApiOperation({ summary: 'Request a supplier bank-detail change (payment:approve)' })
  requestChange(@CurrentActor() actor: Actor, @Body() dto: RequestBankChangeDto) {
    return this.bank.requestChange(actor, dto);
  }

  @Post('changes/:ref/approve')
  @ApiOperation({ summary: 'Approve a bank change; applies on second distinct approval (payment:approve)' })
  approve(@CurrentActor() actor: Actor, @Param('ref') ref: string) {
    return this.bank.approve(actor, ref);
  }

  @Get(':supplierRef')
  @ApiOperation({ summary: 'Read the active supplier bank account (supplier:read)' })
  readAccount(@CurrentActor() actor: Actor, @Param('supplierRef') supplierRef: string) {
    return this.bank.readAccount(actor, supplierRef);
  }
}

export const FINANCE_CONTROLLERS = [
  InvoiceController,
  PaymentController,
  CommissionController,
  ForwarderClaimController,
  PettyCashController,
  SupplierBankController,
];
