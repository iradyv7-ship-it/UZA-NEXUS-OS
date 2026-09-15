'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authedCall } from '@/lib/api';

/**
 * File this week's check-in against one initiative.
 *
 * The API upserts on [initiativeRef, weekOf], so filing twice in a week edits the first
 * entry rather than adding a second — a person who remembers something at 4pm on Friday
 * should be able to add it without creating a duplicate week.
 *
 * `moved` is required by the service. That is the whole contract: a check-in that does not
 * say what moved is not a check-in, and letting one through would make the review's
 * "silent" list meaningless.
 */
export async function checkinAction(formData: FormData): Promise<void> {
  const ref = String(formData.get('initiativeRef') ?? '');
  const moved = String(formData.get('moved') ?? '').trim();
  const blocked = String(formData.get('blocked') ?? '').trim();
  const needsFromCeo = String(formData.get('needsFromCeo') ?? '').trim();

  if (!moved) redirect('/week?err=moved');

  const res = await authedCall(`/planning/initiatives/${ref}/checkin`, {
    method: 'POST',
    body: {
      moved,
      ...(blocked ? { blocked } : {}),
      ...(needsFromCeo ? { needsFromCeo } : {}),
    },
  });

  if (res.kind === 'unauthorized') redirect('/login');
  if (res.kind === 'denied') redirect('/week?err=denied');
  if (res.kind !== 'ok') redirect('/week?err=checkin');

  revalidatePath('/week');
  revalidatePath('/register');
  redirect(`/week?filed=${ref}`);
}
