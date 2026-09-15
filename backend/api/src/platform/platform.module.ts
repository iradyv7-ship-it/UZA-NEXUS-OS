import { Module } from '@nestjs/common';
import { AuditModule } from './audit/audit.module';
import { AuthorizationModule } from './authorization/authorization.module';
import { AuthModule } from './auth/auth.module';
import { IdentityModule } from './identity/identity.module';
import { NotificationModule } from './notification/notification.module';
import { OutboxModule } from './outbox/outbox.module';
import { LenderViewModule } from './lender-view/lender-view.module';
import { UzaIdModule } from './uza-id/uza-id.module';

/**
 * The platform foundation every other module depends on: identity + auth, the single
 * authorisation enforcement point, the append-only audit log, notification dispatch, the
 * transactional outbox, and the UZA ID that gives one person one identifier everywhere.
 */
@Module({
  imports: [
    AuditModule,
    AuthorizationModule,
    AuthModule,
    IdentityModule,
    NotificationModule,
    OutboxModule,
    UzaIdModule,
    LenderViewModule,
  ],
  exports: [
    AuditModule,
    AuthorizationModule,
    AuthModule,
    IdentityModule,
    NotificationModule,
    OutboxModule,
    UzaIdModule,
    LenderViewModule,
  ],
})
export class PlatformModule {}
