import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../platform/authorization/authorization.module';
import { OutboxModule } from '../platform/outbox/outbox.module';
import { SupplierService } from './supplier/supplier.service';
import { SupplierScoreService } from './supplier/supplier-score.service';
import { RfqService } from './quote/rfq.service';
import { PurchaseOrderService } from './po/purchase-order.service';

/**
 * sourcing: supplier intelligence and procurement — suppliers (EN/CN, lifecycle,
 * certifications, evidence-logged score), RFQs, quotes (with cost basis), and purchase
 * orders. Publishes `po.issued`; consumes `warehouse.receiptRecorded` (SupplierScoreService)
 * to move the supplier score on declared-vs-measured variance.
 *
 * Depends on the platform AuthorizationService and OutboxService. PrismaService is global.
 * The CTO wires this into AppModule at integration; it is NOT self-registered here.
 */
@Module({
  imports: [AuthorizationModule, OutboxModule],
  providers: [SupplierService, SupplierScoreService, RfqService, PurchaseOrderService],
  exports: [SupplierService, SupplierScoreService, RfqService, PurchaseOrderService],
})
export class SourcingModule {}
