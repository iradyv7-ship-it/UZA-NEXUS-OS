import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './google.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    AuditModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'dev-only-change-me',
        signOptions: { expiresIn: config.get<string>('JWT_TTL') ?? '3600s' },
      }),
    }),
  ],
  providers: [
    AuthService,
    // Google/OIDC sign-in as an alternate credential. Optional: 503s when unconfigured.
    GoogleAuthService,
    // Registered globally: every route is authenticated unless it carries @Public().
    // Provided here so the guard can inject the JwtService configured above.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  controllers: [AuthController],
  exports: [AuthService, GoogleAuthService],
})
export class AuthModule {}
