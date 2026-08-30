import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Actor } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { toActor } from './actor';
import { IS_PUBLIC_KEY } from './public.decorator';

interface AccessTokenClaims {
  readonly sub: string;
  readonly ref: string;
  readonly role: string;
}

/**
 * The single authentication gate for the HTTP surface. Registered globally (APP_GUARD),
 * so EVERY route is protected unless it carries `@Public()`.
 *
 * It verifies the Bearer token issued by `/auth/login`, then reconstructs the full `Actor`
 * (userId, role, office, scope) from the persisted user — NOT from the token body — so a
 * scope or role change takes effect on the next request and a disabled/expired principal is
 * refused even while its token is unexpired. Authorisation itself (role/scope/masking) is
 * never done here: it stays at the service layer via AuthorizationService.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      actor?: Actor;
    }>();

    const token = this.bearerToken(request.headers.authorization);
    if (!token) throw new UnauthorizedException('Missing bearer token');

    let claims: AccessTokenClaims;
    try {
      claims = await this.jwt.verifyAsync<AccessTokenClaims>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: claims.sub },
      include: { office: true },
    });
    if (!user) throw new UnauthorizedException('Unknown principal');
    if (user.disabledAt) throw new UnauthorizedException('Account disabled');
    if (user.expiresAt && user.expiresAt.getTime() <= Date.now()) {
      // Partner accounts expire; an expired token holder is refused even mid-window.
      throw new UnauthorizedException('Account expired');
    }

    request.actor = toActor({
      ref: user.ref,
      role: user.role,
      officeId: user.officeId,
      officeCode: user.office?.code,
      scopeCustomerId: user.scopeCustomerId,
      scopeCustomerIds: user.scopeCustomerIds,
      scopeShipmentRefs: user.scopeShipmentRefs,
    });
    return true;
  }

  private bearerToken(header: string | undefined): string | undefined {
    if (!header) return undefined;
    const [scheme, value] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && value ? value : undefined;
  }
}
