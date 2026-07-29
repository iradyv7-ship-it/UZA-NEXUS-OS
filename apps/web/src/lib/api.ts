import { getSession } from './session';

const API_URL = process.env.UZA_API_URL ?? 'http://127.0.0.1:3000';

/**
 * A discriminated result so every screen can render loading / ok / denied / not-found /
 * error explicitly instead of guessing from a thrown value. The API is the security
 * boundary; here we only translate its HTTP codes into UI states.
 */
export type ApiResult<T> =
  | { kind: 'ok'; data: T }
  | { kind: 'unauthorized' } // 401 — token missing/expired, send to login
  | { kind: 'denied'; code?: string } // 403 — role/scope refused
  | { kind: 'notfound' } // 404
  | { kind: 'error'; status: number; message: string };

interface CallOpts {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  token?: string;
}

/** Low-level call with an explicit token (used by login before a session exists). */
export async function apiCall<T>(path: string, opts: CallOpts = {}): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      cache: 'no-store',
      ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
    });
  } catch {
    return { kind: 'error', status: 0, message: 'network' };
  }

  const text = await res.text();
  const parsed: unknown = text ? safeJson(text) : undefined;

  if (res.ok) return { kind: 'ok', data: parsed as T };
  if (res.status === 401) return { kind: 'unauthorized' };
  if (res.status === 403) return { kind: 'denied', code: errorCode(parsed) };
  if (res.status === 404) return { kind: 'notfound' };
  return { kind: 'error', status: res.status, message: errorMessage(parsed) ?? res.statusText };
}

/** Authenticated call: pulls the JWT from the session cookie. */
export async function authedCall<T>(path: string, opts: Omit<CallOpts, 'token'> = {}): Promise<ApiResult<T>> {
  const session = await getSession();
  if (!session) return { kind: 'unauthorized' };
  return apiCall<T>(path, { ...opts, token: session.token });
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorCode(body: unknown): string | undefined {
  if (body && typeof body === 'object' && 'error' in body) {
    const err = (body as { error?: unknown }).error;
    if (err && typeof err === 'object' && 'code' in err) return String((err as { code: unknown }).code);
  }
  return undefined;
}

function errorMessage(body: unknown): string | undefined {
  if (body && typeof body === 'object') {
    if ('message' in body) return String((body as { message: unknown }).message);
    if ('error' in body) {
      const err = (body as { error?: unknown }).error;
      if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
    }
  }
  return undefined;
}

export { API_URL };
