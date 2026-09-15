import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { canManageShipments } from '@/lib/permissions';
import { authedCall } from '@/lib/api';
import { Card, Field } from '@/components/ui';
import { StatePanel } from '@/components/States';
import type { ShipmentView } from '@/lib/types';
import {
  updateShipmentDetailsAction,
  recordPartnerRateAction,
  createAndAttachConsigneeAction,
} from '../actions';

export const dynamic = 'force-dynamic';

const ENTRY_PORTS = ['MOMBASA', 'DAR_ES_SALAAM'] as const;
const VENTURES = ['BULK', 'MOBILITY', 'EMPOWER', 'CLOUD', 'GROUP', 'NEXUS'] as const;
const INPUT = 'w-full rounded-lg border border-border px-3 py-2 text-sm';

interface ShipmentTiming {
  departureDate: string;
  arrivalDate: string;
  departureConfirmed: boolean;
  arrivalConfirmed: boolean;
  transitTimeDays: number | null;
}

/** A real `<label>` wrapper for form inputs — distinct from `@/components/ui`'s `Field`,
 *  which renders a read-only `<dt>`/`<dd>` pair for the info panel below, not a form control. */
function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-fgMuted">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

export default async function OpsShipmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ ref: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!canManageShipments(session.actor)) redirect('/week');
  const { ref } = await params;
  const { ok, err } = await searchParams;

  const [shipmentRes, timingRes] = await Promise.all([
    authedCall<ShipmentView>(`/shipments/${ref}`),
    authedCall<{ shipment: unknown; timing: ShipmentTiming }>(`/containers/${ref}/timing`),
  ]);

  if (shipmentRes.kind === 'unauthorized') redirect('/login');
  if (shipmentRes.kind !== 'ok') {
    return (
      <StatePanel
        tone="red"
        title="Shipment not found"
        body="It may not exist, or is outside your scope."
      />
    );
  }
  const s = shipmentRes.data;
  const timing = timingRes.kind === 'ok' ? timingRes.data.timing : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-fg">{s.ref}</h1>
        <p className="text-sm text-fgMuted">
          {s.destination} · {s.ventureCode ?? 'unassigned venture'} · {s.status}
        </p>
      </div>

      {ok && <StatePanel title="Saved" body="The update was recorded." />}
      {err && <StatePanel tone="red" title="Could not save" body={decodeURIComponent(err)} />}

      <Card>
        <dl className="divide-y divide-border">
          <Field label="Container">
            <span className="font-mono">{s.container}</span>
          </Field>
          <Field label="Carrier">{s.carrier}</Field>
          <Field label="Vessel / voyage">
            {s.vesselName ?? '—'} {s.voyageNumber ? `/ ${s.voyageNumber}` : ''}
          </Field>
          <Field label="Entry port">{s.entryPort ?? 'not yet known'}</Field>
          <Field label="Planned ETD / ETA">
            {s.etdPlanned} → {s.etaPlanned}
          </Field>
          <Field label="Actual ETD / ETA">
            {s.etdActual ?? 'not yet confirmed'} → {s.etaActual ?? 'not yet confirmed'}
          </Field>
          {timing && (
            <Field label="Transit time (derived)">
              {timing.transitTimeDays !== null ? `${timing.transitTimeDays} days` : '—'}
              {!timing.departureConfirmed || !timing.arrivalConfirmed ? ' (still planned)' : ''}
            </Field>
          )}
          <Field label="Consignee">{s.consigneeRef ?? 'defaults to the ordering customer'}</Field>
        </dl>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-fgMuted">
          Update vessel / voyage / dates
        </h2>
        <form action={updateShipmentDetailsAction} className="space-y-3">
          <input type="hidden" name="ref" value={s.ref} />
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Vessel name">
              <input name="vesselName" defaultValue={s.vesselName ?? ''} className={INPUT} />
            </FormField>
            <FormField label="Voyage number">
              <input name="voyageNumber" defaultValue={s.voyageNumber ?? ''} className={INPUT} />
            </FormField>
            <FormField label="Entry port">
              <select name="entryPort" defaultValue={s.entryPort ?? ''} className={INPUT}>
                <option value="">Not yet known</option>
                {ENTRY_PORTS.map((p) => (
                  <option key={p} value={p}>
                    {p.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Venture">
              <select name="ventureCode" defaultValue={s.ventureCode ?? ''} className={INPUT}>
                <option value="">Unassigned</option>
                {VENTURES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Actual departure">
              <input
                name="etdActual"
                type="date"
                defaultValue={s.etdActual ?? ''}
                className={INPUT}
              />
            </FormField>
            <FormField label="Actual arrival">
              <input
                name="etaActual"
                type="date"
                defaultValue={s.etaActual ?? ''}
                className={INPUT}
              />
            </FormField>
            <FormField label="Correct container number">
              <input name="container" placeholder={s.container} className={INPUT} />
            </FormField>
          </div>
          <p className="text-xs text-fgSubtle">
            Correcting the container number re-sends the &ldquo;container confirmed&rdquo;
            notice to the client and customer care.
          </p>
          <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-surface">
            Save
          </button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-fgMuted">
          Record this week&apos;s partner rate
        </h2>
        <p className="mb-2 text-xs text-fgMuted">
          Append-only — this never overwrites a previous rate, it logs a new one.
        </p>
        <form action={recordPartnerRateAction} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="shipmentRef" value={s.ref} />
          <FormField label="Partner id">
            <input name="partnerId" defaultValue={s.partnerId ?? ''} required className={INPUT} />
          </FormField>
          <FormField label="Destination">
            <input name="destination" defaultValue={s.destination} required className={INPUT} />
          </FormField>
          <FormField label="Rate per revenue ton (major units)">
            <input
              name="rateMajor"
              type="number"
              step="0.01"
              min="0.01"
              required
              className={INPUT}
            />
          </FormField>
          <FormField label="Note">
            <input name="note" className={INPUT} />
          </FormField>
          <div className="sm:col-span-2">
            <button className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-fg">
              Log this rate
            </button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-fgMuted">
          Set the consignee (receiving party)
        </h2>
        <p className="mb-2 text-xs text-fgMuted">
          Who collects this shipment — often different from the ordering customer.
        </p>
        <form action={createAndAttachConsigneeAction} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="shipmentRef" value={s.ref} />
          <FormField label="Name">
            <input name="name" required className={INPUT} />
          </FormField>
          <FormField label="Phone">
            <input name="phone" required className={INPUT} />
          </FormField>
          <FormField label="Address">
            <input name="address" required className={INPUT} />
          </FormField>
          <FormField label="TIN number">
            <input name="tinNumber" className={INPUT} />
          </FormField>
          <FormField label="Email">
            <input name="email" type="email" className={INPUT} />
          </FormField>
          <div className="sm:col-span-2">
            <button className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-fg">
              Save consignee
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
