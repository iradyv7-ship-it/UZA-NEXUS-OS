'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authedCall } from '@/lib/api';

const PAGE = '/admin/access';

/**
 * CEO-ONLY, enforced by the API (`role:assign` / `user:update` — only `*:*` holds them).
 * Approving a Google sign-up assigns a real role via the same append-only RoleAssignment
 * path an admin would use for anyone; the person gets that role on their next sign-in
 * (the JWT they hold still says `pending` until then).
 */
export async function approveAccessAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const ref = String(formData.get('ref') ?? '');
  const role = String(formData.get('role') ?? '');
  if (!id || !role) redirect(`${PAGE}?err=1`);
  const res = await authedCall(`/identity/users/${encodeURIComponent(id)}/roles`, {
    method: 'POST',
    body: { role, reason: 'Approved Google sign-up' },
  });
  if (res.kind === 'unauthorized') redirect('/login');
  if (res.kind !== 'ok') redirect(`${PAGE}?err=1`);
  revalidatePath(PAGE);
  redirect(`${PAGE}?approved=${encodeURIComponent(ref)}&role=${encodeURIComponent(role)}`);
}

/** Deny = disable. The row stays (so the same email can't just sign up again) but can't log in. */
export async function denyAccessAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const ref = String(formData.get('ref') ?? '');
  if (!id) redirect(`${PAGE}?err=1`);
  const res = await authedCall(`/identity/users/${encodeURIComponent(id)}/disable`, {
    method: 'POST',
  });
  if (res.kind === 'unauthorized') redirect('/login');
  if (res.kind !== 'ok') redirect(`${PAGE}?err=1`);
  revalidatePath(PAGE);
  redirect(`${PAGE}?denied=${encodeURIComponent(ref)}`);
}
