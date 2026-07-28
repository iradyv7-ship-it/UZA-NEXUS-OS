import { Injectable, Logger } from '@nestjs/common';
import type { EventEnvelope } from '@uza/contracts';
import { OrderService } from '../trade/order/order.service';
import { InvoiceService } from '../finance/invoice/invoice.service';
import { CommissionService } from '../finance/commission/commission.service';
import { ForwarderClaimService } from '../finance/claim/forwarder-claim.service';
import { SupplierScoreService } from '../sourcing/supplier/supplier-score.service';
import { OrderPaymentService } from '../logistics/consumers/order-payment.service';
import { QualityGateService } from '../logistics/consumers/quality-gate.service';
import { buildDispatchMap, dispatchEnvelope, type DispatchMap } from './dispatch-map';

/**
 * Wraps the pure dispatch registry with DI. NestJS injects each handler-owning service
 * (these are exported by the feature modules imported by EventDispatchModule) and this
 * service assembles the registry once, then delivers each envelope the BullMQ consumer
 * hands it. Delivery, idempotency and the failure policy all live in `dispatchEnvelope`.
 */
@Injectable()
export class EventDispatchService {
  private readonly logger = new Logger('EventDispatch');
  private readonly map: DispatchMap;

  constructor(
    order: OrderService,
    invoice: InvoiceService,
    commission: CommissionService,
    claim: ForwarderClaimService,
    supplierScore: SupplierScoreService,
    orderPayment: OrderPaymentService,
    qualityGate: QualityGateService,
  ) {
    this.map = buildDispatchMap({ order, invoice, commission, claim, supplierScore, orderPayment, qualityGate });
  }

  async dispatch(envelope: EventEnvelope): Promise<void> {
    await dispatchEnvelope(this.map, envelope, (outcome, env) => {
      if (outcome.ok) {
        this.logger.log(`${env.name} ${env.eventId} -> ${outcome.consumer}: ok`);
      } else {
        this.logger.error(
          `${env.name} ${env.eventId} -> ${outcome.consumer}: FAILED (will retry): ` +
            `${(outcome.error as Error)?.message ?? outcome.error}`,
        );
      }
    });
  }
}
