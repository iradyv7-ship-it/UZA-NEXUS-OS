'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authedCall } from '@/lib/api';

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
  const res = await authedCall<{ ref: string }>('/orders', {
    method: 'POST',
    body: { quotationRef: ref },
  });
  if (res.kind === 'unauthorized') redirect('/login');
  if (res.kind !== 'ok') redirect(`/quotations/${ref}?err=order`);
  const orderRef = res.kind === 'ok' ? res.data.ref : '';
  // The new order surfaces in the live queue (GET /orders) on next dashboard load.
  redirect(`/orders/${orderRef}`);
}
