import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { canManageShipments } from '@/lib/permissions';
import { authedCall } from '@/lib/api';
import { Card } from '@/components/ui';
import { StatePanel } from '@/components/States';
import type { ShipmentView } from '@/lib/types';
import { createShipmentAction } from './actions';

export const dynamic = 'force-dynamic';

interface LoadablePackage {
  ref: string;
  orderRef: string;
  customerRef: string;
  kg: number;
  cbm: number;
  destination: string | null;
  cargoType: string;
  goodsDescription: string | null;
}

const VENTURES = ['BULK', 'MOBILITY', 'EMPOWER', 'CLOUD', 'GROUP', 'NEXUS'] as const;
const ENTRY_PORTS = ['MOMBASA', 'DAR_ES_SALAAM'] as const;
const INPUT = 'w-full rounded-lg border border-border px-3 py-2 text-sm';

/**
 * Cecilia's ops workspace (item 5, 2026-09-14 gap-closure audit): pick the venture, fill the
 * per-shipment form (vessel/voyage, departure date, container, expected arrival at
 * Mombasa/Dar es Salaam), and book against the real three-gate API. Gated on
 * `canManageShipments` — see its doc comment for why this is provisional.
 */
export default async function OpsShipmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!canManageShipments(session.actor)) redirect('/week');
  const { ok, err } = await searchParams;

  const [loadableRes, shipmentsRes] = await Promise.all([
    authedCall<LoadablePackage[]>('/release/loadable'),
    authedCall<ShipmentView[]>('/shipments?limit=50'),
  ]);
  const loadable = loadableRes.kind === 'ok' ? loadableRes.data : [];
  const shipments = shipmentsRes.kind === 'ok' ? shipmentsRes.data : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-fg">Logistics ops — shipments</h1>
        <p className="text-sm text-fgMuted">
          Book containers, tag the venture, and keep vessel/voyage/container details current.
        </p>
      </div>

      {ok === 'booked' && <StatePanel title="Booked" body="Shipment booked." />}
      {err && (
        <StatePanel tone="red" title="Could not book" body={decodeURIComponent(err)} />
      )}

      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-fgMuted">
          Book a new shipment
        </h2>
        <form action={createShipmentAction} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Venture">
              <select name="ventureCode" className={INPUT} defaultValue="BULK">
                {VENTURES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Container number">
              <input name="container" required className={INPUT} placeholder="MSKU1234567" />
            </Field>
            <Field label="Carrier">
              <input name="carrier" required className={INPUT} placeholder="Maersk" />
            </Field>
            <Field label="Vessel name">
              <input name="vesselName" className={INPUT} placeholder="MV Ever Given" />
            </Field>
            <Field label="Voyage number">
              <input name="voyageNumber" className={INPUT} placeholder="123W" />
            </Field>
            <Field label="Entry port">
              <select name="entryPort" className={INPUT} defaultValue="">
                <option value="">Not yet known</option>
                {ENTRY_PORTS.map((p) => (
                  <option key={p} value={p}>
                    {p.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Planned departure (ETD)">
              <input name="etdPlanned" type="date" required className={INPUT} />
            </Field>
            <Field label="Planned arrival at entry port (ETA)">
              <input name="etaPlanned" type="date" required className={INPUT} />
            </Field>
            <Field label="Logistics partner id">
              <input name="partnerId" className={INPUT} placeholder="IMARI" />
            </Field>
            <Field label="Consignee ref (optional)">
              <input name="consigneeRef" className={INPUT} placeholder="CNE-00001" />
            </Field>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-fgMuted">
              Packages ready to load ({loadable.length})
            </p>
            {loadable.length === 0 ? (
              <p className="rounded-lg bg-surface2 px-3 py-2 text-sm text-fgMuted">
                No packages are QC-released, hold-free and destinated yet — nothing can be
                booked until warehouse release clears some.
              </p>
            ) : (
              <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                {loadable.map((p) => (
                  <li key={p.ref} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="packageRefs" value={p.ref} id={p.ref} />
                    <label htmlFor={p.ref} className="flex-1">
                      <span className="font-mono text-xs">{p.ref}</span> · {p.destination} ·{' '}
                      {p.kg}kg / {p.cbm}cbm
                      {p.cargoType === 'LOOSE' ? ' · LOOSE' : ''}
                      {p.goodsDescription ? ` · ${p.goodsDescription}` : ''}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-surface"
          >
            Book container
          </button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-fgMuted">
          Shipments
        </h2>
        {shipments.length === 0 ? (
          <p className="text-sm text-fgMuted">No shipments yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {shipments.map((s) => (
              <li key={s.ref} className="py-2.5">
                <Link href={`/ops/shipments/${s.ref}`} className="block">
                  <p className="text-sm font-medium text-fg">
                    {s.ref} · {s.destination} · {s.ventureCode ?? 'unassigned venture'}
                  </p>
                  <p className="mt-0.5 text-xs text-fgMuted">
                    {s.carrier} · <span className="font-mono">{s.container}</span> ·{' '}
                    {s.vesselName ?? 'vessel TBD'}
                    {s.voyageNumber ? ` / ${s.voyageNumber}` : ''} · {s.status}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-fgMuted">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}
