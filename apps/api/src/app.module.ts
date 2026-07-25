import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { PlatformModule } from './platform/platform.module';
import { TradeModule } from './trade/trade.module';
import { SourcingModule } from './sourcing/sourcing.module';
import { QualityModule } from './quality/quality.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    PlatformModule,
    TradeModule,
    SourcingModule,
    QualityModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
