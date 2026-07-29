'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { apiCall, authedCall } from '@/lib/api';
import { getSession } from '@/lib/session';
import { addToWorklist, removeFromWorklist } from '@/lib/worklist';

/**
 * DEV SCAFFOLDING. The venture_manager can build a project → quotation from a clarified
 * lead (their real grants), but NOT create a customer/lead (that is a sales_agent action,
 * upstream of this slice). To give the dashboard something real to act on, this helper
 * bootstraps the upstream half using a seeded agent login, then runs the venture-manager
 * half with the LOGGED-IN user's own token. Credentials are env-configurable dev defaults;
 * this is not part of the production auth story.
 */
const SEED_AGENT_EMAIL = process.env.UZA_SEED_AGENT_EMAIL ?? 'agent@uza.rw';
const SEED_AGENT_PASSWORD = process.env.UZA_SEED_AGENT_PASSWORD ?? 'password1';

interface LoginResp { accessToken: string }
interface RefResp { ref: string }

export async function seedDealAction(): Promise<void> {
  const session = await getSession();
  if (!session) redirect('/login');

  // Upstream (agent-owned): customer + lead.
  const login = await apiCall<LoginResp>('/auth/login', {
    method: 'POST',
    body: { email: SEED_AGENT_EMAIL, password: SEED_AGENT_PASSWORD },
  });
  if (login.kind !== 'ok' || !login.data.accessToken) redirect('/dashboard?err=seed');
  const agentToken = login.kind === 'ok' ? login.data.accessToken : '';

  const stamp = new Date().toISOString().slice(11, 19);
  const customerName = `Kivu Traders ${stamp}`;
  const customer = await apiCall<RefResp>('/customers', {
    method: 'POST',
    token: agentToken,
    body: { name: customerName, country: 'CD', phone: `+24390${Date.now() % 10000000}` },
  });
  if (customer.kind !== 'ok') redirect('/dashboard?err=seed');
  const customerRef = customer.kind === 'ok' ? customer.data.ref : '';

  const lead = await apiCall<RefResp>('/leads', {
    method: 'POST',
    token: agentToken,
    body: { customerRef, rawText: 'need 500 solar lamps for Goma retail' },
  });
  if (lead.kind !== 'ok') redirect('/dashboard?err=seed');
  const leadRef = lead.kind === 'ok' ? lead.data.ref : '';

  // Venture-manager half: clarify → project → quotation, with the REAL session token.
  const clarify = await authedCall<RefResp>(`/leads/${leadRef}/clarify`, {
    method: 'POST',
    body: { spec: { item: 'solar lamp', qty: 500 } },
  });
  if (clarify.kind !== 'ok') redirect('/dashboard?err=seed');
  const requestRef = clarify.kind === 'ok' ? clarify.data.ref : '';

  const projectName = 'Solar lamps — Goma retail';
  const project = await authedCall<RefResp>('/projects', {
    method: 'POST',
    body: { requestRef, name: projectName, owner: session.actor.userId },
  });
  if (project.kind !== 'ok') redirect('/dashboard?err=seed');
  const projectRef = project.kind === 'ok' ? project.data.ref : '';

  const quotation = await authedCall<RefResp>('/quotations', {
    method: 'POST',
    body: {
      projectRef,
      supplierUnitCostMinor: 10_000,
      estCostsMinor: { exw: 10_000, ocean: 2_000 },
      qty: 50,
      requiredMargin: 0.2,
    },
  });
  if (quotation.kind !== 'ok') redirect('/dashboard?err=seed');
  const quotationRef = quotation.kind === 'ok' ? quotation.data.ref : '';

  await addToWorklist({ kind: 'quotation', ref: quotationRef, projectName, customerName, ownerId: session.actor.userId });
  revalidatePath('/dashboard');
  redirect('/dashboard');
}

export async function trackRefAction(formData: FormData): Promise<void> {
  const ref = String(formData.get('ref') ?? '').trim().toUpperCase();
  if (/^QUO-/.test(ref)) await addToWorklist({ kind: 'quotation', ref });
  else if (/^ORD-/.test(ref)) await addToWorklist({ kind: 'order', ref });
  else redirect('/dashboard?err=track');
  revalidatePath('/dashboard');
  redirect('/dashboard');
}

export async function removeEntryAction(formData: FormData): Promise<void> {
  const kind = String(formData.get('kind') ?? '') as 'quotation' | 'order';
  const ref = String(formData.get('ref') ?? '');
  if ((kind === 'quotation' || kind === 'order') && ref) await removeFromWorklist(kind, ref);
  revalidatePath('/dashboard');
  redirect('/dashboard');
}
