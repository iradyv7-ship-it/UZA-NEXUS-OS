'use server';

import { redirect } from 'next/navigation';
import { apiCall } from '@/lib/api';
import { setSession, type Actor } from '@/lib/session';

export interface LoginState {
  error?: 'invalid' | 'network';
}

interface LoginResponse {
  accessToken: string;
  actor: Actor;
  mfaRequired: boolean;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  const res = await apiCall<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });

  if (res.kind === 'error' && res.status === 0) return { error: 'network' };
  if (res.kind !== 'ok' || !res.data.accessToken) return { error: 'invalid' };

  await setSession(res.data.accessToken, res.data.actor);
  redirect('/dashboard');
}
