import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { PlatformModule } from './platform/platform.module';
import { TradeModule } from './trade/trade.module';
import { SourcingModule } from './sourcing/sourcing.module';
import { QualityModule } from './quality/quality.module';
import { FinanceModule } from './finance/finance.module';
import { LogisticsModule } from './logistics/logistics.module';
import { CommandModule } from './command/command.module';
import { PlanningModule } from './planning/planning.module';
import { UmurimoModule } from './umurimo/umurimo.module';
import { IntakeModule } from './intake/intake.module';
import { EventDispatchModule } from './integration/event-dispatch.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Global default: 100 requests/minute per IP. Generous for normal use — this exists to
    // stop scripted abuse, not to throttle a busy human. The auth controller layers a much
    // tighter limit on top (see AuthController) because login/MFA are the actual brute-force
    // targets; JwtAuthGuard denying an unauthenticated request doesn't count against a caller
    // the way a slow, deliberate password/code-guessing script would need to.
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 100 }] }),
    PrismaModule,
    PlatformModule,
    TradeModule,
    SourcingModule,
    QualityModule,
    FinanceModule,
    LogisticsModule,
    CommandModule,
    PlanningModule,
    UmurimoModule,
    IntakeModule,
    // Composition root for cross-module event fan-out: starts the BullMQ consumer that
    // delivers published outbox events to each module's idempotent handlers.
    EventDispatchModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
