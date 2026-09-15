import { Module } from '@nestjs/common';
import { TradeModule } from '../trade/trade.module';
import { FinanceModule } from '../finance/finance.module';
import { SourcingModule } from '../sourcing/sourcing.module';
import { LogisticsModule } from '../logistics/logistics.module';
import { EventDispatchService } from './event-dispatch.service';
import { EventConsumerService } from './event-consumer.service';

/**
 * The integration / composition-root module for event fan-out. It is the ONE place allowed
 * to import several feature modules at once, so it can wire published outbox events to the
 * consumer handlers those modules already expose. Feature modules still never import each
 * other, and `platform/*` never imports any of them.
 *
 * QualityModule is not imported: quality PUBLISHES `inspection.recorded`/`quality.failed`
 * but consumes nothing, and finance PUBLISHES `payment.verified` (its accrual is inline),
 * so neither has a handler bound here.
 */
@Module({
  imports: [TradeModule, FinanceModule, SourcingModule, LogisticsModule],
  providers: [EventDispatchService, EventConsumerService],
  exports: [EventDispatchService],
})
export class EventDispatchModule {}
