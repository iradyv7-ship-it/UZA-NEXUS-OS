import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../platform/authorization/authorization.module';
import { OutboxModule } from '../platform/outbox/outbox.module';
import { CustomerService } from './customer/customer.service';
import { IntakeService } from './intake/intake.service';
import { ProjectService } from './project/project.service';
import { QuotationService } from './quotation/quotation.service';
import { OrderService } from './order/order.service';

/**
 * trade-flow: the commercial spine from enquiry to confirmed order.
 *
 * Depends on the platform's AuthorizationService (service-layer enforcement) and the
 * transactional OutboxService (event publishing). PrismaService is provided globally.
 * The CTO wires this into AppModule during integration; it is NOT self-registered here.
 */
@Module({
  imports: [AuthorizationModule, OutboxModule],
  providers: [CustomerService, IntakeService, ProjectService, QuotationService, OrderService],
  exports: [CustomerService, IntakeService, ProjectService, QuotationService, OrderService],
})
export class TradeModule {}
