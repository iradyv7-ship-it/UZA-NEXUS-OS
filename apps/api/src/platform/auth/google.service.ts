import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { randomUUID } from 'node:crypto';
import { AuthService, type LoginResult } from './auth.service';

/** The single verified fact we take from Google: who they are, and whether Google
 *  vouches for the email. Everything else (role, scope) comes from the matched user. */
export interface GoogleIdentity {
  readonly email: string;
  readonly emailVerified: boolean;
  readonly sub: string;
  readonly name?: string;
}

const STATE_PURPOSE = 'google_oauth_state';
const GOOGLE_SCOPES = ['openid', 'email', 'profile'];

/**
 * Google / OIDC sign-in as an ALTERNATE CREDENTIAL. This service verifies a Google
 * identity; it does not decide authorisation — it hands the verified email to
 * `AuthService.loginWithGoogle`, which applies the same match-only, no-auto-provision
 * rules as password login.
 *
 * It is optional by construction: if GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET /
 * GOOGLE_CALLBACK_URL are not all set, `isConfigured()` is false and the controller
 * answers 503 so the app still boots without Google credentials.
 *
 * CSRF is covered by a signed, short-lived `state` token (a JWT carrying a nonce and a
 * purpose claim). The callback verifies the signature and purpose before touching the
 * code, so a forged or replayed state is rejected. This binds nothing to a browser
 * session because the platform is stateless-JWT with no session store; the signature +
 * 10-minute expiry is the integrity guarantee. Documented in docs/handoff/google-signin.md.
 */
@Injectable()
export class GoogleAuthService {
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly callbackUrl?: string;

  constructor(
    config: ConfigService,
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {
    this.clientId = config.get<string>('GOOGLE_CLIENT_ID') || undefined;
    this.clientSecret = config.get<string>('GOOGLE_CLIENT_SECRET') || undefined;
    this.callbackUrl = config.get<string>('GOOGLE_CALLBACK_URL') || undefined;
  }

  /** True only when every Google credential is present. The endpoints answer 503 otherwise. */
  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.callbackUrl);
  }

  /** Sign a short-lived, single-purpose state token for CSRF protection. */
  createState(): Promise<string> {
    return this.jwt.signAsync({ purpose: STATE_PURPOSE, nonce: randomUUID() }, { expiresIn: '10m' });
  }

  /** Throw if the returned state is missing, forged, expired or not our state purpose. */
  async verifyState(state: string | undefined): Promise<void> {
    if (!state) throw new UnauthorizedException('Missing OAuth state');
    let payload: { purpose?: string };
    try {
      payload = await this.jwt.verifyAsync(state);
    } catch {
      throw new UnauthorizedException('Invalid OAuth state');
    }
    if (payload.purpose !== STATE_PURPOSE) {
      throw new UnauthorizedException('Invalid OAuth state');
    }
  }

  /** The Google consent URL to 302 the browser to. Caller must have checked isConfigured(). */
  consentUrl(state: string): string {
    return this.oauthClient().generateAuthUrl({
      access_type: 'online',
      scope: GOOGLE_SCOPES,
      state,
      prompt: 'select_account',
    });
  }

  /**
   * Exchange the authorization `code` and VERIFY the resulting Google ID token against
   * GOOGLE_CLIENT_ID. Unverified claims are never trusted — `verifyIdToken` checks the
   * signature, issuer and audience. This is the single seam that talks to Google; tests
   * stub it to inject a fake verified payload rather than hitting Google.
   */
  async resolveGoogleIdentity(code: string): Promise<GoogleIdentity> {
    const client = this.oauthClient();
    const { tokens } = await client.getToken(code);
    const idToken = tokens.id_token;
    if (!idToken) throw new UnauthorizedException('Google did not return an ID token');

    const ticket = await client.verifyIdToken({ idToken, audience: this.clientId });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.sub) {
      throw new UnauthorizedException('Google identity is missing an email');
    }
    return {
      email: payload.email,
      emailVerified: payload.email_verified === true,
      sub: payload.sub,
      name: payload.name,
    };
  }

  /**
   * Full callback: validate state, resolve + verify the Google identity, require a
   * Google-verified email, then match an existing active user and issue the app JWT + Actor.
   */
  async handleCallback(code: string, state: string | undefined): Promise<LoginResult> {
    await this.verifyState(state);
    const identity = await this.resolveGoogleIdentity(code);
    if (!identity.emailVerified) {
      throw new UnauthorizedException('Google has not verified this email address');
    }
    return this.auth.loginWithGoogle(identity.email, identity.sub);
  }

  private oauthClient(): OAuth2Client {
    return new OAuth2Client({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      redirectUri: this.callbackUrl,
    });
  }
}
