'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authedCall } from '@/lib/api';

const refresh = () => {
  revalidatePath('/tasks');
  revalidatePath('/nexus');
  revalidatePath('/register');
};

export async function createTaskAction(formData: FormData): Promise<void> {
  const title = String(formData.get('title') ?? '').trim();
  const assigneeId = String(formData.get('assigneeId') ?? '').trim();
  const dueAt = String(formData.get('dueAt') ?? '');
  // The three the founder's own rule requires. Refused here as well as server-side, so the
  // person gets the message on the form rather than as a redirect.
  if (!title || !assigneeId || !dueAt) redirect('/tasks?err=incomplete');

  const res = await authedCall('/command/tasks', {
    method: 'POST',
    body: {
      title,
      assigneeId,
      dueAt: new Date(dueAt).toISOString(),
      description: String(formData.get('description') ?? '').trim() || undefined,
      priority: String(formData.get('priority') ?? 'medium'),
      linkedRef: String(formData.get('linkedRef') ?? '').trim() || undefined,
    },
  });
  if (res.kind === 'unauthorized') redirect('/login');
  if (res.kind === 'denied') redirect('/tasks?err=denied');
  if (res.kind !== 'ok') redirect('/tasks?err=create');
  refresh();
  redirect('/tasks?created=1');
}

export async function advanceTaskAction(formData: FormData): Promise<void> {
  const ref = String(formData.get('ref') ?? '');
  const to = String(formData.get('to') ?? '');
  const res = await authedCall(`/command/tasks/${ref}`, { method: 'PATCH', body: { status: to } });
  if (res.kind === 'unauthorized') redirect('/login');
  refresh();
}

export async function completeTaskAction(formData: FormData): Promise<void> {
  const ref = String(formData.get('ref') ?? '');
  const res = await authedCall(`/command/tasks/${ref}/complete`, { method: 'POST' });
  if (res.kind === 'unauthorized') redirect('/login');
  refresh();
}
