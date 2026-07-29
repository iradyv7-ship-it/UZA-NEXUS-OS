'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { LOCALE_COOKIE, clearSession } from '@/lib/session';
import { isLocale } from '@/i18n';

export async function setLocaleAction(formData: FormData): Promise<void> {
  const value = String(formData.get('locale') ?? '');
  if (isLocale(value)) {
    const jar = await cookies();
    jar.set(LOCALE_COOKIE, value, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  }
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect('/login');
}
