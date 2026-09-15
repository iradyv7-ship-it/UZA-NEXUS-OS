import { SetMetadata } from '@nestjs/common';

/**
 * Marks a route (or a whole controller) as reachable WITHOUT a Bearer token.
 * The globally-registered JwtAuthGuard reads this metadata and skips authentication.
 * Only `/auth/login` and `/health` carry it — everything else is protected by default.
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
