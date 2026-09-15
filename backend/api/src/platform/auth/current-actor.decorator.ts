import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Actor } from '@uza/contracts';

/**
 * Injects the authenticated `Actor` reconstructed by JwtAuthGuard from the Bearer token.
 * A controller passes it straight to its service, which is where authorisation is enforced.
 * On a protected route the guard guarantees this is present; it is only ever undefined on a
 * `@Public()` route, which must not read it.
 */
export const CurrentActor = createParamDecorator((_data: unknown, ctx: ExecutionContext): Actor => {
  const request = ctx.switchToHttp().getRequest<{ actor: Actor }>();
  return request.actor;
});
