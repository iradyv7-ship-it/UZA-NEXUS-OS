'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authedCall } from '@/lib/api';

export async function readMemoAction(formData: FormData): Promise<void> {
  const ref = String(formData.get('ref') ?? '');
  const res = await authedCall(`/planning/memos/${ref}/read`, { method: 'POST' });
  if (res.kind === 'unauthorized') redirect('/login');
  revalidatePath('/memos');
  revalidatePath('/nexus');
}

/** Acknowledging is a second, deliberate act. Reading is not agreeing to do something. */
export async function ackMemoAction(formData: FormData): Promise<void> {
  const ref = String(formData.get('ref') ?? '');
  const res = await authedCall(`/planning/memos/${ref}/ack`, { method: 'POST' });
  if (res.kind === 'unauthorized') redirect('/login');
  revalidatePath('/memos');
  revalidatePath('/nexus');
}

export async function sendMemoAction(formData: FormData): Promise<void> {
  const audience = String(formData.get('audience') ?? 'everyone');
  const body = {
    subject: String(formData.get('subject') ?? '').trim(),
    body: String(formData.get('body') ?? '').trim(),
    audience,
    needsAck: formData.get('needsAck') === 'on',
    ...(audience === 'department'
      ? { departmentCode: String(formData.get('departmentCode') ?? '') }
      : {}),
    ...(audience === 'person' ? { toId: String(formData.get('toId') ?? '') } : {}),
    ...(formData.get('linkedRef') ? { linkedRef: String(formData.get('linkedRef')) } : {}),
  };
  if (!body.subject || !body.body) redirect('/memos?err=empty');

  const res = await authedCall<{ sentTo: number }>('/planning/memos', { method: 'POST', body });
  if (res.kind === 'unauthorized') redirect('/login');
  if (res.kind === 'denied') redirect('/memos?err=denied');
  if (res.kind !== 'ok') redirect('/memos?err=send');
  revalidatePath('/memos');
  redirect(`/memos?sent=${res.data.sentTo}`);
}
