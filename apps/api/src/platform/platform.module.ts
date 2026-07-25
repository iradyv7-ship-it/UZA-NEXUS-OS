import { Module } from '@nestjs/common';
import { AuditModule } from './audit/audit.module';
import { AuthorizationModule } from './authorization/authorization.module';
import { AuthModule } from './auth/auth.module';
import { IdentityModule } from './identity/identity.module';
import { NotificationModule } from './notification/notification.module';
import { OutboxModule } from './outbox/outbox.module';

/**
 * The platform foundation every other module depends on: identity + auth, the single
 * authorisation enforcement point, the append-only audit log, notification dispatch and
 * the transactional outbox.
 */
@Module({
  imports: [
    AuditModule,
    AuthorizationModule,
    AuthModule,
    IdentityModule,
    NotificationModule,
    OutboxModule,
  ],
  exports: [
    AuditModule,
    AuthorizationModule,
    AuthModule,
    IdentityModule,
    NotificationModule,
    OutboxModule,
  ],
})
export class PlatformModule {}
