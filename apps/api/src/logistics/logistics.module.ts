import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../platform/authorization/authorization.module';
import { OutboxModule } from '../platform/outbox/outbox.module';
import { NotificationModule } from '../platform/notification/notification.module';
import { ReceivingService } from './warehouse/receiving.service';
import { ReleaseService } from './warehouse/release.service';
import { OrderPaymentService } from './consumers/order-payment.service';
import { QualityGateService } from './consumers/quality-gate.service';
import { ContainerService } from './logistics/container.service';
import { FreightService } from './logistics/freight.service';
import { TrackingService } from './logistics/tracking.service';
import { DeliveryService } from './logistics/delivery.service';
import { PartnerPortalService } from './logistics/partner-portal.service';
import { LOGISTICS_CONTROLLERS } from './logistics.controllers';

/**
 * logistics-warehouse (Sprint 3): the physical chain and the last real control point over
 * an order — receiving, three-way volumetric reconciliation, QC release, destination
 * allocation, containers (three booking gates), freight allocation, tracking, delivery
 * with proof, and the Imari partner portal.
 *
 * Depends on the platform's AuthorizationService (service-layer enforcement), the
 * transactional OutboxService (event publishing) and NotificationService (delay fan-out).
 * PrismaService is provided globally. The CTO wires this into AppModule during
 * integration; it is NOT self-registered here, and tests instantiate services directly
 * (no DI container), per the platform handoff.
 */
@Module({
  imports: [AuthorizationModule, OutboxModule, NotificationModule],
  controllers: [...LOGISTICS_CONTROLLERS],
  providers: [
    ReceivingService,
    ReleaseService,
    OrderPaymentService,
    QualityGateService,
    ContainerService,
    FreightService,
    TrackingService,
    DeliveryService,
    PartnerPortalService,
  ],
  exports: [
    ReceivingService,
    ReleaseService,
    OrderPaymentService,
    QualityGateService,
    ContainerService,
    FreightService,
    TrackingService,
    DeliveryService,
    PartnerPortalService,
  ],
})
export class LogisticsModule {}
