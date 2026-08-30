import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { UzaError, type UzaErrorCode } from '@uza/contracts';

/** Minimal shape of the underlying HTTP response — avoids a hard dependency on express types. */
interface HttpResponse {
  status(code: number): HttpResponse;
  json(body: unknown): HttpResponse;
}

/**
 * Maps a domain `UzaError` onto an HTTP status, so the frontend can localise from the
 * stable `code` and render `nextAction`/`context`. Nest's own HttpExceptions
 * (ValidationPipe 400, NotFoundException 404, UnauthorizedException 401) are left to the
 * default handler — this filter only translates the contract's error taxonomy.
 *
 * Status mapping:
 *  - ACCESS_DENIED_ROLE / ACCESS_DENIED_SCOPE                 → 403 Forbidden
 *  - PAYMENT_SHORT / DEPOSIT_BELOW_MINIMUM / PAYMENT_NOT_VERIFIED,
 *    every GATE_* (booking, QC, release) and CAPA_REINSPECTION_FAILED
 *                                                              → 409 Conflict
 *    (a precondition/state gate the caller can act on, not a malformed request)
 */
@Catch(UzaError)
export class UzaExceptionFilter implements ExceptionFilter {
  catch(error: UzaError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<HttpResponse>();
    const status = STATUS_BY_CODE[error.code] ?? HttpStatus.BAD_REQUEST;
    response.status(status).json({ statusCode: status, error: error.toJSON() });
  }
}

const STATUS_BY_CODE: Record<UzaErrorCode, number> = {
  ACCESS_DENIED_ROLE: HttpStatus.FORBIDDEN,
  ACCESS_DENIED_SCOPE: HttpStatus.FORBIDDEN,
  PAYMENT_SHORT: HttpStatus.CONFLICT,
  PAYMENT_NOT_VERIFIED: HttpStatus.CONFLICT,
  DEPOSIT_BELOW_MINIMUM: HttpStatus.CONFLICT,
  GATE_VARIANCE_UNRESOLVED: HttpStatus.CONFLICT,
  GATE_PRELOADING_UNPAID: HttpStatus.CONFLICT,
  GATE_MIXED_DESTINATION: HttpStatus.CONFLICT,
  GATE_QC_NOT_RELEASED: HttpStatus.CONFLICT,
  CAPA_REINSPECTION_FAILED: HttpStatus.CONFLICT,
  GATE_BALANCE_OUTSTANDING: HttpStatus.CONFLICT,
};
