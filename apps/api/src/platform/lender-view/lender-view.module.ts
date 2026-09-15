import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditModule } from '../audit/audit.module';
import { AuditService } from '../audit/audit.service';
import { LenderViewService, NOT_YET_INSTRUMENTED } from './lender-view.service';

/**
 * Lender disclosure: entitlement, consent, redaction and the audit trail.
 *
 * The data source is bound to NOT_YET_INSTRUMENTED here, deliberately and visibly. Nothing
 * feeds training, wallet, utilisation or inspections yet, and the view reports those as
 * absent rather than as zero. When the Mobility platform and the wallet adopt the UZA ID,
 * a real source replaces this one binding and nothing else changes.
 */
@Module({
  imports: [AuditModule],
  providers: [
    {
      provide: LenderViewService,
      inject: [PrismaService, AuditService],
      useFactory: (prisma: PrismaService, audit: AuditService) =>
        new LenderViewService(prisma, audit, NOT_YET_INSTRUMENTED),
    },
  ],
  exports: [LenderViewService],
})
export class LenderViewModule {}
