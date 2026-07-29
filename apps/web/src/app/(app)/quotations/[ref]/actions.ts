'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authedCall } from '@/lib/api';
import { addToWorklist } from '@/lib/worklist';

export async function approveQuotationAction(formData: FormData): Promise<void> {
  const ref = String(formData.get('ref') ?? '');
  const res = await authedCall(`/quotations/${ref}/approve`, { method: 'POST' });
  if (res.kind === 'unauthorized') redirect('/login');
  if (res.kind !== 'ok') redirect(`/quotations/${ref}?err=approve`);
  revalidatePath(`/quotations/${ref}`);
  redirect(`/quotations/${ref}`);
}

export async function createOrderAction(formData: FormData): Promise<void> {
  const ref = String(formData.get('ref') ?? '');
  const projectName = String(formData.get('projectName') ?? '') || undefined;
  const res = await authedCall<{ ref: string }>('/orders', { method: 'POST', body: { quotationRef: ref } });
  if (res.kind === 'unauthorized') redirect('/login');
  if (res.kind !== 'ok') redirect(`/quotations/${ref}?err=order`);
  const orderRef = res.kind === 'ok' ? res.data.ref : '';
  await addToWorklist({ kind: 'order', ref: orderRef, projectName });
  redirect(`/orders/${orderRef}`);
}
