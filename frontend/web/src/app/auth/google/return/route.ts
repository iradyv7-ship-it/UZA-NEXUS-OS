import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { apiCall } from '@/lib/api';
import { setSession, type Actor } from '@/lib/session';
import { homePathFor } from '@/lib/permissions';

/**
 * Google OAuth return route (Option A — the callback lands on the WEB app).
 *
 * `GOOGLE_CALLBACK_URL` points here (`${WEB_ORIGIN}/auth/google/return`). Google redirects
 * the browser back with `code` + `state`; we forward them to the API's
 * `GET /auth/google/callback` **server-side**, so the token is minted and read entirely on
 * the server and never touches client JS. On success we set the SAME httpOnly
 * `uza_token`/`uza_actor` cookies the password login sets, then land the user on their home.
 *
 * The API stays the single place that verifies the Google ID token and issues the app JWT;
 * this route is just the trusted courier for the round trip.
 */
interface CallbackResponse {
  accessToken: string;
  actor: Actor;
  mfaRequired: boolean;
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const code = params.get('code');
  const state = params.get('state');

  // Google itself can bounce back with `error=access_denied` (user cancelled) or with the
  // code/state missing — never call the API with a half-formed request.
  if (params.get('error') || !code || !state) {
    redirect('/login?error=google_failed');
  }

  const query = `?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
  const res = await apiCall<CallbackResponse>(`/auth/google/callback${query}`, { method: 'GET' });

  if (res.kind === 'ok' && res.data?.accessToken) {
    await setSession(res.data.accessToken, res.data.actor);
    redirect(homePathFor(res.data.actor));
  }

  // 401 = the Google account is verified but not permitted (no matching active user).
  if (res.kind === 'unauthorized') {
    redirect('/login?error=unauthorized');
  }

  // 503 = creds were removed between render and click; everything else = network / bad state.
  if (res.kind === 'error' && res.status === 503) {
    redirect('/login?error=not_configured');
  }
  redirect('/login?error=google_failed');
}
