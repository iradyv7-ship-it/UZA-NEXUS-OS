'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authedCall } from '@/lib/api';

/**
 * Capture a payment proof for one named installment. This only CAPTURES the claim
 * (status pending_verification) — it settles nothing and activates no procurement. That is
 * Finance's separate verify step. `proofRef` is a free-text reference to the proof
 * (bank slip no. / mobile-money txn id); real file upload is out of scope for this slice.
 */
export async function uploadPaymentProofAction(formData: FormData): Promise<void> {
  const orderRef = String(formData.get('orderRef') ?? '');
  const invoiceRef = String(formData.get('invoiceRef') ?? '');
  const targetTrigger = String(formData.get('targetTrigger') ?? '');
  const amountMinor = Number.parseInt(String(formData.get('amountMinor') ?? ''), 10);
  const proofRef = String(formData.get('proofRef') ?? '').trim();

  if (!invoiceRef || !targetTrigger || !Number.isFinite(amountMinor) || !proofRef) {
    redirect(`/orders/${orderRef}?err=pay`);
  }

  const res = await authedCall('/payments', {
    method: 'POST',
    body: { invoiceRef, amountMinor, proofRef, targetTrigger },
  });
  if (res.kind === 'unauthorized') redirect('/login');
  if (res.kind !== 'ok') redirect(`/orders/${orderRef}?err=pay`);

  // The proof is now pending Finance verification. The order stays awaiting_payment until
  // Finance verifies — the event fan-out flips it to procurement_active, not this action.
  revalidatePath(`/orders/${orderRef}`);
  redirect(`/orders/${orderRef}?paid=${targetTrigger}`);
}
