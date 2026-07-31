import { NextResponse } from 'next/server';
import { API_URL } from '@/lib/api';

/**
 * Kick off the Google OAuth flow.
 *
 * The "Sign in with Google" button is a plain top-level link to THIS web route (Google
 * blocks its consent screen inside iframes, so we must navigate the whole window). We
 * server-redirect to the API's `GET /auth/google`, which mints the signed `state` and 302s
 * on to Google. Bouncing through here keeps the API origin (`UZA_API_URL`) server-side —
 * it never has to be baked into client JS.
 */
export function GET() {
  return NextResponse.redirect(`${API_URL}/auth/google`, 302);
}
