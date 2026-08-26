'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { apiCall, authedCall } from '@/lib/api';
import { getSession } from '@/lib/session';

/**
 * DEV SCAFFOLDING. The venture_manager can build a project → quotation from a clarified
 * lead (their real grants), but NOT create a customer/lead (that is a sales_agent action,
 * upstream of this slice). To give the dashboard something real to act on, this helper
 * bootstraps the upstream half using a seeded agent login, then runs the venture-manager
 * half with the LOGGED-IN user's own token. Credentials are env-configurable dev defaults;
 * this is not part of the production auth story.
 */
/**
 * No default password. A hard-coded fallback is a working credential on any host where the
 * variable was not set, and "it is only a dev default" stops being true the moment there is a
 * public URL. Unset means the demo action is unavailable, which is the safe failure.
 */
const SEED_AGENT_EMAIL = process.env.UZA_SEED_AGENT_EMAIL ?? '';
const SEED_AGENT_PASSWORD = process.env.UZA_SEED_AGENT_PASSWORD ?? '';

interface LoginResp { accessToken: string }
interface RefResp { ref: string }

export async function seedDealAction(): Promise<void> {
  const session = await getSession();
  if (!session) redirect('/login');

  // Unconfigured on purpose in production. Without the seed agent's credentials in the
  // environment this action does nothing rather than falling back to a known password.
  if (!SEED_AGENT_EMAIL || !SEED_AGENT_PASSWORD) redirect('/dashboard?err=seed_disabled');

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

  // The new quotation now appears in the live queue (GET /quotations) — no worklist to update.
  revalidatePath('/dashboard');
  redirect('/dashboard');
}

/**
 * Secondary "jump to a record" utility. The queue itself comes from the live lists; this
 * just lets a VM open a specific quotation/order by its readable ref. It navigates straight
 * to the detail screen (which enforces its own auth/masking) — it no longer tracks anything.
 */
export async function trackRefAction(formData: FormData): Promise<void> {
  const ref = String(formData.get('ref') ?? '').trim().toUpperCase();
  if (/^QUO-/.test(ref)) redirect(`/quotations/${ref}`);
  if (/^ORD-/.test(ref)) redirect(`/orders/${ref}`);
  redirect('/dashboard?err=track');
}
