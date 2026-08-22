import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import type { CapturedSignal } from './captured-signal';

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';

/**
 * Reads the founder's mailbox.
 *
 * **Read only, permanently.** This class holds no send, reply, label, or delete path and
 * must never gain one. Nexus observing a mailbox is a different thing from Nexus acting in
 * it, and the second requires a decision nobody has made.
 *
 * Configuration is four values, all absent by default — with none of them the source
 * reports itself unconfigured and the sweep carries on with its other sources:
 *
 *   GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN
 *   GMAIL_QUERY   an optional Gmail search expression narrowing what is swept at all
 *
 * GMAIL_QUERY is the first line of defence and the cheapest one: mail that is never
 * fetched cannot be misfiled. Narrow it to the accounts and labels that actually carry
 * business decisions rather than sweeping an entire personal mailbox. Everything fetched
 * then passes through the compartmentalisation rules before it is stored.
 */
@Injectable()
export class GmailSource {
  private readonly logger = new Logger(GmailSource.name);
  private readonly client: OAuth2Client | null;
  private readonly query: string;

  /** One sweep never pulls more than this. A backlog is drained over several sweeps. */
  private static readonly MAX_PER_SWEEP = 40;

  constructor(config: ConfigService) {
    const id = config.get<string>('GMAIL_CLIENT_ID');
    const secret = config.get<string>('GMAIL_CLIENT_SECRET');
    const refresh = config.get<string>('GMAIL_REFRESH_TOKEN');
    this.query = config.get<string>('GMAIL_QUERY') ?? '';

    if (id && secret && refresh) {
      this.client = new OAuth2Client({ clientId: id, clientSecret: secret });
      this.client.setCredentials({ refresh_token: refresh });
    } else {
      this.client = null;
    }
  }

  get configured(): boolean {
    return this.client !== null;
  }

  async collect(since: Date): Promise<CapturedSignal[]> {
    if (!this.client) {
      this.logger.debug('gmail source not configured — skipping');
      return [];
    }

    let token: string;
    try {
      const at = await this.client.getAccessToken();
      if (!at.token) throw new Error('no access token returned');
      token = at.token;
    } catch (err) {
      this.logger.error(`gmail auth failed: ${(err as Error).message}`);
      return [];
    }

    // Gmail's `after:` takes whole seconds. Rounding down risks re-reading a message,
    // which is harmless — the unique constraint absorbs it — where rounding up would
    // silently skip one.
    const after = Math.floor(since.getTime() / 1000);
    const q = [this.query, `after:${after}`].filter(Boolean).join(' ');

    const list = await this.get<{ messages?: { id: string }[] }>(
      `${API}/messages?maxResults=${GmailSource.MAX_PER_SWEEP}&q=${encodeURIComponent(q)}`,
      token,
    );
    if (!list?.messages?.length) return [];

    const out: CapturedSignal[] = [];
    for (const { id } of list.messages) {
      const msg = await this.get<any>(`${API}/messages/${id}?format=full`, token);
      if (!msg) continue;
      const headers: { name: string; value: string }[] = msg.payload?.headers ?? [];
      const header = (n: string) => headers.find((h) => h.name.toLowerCase() === n)?.value ?? '';
      const subject = header('subject') || '(no subject)';
      const from = header('from');
      const body = this.plainText(msg.payload) || msg.snippet || '';

      out.push({
        source: 'email',
        externalId: id,
        title: subject,
        body: `From: ${from}\n\n${body}`.trim(),
        occurredAt: new Date(Number(msg.internalDate) || Date.now()),
      });
    }
    return out;
  }

  private async get<T>(url: string, token: string): Promise<T | null> {
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        this.logger.error(`gmail ${res.status} on ${url.split('?')[0]}`);
        return null;
      }
      return (await res.json()) as T;
    } catch (err) {
      this.logger.error(`gmail request failed: ${(err as Error).message}`);
      return null;
    }
  }

  /** Depth-first for the first text/plain part; falls back to stripping a text/html one. */
  private plainText(part: any): string {
    if (!part) return '';
    if (part.mimeType === 'text/plain' && part.body?.data) return decode(part.body.data);
    for (const child of part.parts ?? []) {
      const found = this.plainText(child);
      if (found) return found;
    }
    if (part.mimeType === 'text/html' && part.body?.data) {
      return decode(part.body.data)
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    return '';
  }
}

const decode = (data: string): string =>
  Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
