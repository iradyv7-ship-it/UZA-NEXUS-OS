import { cookies } from 'next/headers';
import type { Locale } from '@/i18n';
import { DEFAULT_LOCALE, isLocale } from '@/i18n';

/**
 * Auth + session state lives in httpOnly cookies, never localStorage (charter rule).
 * The JWT is httpOnly so client JS cannot read it; the Actor is stored alongside it
 * (also httpOnly) and surfaced to the UI only through server components. The API — not
 * this cookie — remains the security boundary; the Actor here is for rendering labels
 * and choosing which screens to offer, not for authorising anything.
 */

export const TOKEN_COOKIE = 'uza_token';
export const ACTOR_COOKIE = 'uza_actor';
export const LOCALE_COOKIE = 'uza_locale';
export const WORKLIST_COOKIE = 'uza_worklist';

export type Role =
  | 'ceo' | 'venture_manager' | 'china_sourcing' | 'china_warehouse'
  | 'front_office' | 'finance' | 'sales_agent' | 'customer' | 'logistics_partner';

export interface Actor {
  userId: string;
  role: Role;
  office: string;
  scope: {
    customerId?: string;
    customerIds?: string[];
    shipmentRefs?: string[];
  };
}

export interface Session {
  token: string;
  actor: Actor;
}

const secureCookie = process.env.NODE_ENV === 'production';

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(TOKEN_COOKIE)?.value;
  const actorRaw = jar.get(ACTOR_COOKIE)?.value;
  if (!token || !actorRaw) return null;
  try {
    const actor = JSON.parse(actorRaw) as Actor;
    return { token, actor };
  } catch {
    return null;
  }
}

export async function setSession(token: string, actor: Actor): Promise<void> {
  const jar = await cookies();
  const opts = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: secureCookie,
    path: '/',
    // Mirror the API's short-lived access token (JWT_TTL default 3600s).
    maxAge: 60 * 60,
  };
  jar.set(TOKEN_COOKIE, token, opts);
  jar.set(ACTOR_COOKIE, JSON.stringify(actor), opts);
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(TOKEN_COOKIE);
  jar.delete(ACTOR_COOKIE);
  jar.delete(WORKLIST_COOKIE);
}

export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  const value = jar.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
