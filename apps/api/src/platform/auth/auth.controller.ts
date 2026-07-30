import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './google.service';
import { Public } from './public.decorator';

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;

  @IsOptional()
  @IsString()
  mfaCode?: string;
}

/** Minimal response surface used for the OAuth redirect — avoids a hard express type dep,
 *  mirroring UzaExceptionFilter's approach. `redirect(url)` is a 302 by default. */
interface RedirectResponse {
  redirect(url: string): void;
}

/** The exact body the frontend keys on when Google credentials are not configured. */
const NOT_CONFIGURED = { error: 'google_signin_not_configured' } as const;

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly google: GoogleAuthService,
  ) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Authenticate; returns { accessToken, actor, mfaRequired }' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password, dto.mfaCode);
  }

  /**
   * Start Google sign-in: 302 to Google's consent screen with a signed `state` (CSRF).
   * 503 { error: 'google_signin_not_configured' } when Google env is not set.
   */
  @Public()
  @Get('google')
  @ApiOperation({ summary: 'Redirect (302) to Google OAuth consent, or 503 if unconfigured' })
  async google_start(@Res({ passthrough: false }) res: RedirectResponse): Promise<void> {
    if (!this.google.isConfigured()) {
      throw new ServiceUnavailableException(NOT_CONFIGURED);
    }
    const state = await this.google.createState();
    res.redirect(this.google.consentUrl(state));
  }

  /**
   * Google callback: validate `state`, exchange `code`, verify the Google ID token, match
   * an existing active user by email, and return { accessToken, actor, mfaRequired } — the
   * same shape POST /auth/login returns. Denials (unknown/disabled/expired/MFA) surface as
   * 401 and are audited. 503 when unconfigured.
   */
  @Public()
  @Get('google/callback')
  @ApiOperation({ summary: 'Complete Google sign-in; returns { accessToken, actor } or 401' })
  google_callback(@Query('code') code?: string, @Query('state') state?: string) {
    if (!this.google.isConfigured()) {
      throw new ServiceUnavailableException(NOT_CONFIGURED);
    }
    if (!code) {
      throw new BadRequestException('Missing authorization code');
    }
    return this.google.handleCallback(code, state);
  }
}
