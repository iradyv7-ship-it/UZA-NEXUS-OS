import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './google.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuditModule } from '../audit/audit.module';

/**
 * The documented local-dev placeholder, shipped verbatim in `.env.example` so a fresh
 * clone runs without a secrets step. Fine on localhost. NOT fine in production — see
 * `jwtSecretOrThrow` below, which is the only thing standing between an unset
 * JWT_SECRET in prod and every bearer token being forgeable by anyone who has read
 * this file (or this whole public-ish repo).
 */
const DEV_ONLY_JWT_SECRET = 'dev-only-change-me';

/**
 * `??` only falls back on null/undefined, NOT on an empty string — so a production env
 * that defines JWT_SECRET="" (an unfilled `.env.prod.example` copied verbatim, or a
 * container env var declared but never populated) would previously sign every token
 * with an empty string, silently. Treat "unset or empty" the same way, and refuse to
 * boot in production on either the empty case or the known dev placeholder.
 */
function jwtSecretOrThrow(config: ConfigService): string {
  const configured = config.get<string>('JWT_SECRET')?.trim();
  const isProd = config.get<string>('NODE_ENV') === 'production';

  if (!configured) {
    if (isProd) {
      throw new Error(
        'JWT_SECRET is not set. Refusing to boot in production with no signing secret ' +
          '— every bearer token would otherwise be forgeable. Set JWT_SECRET in the ' +
          'deployment environment (see .env.prod.example).',
      );
    }
    return DEV_ONLY_JWT_SECRET;
  }

  if (isProd && configured === DEV_ONLY_JWT_SECRET) {
    throw new Error(
      `JWT_SECRET is still the documented local-dev placeholder ("${DEV_ONLY_JWT_SECRET}"). ` +
        'Refusing to boot in production with a secret that is checked into a public file — ' +
        'set a real, unique JWT_SECRET for this deployment.',
    );
  }

  return configured;
}

@Module({
  imports: [
    AuditModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: jwtSecretOrThrow(config),
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
