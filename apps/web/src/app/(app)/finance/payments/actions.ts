'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authedCall } from '@/lib/api';

/**
 * FINANCE-ONLY. Verifying settles the named installment and publishes payment.verified —
 * which is the ONLY thing that activates procurement (on the confirmation trigger). The API
 * enforces this (payment:approve); if a non-finance role reaches here it gets 403 and we
 * surface it. A short payment is rejected server-side (PAYMENT_SHORT → 409) — we relay that.
 */
export async function verifyPaymentAction(formData: FormData): Promise<void> {
  const ref = String(formData.get('ref') ?? '');
  const orderRef = String(formData.get('orderRef') ?? '');
  const res = await authedCall<{ orderRef: string }>(`/payments/${ref}/verify`, { method: 'POST' });
  if (res.kind === 'unauthorized') redirect('/login');
  if (res.kind === 'denied') redirect('/finance/payments?err=denied');
  if (res.kind !== 'ok') redirect('/finance/payments?err=verify');
  revalidatePath('/finance/payments');
  // The order is now procurement_active (event fan-out). Surface it and link back.
  redirect(`/finance/payments?verified=${orderRef}`);
}

export async function rejectPaymentAction(formData: FormData): Promise<void> {
  const ref = String(formData.get('ref') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  if (!reason) redirect('/finance/payments?err=reason');
  const res = await authedCall(`/payments/${ref}/reject`, { method: 'POST', body: { reason } });
  if (res.kind === 'unauthorized') redirect('/login');
  if (res.kind === 'denied') redirect('/finance/payments?err=denied');
  if (res.kind !== 'ok') redirect('/finance/payments?err=reject');
  revalidatePath('/finance/payments');
  redirect('/finance/payments?rejected=1');
}
