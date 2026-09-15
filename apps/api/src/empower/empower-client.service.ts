import { Injectable, Logger } from '@nestjs/common';

/**
 * A read-only bridge from the operating layer to UZA Empower's records, which live in the
 * Mobility API (`uza-mobility-bn`).
 *
 * Nexus does not copy Empower's data and does not hold a second truth about it. It asks the
 * Mobility API, as a dedicated service account with FINANCE_ADMIN rights, and shows the
 * answer — so the figures Yves sees in Nexus are the figures the finance team sees in the
 * admin app, at the same moment, from the same tables.
 *
 * Configuration is three environment variables. When they are absent this service says so
 * plainly and every read returns `{ configured: false }` rather than an error page: an
 * unconfigured integration is a state, not a fault.
 *
 *   MOBILITY_API_URL            https://api.uzamobility.com
 *   MOBILITY_SERVICE_EMAIL      the service account (FINANCE_ADMIN; nothing more)
 *   MOBILITY_SERVICE_PASSWORD   its password — a secret, in the API's environment only
 *
 * The access token is cached for a little under its 15-minute life and refreshed by logging
 * in again; no refresh token is stored anywhere.
 */
@Injectable()
export class EmpowerClientService {
  private readonly log = new Logger(EmpowerClientService.name);
  private token: { value: string; expiresAt: number } | null = null;

  get configured(): boolean {
    return Boolean(
      process.env.MOBILITY_API_URL &&
        process.env.MOBILITY_SERVICE_EMAIL &&
        process.env.MOBILITY_SERVICE_PASSWORD,
    );
  }

  private base(): string {
    return (process.env.MOBILITY_API_URL ?? '').replace(/\/$/, '');
  }

  private async login(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now()) return this.token.value;
    const res = await fetch(`${this.base()}/auth/admin/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: process.env.MOBILITY_SERVICE_EMAIL,
        password: process.env.MOBILITY_SERVICE_PASSWORD,
      }),
    });
    if (!res.ok) {
      throw new Error(`Mobility API login failed: HTTP ${res.status}`);
    }
    const body = (await res.json()) as { data?: { accessToken?: string } };
    const value = body.data?.accessToken;
    if (!value) throw new Error('Mobility API login returned no access token');
    // 13 minutes: comfortably inside the 15-minute access token.
    this.token = { value, expiresAt: Date.now() + 13 * 60 * 1000 };
    return value;
  }

  /** GET a Mobility API path as the service account. Returns the `data` envelope. */
  async get<T>(path: string): Promise<T> {
    const token = await this.login();
    const res = await fetch(`${this.base()}${path}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      // Token revoked or rotated under us — log in once more, then give up honestly.
      this.token = null;
      const retry = await fetch(`${this.base()}${path}`, {
        headers: { authorization: `Bearer ${await this.login()}` },
      });
      if (!retry.ok) throw new Error(`Mobility API ${path}: HTTP ${retry.status}`);
      return ((await retry.json()) as { data: T }).data;
    }
    if (!res.ok) throw new Error(`Mobility API ${path}: HTTP ${res.status}`);
    return ((await res.json()) as { data: T }).data;
  }

  /** A wrapper that turns "not configured" and transport failures into a shape a page can render. */
  async safe<T>(path: string): Promise<{ configured: boolean; ok: boolean; data: T | null; error: string | null }> {
    if (!this.configured) {
      return { configured: false, ok: false, data: null, error: 'MOBILITY_API_URL / MOBILITY_SERVICE_EMAIL / MOBILITY_SERVICE_PASSWORD are not set on the Nexus API.' };
    }
    try {
      return { configured: true, ok: true, data: await this.get<T>(path), error: null };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.log.warn(`Empower read failed for ${path}: ${message}`);
      return { configured: true, ok: false, data: null, error: message };
    }
  }
}
