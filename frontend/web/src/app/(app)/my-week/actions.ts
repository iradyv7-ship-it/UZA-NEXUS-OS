'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authedCall } from '@/lib/api';

/**
 * Agree to this week — add, edit or drop the objectives the meeting proposed.
 *
 * The API flips the plan from `draft` to `active` on this call, and that flip is the whole
 * point of the screen. Until a person has touched their own plan, what exists is a record of
 * what a meeting said about them.
 *
 * Objectives arrive as parallel arrays from the form: one `text` and one `source` per row.
 * Empty rows are dropped here rather than sent, so somebody can clear a line they disagree
 * with simply by emptying the box.
 */
export async function confirmWeekAction(formData: FormData): Promise<void> {
  const texts = formData.getAll('objectiveText').map((v) => String(v).trim());
  const sources = formData.getAll('objectiveSource').map((v) => String(v));
  const dones = new Set(formData.getAll('objectiveDone').map((v) => String(v)));

  const objectives = texts
    .map((text, i) => ({
      text,
      status: dones.has(String(i)) ? ('done' as const) : ('todo' as const),
      source: sources[i] === 'minutes' ? ('minutes' as const) : ('self' as const),
    }))
    .filter((o) => o.text);

  if (!objectives.length) redirect('/my-week?err=empty');

  const res = await authedCall('/umurimo/week/mine', { method: 'PATCH', body: { objectives } });
  if (res.kind === 'unauthorized') redirect('/login');
  if (res.kind !== 'ok') redirect('/my-week?err=save');

  revalidatePath('/my-week');
  redirect('/my-week?ok=confirmed');
}

/**
 * File the weekly report.
 *
 * `highlights` is required by the service and that is the contract: a report that does not
 * say what you finished is not a report, and accepting one would make the "who has not filed"
 * list meaningless.
 */
export async function fileReportAction(formData: FormData): Promise<void> {
  const highlights = String(formData.get('highlights') ?? '').trim();
  const blockers = String(formData.get('blockers') ?? '').trim();
  const nextWeek = String(formData.get('nextWeek') ?? '').trim();
  const asking = String(formData.get('asking') ?? '').trim();

  if (!highlights) redirect('/my-week?err=highlights');

  const res = await authedCall('/umurimo/week/report', {
    method: 'POST',
    body: {
      highlights,
      ...(blockers ? { blockers } : {}),
      ...(nextWeek ? { nextWeek } : {}),
      ...(asking ? { asking } : {}),
    },
  });
  if (res.kind === 'unauthorized') redirect('/login');
  if (res.kind !== 'ok') redirect('/my-week?err=report');

  revalidatePath('/my-week');
  redirect('/my-week?ok=filed');
}

/** Take a blocker: give it my name and a date. Both together, or it is not owned. */
export async function ownBlockerAction(formData: FormData): Promise<void> {
  const ref = String(formData.get('ref') ?? '');
  const ownerId = String(formData.get('ownerId') ?? '');
  const dueAt = String(formData.get('dueAt') ?? '');

  if (!ref || !ownerId || !dueAt) redirect('/my-week?err=own');

  const res = await authedCall(`/umurimo/blockers/${ref}/own`, {
    method: 'PATCH',
    body: { ownerId, dueAt: new Date(dueAt).toISOString() },
  });
  if (res.kind === 'unauthorized') redirect('/login');
  if (res.kind !== 'ok') redirect('/my-week?err=own');

  revalidatePath('/my-week');
  redirect('/my-week?ok=owned');
}

/** Clear a blocker, with a note saying how. The note is what makes the record worth keeping. */
export async function clearBlockerAction(formData: FormData): Promise<void> {
  const ref = String(formData.get('ref') ?? '');
  const note = String(formData.get('note') ?? '').trim();

  if (!ref || !note) redirect('/my-week?err=clear');

  const res = await authedCall(`/umurimo/blockers/${ref}/clear`, {
    method: 'PATCH',
    body: { note },
  });
  if (res.kind === 'unauthorized') redirect('/login');
  if (res.kind !== 'ok') redirect('/my-week?err=clear');

  revalidatePath('/my-week');
  redirect('/my-week?ok=cleared');
}
