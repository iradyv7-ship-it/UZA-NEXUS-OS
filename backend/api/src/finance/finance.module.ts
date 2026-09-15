import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../platform/authorization/authorization.module';
import { OutboxModule } from '../platform/outbox/outbox.module';
import { NotificationModule } from '../platform/notification/notification.module';
import { InvoiceService } from './invoice/invoice.service';
import { PaymentService } from './payment/payment.service';
import { CommissionService } from './commission/commission.service';
import { ForwarderClaimService } from './claim/forwarder-claim.service';
import { PettyCashService } from './petty-cash/petty-cash.service';
import { SupplierBankService } from './supplier-bank/supplier-bank.service';
import { FINANCE_CONTROLLERS } from './finance.controllers';

/**
 * finance-commission: the money half of the corridor — invoices, payment verification,
 * the commission ledger with clawback, forwarder claims, petty cash and dual-approval
 * supplier bank details.
 *
 * Depends on the platform's AuthorizationService (service-layer enforcement), the
 * transactional OutboxService (event publishing) and NotificationService (clawback and
 * claim fan-out). PrismaService is provided globally. The CTO wires this into AppModule
 * during integration; it is NOT self-registered here, and tests instantiate the services
 * directly (no DI container), per the platform handoff.
 */
@Module({
  imports: [AuthorizationModule, OutboxModule, NotificationModule],
  controllers: [...FINANCE_CONTROLLERS],
  providers: [
    InvoiceService,
    PaymentService,
    CommissionService,
    ForwarderClaimService,
    PettyCashService,
    SupplierBankService,
  ],
  exports: [
    InvoiceService,
    PaymentService,
    CommissionService,
    ForwarderClaimService,
    PettyCashService,
    SupplierBankService,
  ],
})
export class FinanceModule {}
