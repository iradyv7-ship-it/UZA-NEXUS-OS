'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authedCall } from '@/lib/api';

/**
 * Answer a decision. Executive only — the API refuses anyone else and we surface the 403
 * rather than hiding the form, because a person who can see the review can see the queue.
 */
export async function answerDecisionAction(formData: FormData): Promise<void> {
  const ref = String(formData.get('ref') ?? '');
  const answer = String(formData.get('answer') ?? '').trim();
  if (!answer) redirect('/register?err=answer');

  const res = await authedCall(`/planning/decisions/${ref}/answer`, {
    method: 'POST',
    body: { answer },
  });
  if (res.kind === 'unauthorized') redirect('/login');
  if (res.kind === 'denied') redirect('/register?err=denied');
  if (res.kind !== 'ok') redirect('/register?err=answer');

  revalidatePath('/register');
  redirect(`/register?answered=${ref}`);
}

/**
 * Defer — but only to a date. The API rejects a deferral without one, which is the whole
 * reason this exists as a separate action rather than a status dropdown: "later" is what
 * the decision queue was built to make impossible.
 */
export async function deferDecisionAction(formData: FormData): Promise<void> {
  const ref = String(formData.get('ref') ?? '');
  const deferredTo = String(formData.get('deferredTo') ?? '');
  if (!deferredTo) redirect('/register?err=date');

  const res = await authedCall(`/planning/decisions/${ref}/defer`, {
    method: 'POST',
    body: { deferredTo: new Date(deferredTo).toISOString() },
  });
  if (res.kind === 'unauthorized') redirect('/login');
  if (res.kind === 'denied') redirect('/register?err=denied');
  if (res.kind !== 'ok') redirect('/register?err=defer');

  revalidatePath('/register');
  redirect(`/register?deferred=${ref}`);
}
