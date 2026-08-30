import Link from 'next/link';
import { redirect } from 'next/navigation';
import { translator, type Translate, type Locale } from '@/i18n';
import { getLocale, getSession } from '@/lib/session';
import { homePathFor, isPartner } from '@/lib/permissions';
import { authedCall, type ApiResult } from '@/lib/api';
import { shipmentPromise } from '@/lib/promise';
import { isMasked } from '@/lib/types';
import type { DeliveryView, PackageView, ShipmentView, TrackingEventView } from '@/lib/types';
import { Badge, Card, DetailShell, Field, Masked, Provenance } from '@/components/ui';
import { ResultError } from '@/components/States';

export const dynamic = 'force-dynamic';

function statusTone(status: ShipmentView['status']): 'slate' | 'green' | 'amber' | 'blue' | 'red' {
  switch (status) {
    case 'delivered':
      return 'green';
    case 'arrived':
    case 'in_transit':
      return 'blue';
    case 'delayed':
      return 'red';
    default:
      return 'slate';
  }
}

export default async function PartnerShipmentPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  const locale = await getLocale();
  const t = translator(locale);
  const session = await getSession();
  if (!session) redirect('/login');
  if (!isPartner(session.actor)) redirect(homePathFor(session.actor));

  const res = await authedCall<ShipmentView>(`/partner-portal/shipments/${ref}`);
  if (res.kind === 'unauthorized') redirect('/login');

  if (res.kind !== 'ok') {
    return (
      <DetailShell>
        <BackLink label={t('action.back')} />
        <ResultError result={res} t={t} />
      </DetailShell>
    );
  }

  const s = res.data;
  const promise = shipmentPromise(s.status);

  // Packages, delivery and the tracking timeline in parallel. Each is scoped to this
  // shipment by the API; a delivery not created yet is a 404 we render as "not delivered".
  const [pkgRes, delRes, tlRes] = await Promise.all([
    authedCall<PackageView[]>(`/partner-portal/shipments/${ref}/packages`),
    authedCall<DeliveryView>(`/partner-portal/shipments/${ref}/delivery`),
    authedCall<TrackingEventView[]>(`/tracking/${ref}/timeline`),
  ]);
  if (
    pkgRes.kind === 'unauthorized' ||
    delRes.kind === 'unauthorized' ||
    tlRes.kind === 'unauthorized'
  ) {
    redirect('/login');
  }

  return (
    <DetailShell>
      <BackLink label={t('action.back')} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t(`dest.${s.destination}`)}</h1>
          <p className="font-mono text-xs text-slate-400">{s.ref}</p>
        </div>
        <Badge tone={statusTone(s.status)}>{t(promise.stageKey)}</Badge>
      </div>

      <div className="rounded-xl border border-brand/30 bg-brand-soft/50 p-4">
        <p className="text-[11px] uppercase tracking-wide text-brand/70">{t('dash.col.next')}</p>
        <p className="text-base font-semibold text-slate-900">{t(promise.nextKey)}</p>
        <p className="mt-0.5 text-sm text-slate-600">
          {t('dash.col.owner')}:{' '}
          <span className="font-medium">{t(`owner.${promise.ownerRole}`)}</span>
        </p>
      </div>

      {/* Two reading columns on large screens (carrier + packages | delivery + timeline);
          on a phone they stack in the same top-to-bottom order. */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="space-y-4">
          <Card>
            <dl className="divide-y divide-slate-100">
              <Field label={t('ship.carrier')}>{s.carrier}</Field>
              <Field label={t('ship.container')}>
                <span className="font-mono text-xs">{s.container}</span>
              </Field>
              <Field label={t('ship.destination')}>{t(`dest.${s.destination}`)}</Field>
              <Field label={t('ship.etd')}>{s.etd}</Field>
              <Field label={t('ship.eta')}>{s.eta}</Field>
              <Field label={t('ship.daysWaiting')}>{s.daysWaitingForConsolidation}</Field>
              {/* Freight cost is NEVER shown to the partner — the API returns "***"; render the
              mask honestly rather than omit the row, so the masking is visible, not silent. */}
              <Field label={t('ship.freight')}>
                {isMasked(s.freightPaidMinor) ? (
                  <Masked />
                ) : (
                  <span>{String(s.freightPaidMinor)}</span>
                )}
              </Field>
            </dl>
            <p className="mt-2 text-[11px] text-slate-400">{t('ship.freightNote')}</p>
          </Card>

          <PackagesSection res={pkgRes} t={t} locale={locale} />
        </div>

        <div className="space-y-4">
          <DeliverySection res={delRes} t={t} />
          <TimelineSection res={tlRes} t={t} />
        </div>
      </div>
    </DetailShell>
  );
}

function PackagesSection({
  res,
  t,
  locale,
}: {
  res: ApiResult<PackageView[]>;
  t: Translate;
  locale: Locale;
}) {
  void locale;
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-slate-700">{t('pkg.title')}</h2>
      {res.kind !== 'ok' ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {t('pkg.unavailable')}
        </p>
      ) : res.data.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{t('pkg.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {res.data.map((p) => (
            <li key={p.ref} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-xs text-slate-500">{p.ref}</p>
                <Badge tone={p.qcReleased ? 'green' : 'amber'}>
                  {p.qcReleased ? t('pkg.released') : t('pkg.held')}
                </Badge>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">
                    {t('pkg.kg')}
                  </p>
                  <p className="font-medium tabular-nums text-slate-900">{p.kg}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">
                    {t('pkg.cbm')}
                  </p>
                  <p className="font-medium tabular-nums text-slate-900">{p.cbm}</p>
                </div>
              </div>
              {p.destination && (
                <p className="mt-1 text-xs text-slate-500">
                  {t('ship.destination')}:{' '}
                  <span className="font-medium text-slate-700">{t(`dest.${p.destination}`)}</span>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DeliverySection({ res, t }: { res: ApiResult<DeliveryView>; t: Translate }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-slate-700">{t('delivery.title')}</h2>
      {res.kind === 'notfound' ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {t('delivery.none')}
        </p>
      ) : res.kind !== 'ok' ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {t('delivery.unavailable')}
        </p>
      ) : (
        <Card>
          <dl className="divide-y divide-slate-100">
            <Field label={t('delivery.status')}>
              <Badge
                tone={
                  res.data.status === 'delivered'
                    ? 'green'
                    : res.data.status === 'failed'
                      ? 'red'
                      : 'blue'
                }
              >
                {t(`delivery.status.${res.data.status}`)}
              </Badge>
            </Field>
            <Field label={t('delivery.pod')}>
              <span className="font-mono text-xs">{res.data.podRef}</span>
            </Field>
            <Field label={t('delivery.packages')}>{res.data.packageRefs.length}</Field>
          </dl>
        </Card>
      )}
    </section>
  );
}

function TimelineSection({ res, t }: { res: ApiResult<TrackingEventView[]>; t: Translate }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-slate-700">{t('timeline.title')}</h2>
      {res.kind !== 'ok' ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {t('timeline.unavailable')}
        </p>
      ) : res.data.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {t('timeline.empty')}
        </p>
      ) : (
        <ol className="space-y-2">
          {res.data.map((e) => (
            <li key={e.ref} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{e.milestone}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(e.occurredAt).toLocaleString()}
                  </p>
                </div>
                <Provenance
                  confirmed={e.confirmed}
                  label={e.confirmed ? t('provenance.confirmed') : t('provenance.estimated')}
                />
              </div>
              {e.note && <p className="mt-1 text-xs text-slate-500">{e.note}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function BackLink({ label }: { label: string }) {
  return (
    <Link href="/partner/shipments" className="inline-flex items-center text-sm text-slate-500">
      ← {label}
    </Link>
  );
}
