import { API_URL } from './api';

/**
 * Is Google sign-in wired up on the API?
 *
 * The API answers `GET /auth/google` with a **302** to Google's consent screen when all
 * three Google env vars are set, and **503 { error: "google_signin_not_configured" }` when
 * any is missing (the app still boots either way). We probe that endpoint server-side —
 * `redirect: 'manual'` so we never actually hit Google — and treat only an explicit 503 as
 * "not configured". If the API itself is unreachable we return `false` so the login screen
 * hides the button rather than offering one that leads nowhere.
 *
 * This is a UX gate, not a security boundary: the real check is the API's, and the return
 * route degrades gracefully if config changes between render and click.
 */
export async function isGoogleConfigured(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/auth/google`, {
      method: 'GET',
      redirect: 'manual', // undici -> opaqueredirect (status 0) for the 302; never follows to Google
      cache: 'no-store',
    });
    return res.status !== 503;
  } catch {
    return false;
  }
}
