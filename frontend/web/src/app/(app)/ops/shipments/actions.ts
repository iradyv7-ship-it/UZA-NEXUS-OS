'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authedCall } from '@/lib/api';

/**
 * Book a container through the real three-gate API (`POST /containers`). Any gate failure
 * (variance unresolved / pre-loading unpaid / mixed destination / QC not released) comes
 * back from the API as a distinct, actionable error — surfaced via the `err` query param
 * rather than swallowed, because this workspace is exactly where that error needs to land.
 */
export async function createShipmentAction(formData: FormData): Promise<void> {
  const packageRefs = formData.getAll('packageRefs').map((v) => String(v));
  const container = String(formData.get('container') ?? '').trim();
  const carrier = String(formData.get('carrier') ?? '').trim();
  const etdPlanned = String(formData.get('etdPlanned') ?? '').trim();
  const etaPlanned = String(formData.get('etaPlanned') ?? '').trim();
  const vesselName = String(formData.get('vesselName') ?? '').trim();
  const voyageNumber = String(formData.get('voyageNumber') ?? '').trim();
  const entryPort = String(formData.get('entryPort') ?? '').trim();
  const ventureCode = String(formData.get('ventureCode') ?? '').trim();
  const partnerId = String(formData.get('partnerId') ?? '').trim();
  const consigneeRef = String(formData.get('consigneeRef') ?? '').trim();

  if (packageRefs.length === 0 || !container || !carrier || !etdPlanned || !etaPlanned) {
    redirect('/ops/shipments?err=required');
  }

  const res = await authedCall('/containers', {
    method: 'POST',
    body: {
      packageRefs,
      container,
      carrier,
      etdPlanned,
      etaPlanned,
      ...(vesselName ? { vesselName } : {}),
      ...(voyageNumber ? { voyageNumber } : {}),
      ...(entryPort ? { entryPort } : {}),
      ...(ventureCode ? { ventureCode } : {}),
      ...(partnerId ? { partnerId } : {}),
      ...(consigneeRef ? { consigneeRef } : {}),
    },
  });
  if (res.kind === 'unauthorized') redirect('/login');
  if (res.kind === 'denied') redirect(`/ops/shipments?err=${encodeURIComponent(res.code ?? 'denied')}`);
  // Gate failures (variance unresolved / pre-loading unpaid / mixed destination / QC not
  // released) come back as `kind: 'error'` with a 409 — surface the real message, this is
  // exactly the actionable error the three gates exist to produce.
  if (res.kind !== 'ok') redirect(`/ops/shipments?err=${encodeURIComponent(res.kind === 'error' ? res.message : res.kind)}`);

  revalidatePath('/ops/shipments');
  redirect('/ops/shipments?ok=booked');
}

/**
 * Vessel/voyage/entry-port/actual-date/venture updates, or a container correction — never
 * the three booking gates. `etdActual`/`etaActual` only ever land in the ACTUAL columns
 * (see ShipmentDetailsService); the planned dates are untouched by this form.
 */
export async function updateShipmentDetailsAction(formData: FormData): Promise<void> {
  const ref = String(formData.get('ref') ?? '');
  const vesselName = String(formData.get('vesselName') ?? '').trim();
  const voyageNumber = String(formData.get('voyageNumber') ?? '').trim();
  const entryPort = String(formData.get('entryPort') ?? '').trim();
  const etdActual = String(formData.get('etdActual') ?? '').trim();
  const etaActual = String(formData.get('etaActual') ?? '').trim();
  const container = String(formData.get('container') ?? '').trim();
  const ventureCode = String(formData.get('ventureCode') ?? '').trim();

  if (!ref) redirect('/ops/shipments?err=ref');

  const res = await authedCall(`/containers/${ref}`, {
    method: 'PATCH',
    body: {
      ...(vesselName ? { vesselName } : {}),
      ...(voyageNumber ? { voyageNumber } : {}),
      ...(entryPort ? { entryPort } : {}),
      ...(etdActual ? { etdActual } : {}),
      ...(etaActual ? { etaActual } : {}),
      ...(container ? { container } : {}),
      ...(ventureCode ? { ventureCode } : {}),
    },
  });
  if (res.kind === 'unauthorized') redirect('/login');
  if (res.kind !== 'ok') redirect(`/ops/shipments/${ref}?err=update`);

  revalidatePath(`/ops/shipments/${ref}`);
  redirect(`/ops/shipments/${ref}?ok=updated`);
}

/** Append-only weekly partner rate log (item 7) — never an update, always a new row. */
export async function recordPartnerRateAction(formData: FormData): Promise<void> {
  const shipmentRef = String(formData.get('shipmentRef') ?? '');
  const partnerId = String(formData.get('partnerId') ?? '').trim();
  const destination = String(formData.get('destination') ?? '').trim();
  const rateMajor = String(formData.get('rateMajor') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim();

  if (!partnerId || !destination || !rateMajor) redirect(`/ops/shipments/${shipmentRef}?err=rate`);
  const ratePerRevenueTonMinor = Math.round(Number(rateMajor) * 100);
  if (!Number.isFinite(ratePerRevenueTonMinor) || ratePerRevenueTonMinor <= 0) {
    redirect(`/ops/shipments/${shipmentRef}?err=rate`);
  }

  const res = await authedCall('/partner-rates', {
    method: 'POST',
    body: { partnerId, destination, ratePerRevenueTonMinor, ...(note ? { note } : {}) },
  });
  if (res.kind === 'unauthorized') redirect('/login');
  if (res.kind !== 'ok') redirect(`/ops/shipments/${shipmentRef}?err=rate`);

  revalidatePath(`/ops/shipments/${shipmentRef}`);
  redirect(`/ops/shipments/${shipmentRef}?ok=rate`);
}

/** Create a consignee and attach it to a shipment as the default receiving party in one step
 *  — the common case (a single receiving party for the whole container). */
export async function createAndAttachConsigneeAction(formData: FormData): Promise<void> {
  const shipmentRef = String(formData.get('shipmentRef') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const address = String(formData.get('address') ?? '').trim();
  const tinNumber = String(formData.get('tinNumber') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();

  if (!name || !phone || !address) redirect(`/ops/shipments/${shipmentRef}?err=consignee`);

  const created = await authedCall<{ ref: string }>('/consignees', {
    method: 'POST',
    body: { name, phone, address, ...(tinNumber ? { tinNumber } : {}), ...(email ? { email } : {}) },
  });
  if (created.kind === 'unauthorized') redirect('/login');
  if (created.kind !== 'ok') redirect(`/ops/shipments/${shipmentRef}?err=consignee`);

  const attached = await authedCall(`/consignees/shipments/${shipmentRef}/attach`, {
    method: 'POST',
    body: { consigneeRef: created.data.ref },
  });
  if (attached.kind !== 'ok') redirect(`/ops/shipments/${shipmentRef}?err=consignee`);

  revalidatePath(`/ops/shipments/${shipmentRef}`);
  redirect(`/ops/shipments/${shipmentRef}?ok=consignee`);
}
