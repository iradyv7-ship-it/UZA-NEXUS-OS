import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../platform/authorization/authorization.module';
import { OutboxModule } from '../platform/outbox/outbox.module';
import { NotificationModule } from '../platform/notification/notification.module';
import { VisitService } from './visit/visit.service';
import { InspectionService } from './inspection/inspection.service';
import { CapaService } from './capa/capa.service';
import { QUALITY_CONTROLLERS } from './quality.controllers';

/**
 * quality: factory visits, inspections (four stages, derived pass/conditional/fail),
 * auto-opened CAPAs and the release gate. Publishes `inspection.recorded`,
 * `quality.failed` and `capa.closed`.
 *
 * A critical defect fails the inspection, blocks release and auto-opens a CAPA with no
 * override; a CAPA closes only against a human-approved passing reinspection.
 *
 * Depends on the platform AuthorizationService, OutboxService and NotificationService.
 * The CTO wires this into AppModule at integration; it is NOT self-registered here.
 */
@Module({
  imports: [AuthorizationModule, OutboxModule, NotificationModule],
  controllers: [...QUALITY_CONTROLLERS],
  providers: [VisitService, InspectionService, CapaService],
  exports: [VisitService, InspectionService, CapaService],
})
export class QualityModule {}
