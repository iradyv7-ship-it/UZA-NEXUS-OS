import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { PlatformModule } from './platform/platform.module';
import { TradeModule } from './trade/trade.module';
import { SourcingModule } from './sourcing/sourcing.module';
import { QualityModule } from './quality/quality.module';
import { FinanceModule } from './finance/finance.module';
import { LogisticsModule } from './logistics/logistics.module';
import { CommandModule } from './command/command.module';
import { EventDispatchModule } from './integration/event-dispatch.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    PlatformModule,
    TradeModule,
    SourcingModule,
    QualityModule,
    FinanceModule,
    LogisticsModule,
    CommandModule,
    // Composition root for cross-module event fan-out: starts the BullMQ consumer that
    // delivers published outbox events to each module's idempotent handlers.
    EventDispatchModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
