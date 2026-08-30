import Link from 'next/link';
import { redirect } from 'next/navigation';
import { translator, type Translate, type Locale } from '@/i18n';
import { getLocale, getSession } from '@/lib/session';
import { homePathFor, isPartner } from '@/lib/permissions';
import { authedCall } from '@/lib/api';
import { shipmentPromise } from '@/lib/promise';
import type { ShipmentView } from '@/lib/types';
import { Badge, CardGrid } from '@/components/ui';
import { StatePanel } from '@/components/States';

export const dynamic = 'force-dynamic';

function statusTone(status: ShipmentView['status']): 'slate' | 'green' | 'amber' | 'blue' | 'red' {
  switch (status) {
    case 'delivered':
      return 'green';
    case 'arrived':
      return 'blue';
    case 'in_transit':
      return 'blue';
    case 'delayed':
      return 'red';
    default:
      return 'slate';
  }
}

export default async function PartnerShipmentsPage() {
  const locale = await getLocale();
  const t = translator(locale);
  const session = await getSession();
  if (!session) redirect('/login');
  // The partner portal is the logistics_partner's area only. A non-partner is scoped to an
  // empty set by the API anyway — redirect it home rather than show a confusing empty list.
  if (!isPartner(session.actor)) redirect(homePathFor(session.actor));

  const res = await authedCall<ShipmentView[]>('/partner-portal/shipments?limit=100');
  if (res.kind === 'unauthorized') redirect('/login');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{t('partner.title')}</h1>
        <p className="text-sm text-slate-500">{t('partner.subtitle')}</p>
      </div>

      {res.kind === 'denied' ? (
        <StatePanel tone="amber" title={t('state.denied.title')} body={t('state.denied.body')} />
      ) : res.kind !== 'ok' ? (
        <StatePanel tone="red" title={t('state.error.title')} body={t('state.error.body')} />
      ) : res.data.length === 0 ? (
        <StatePanel title={t('partner.empty.title')} body={t('partner.empty.body')} />
      ) : (
        <CardGrid>
          {res.data.map((s) => (
            <ShipmentCard key={s.ref} s={s} t={t} locale={locale} />
          ))}
        </CardGrid>
      )}
    </div>
  );
}

function ShipmentCard({ s, t, locale }: { s: ShipmentView; t: Translate; locale: Locale }) {
  void locale;
  const promise = shipmentPromise(s.status);
  return (
    <li className="h-full rounded-xl border border-slate-200 bg-white shadow-sm">
      <Link href={`/partner/shipments/${s.ref}`} className="flex h-full flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-slate-900">
              {t(`dest.${s.destination}`)}
            </p>
            <p className="truncate text-xs text-slate-500">
              {s.carrier} · <span className="font-mono">{s.container}</span>
            </p>
          </div>
          <Badge tone={statusTone(s.status)}>{t(promise.stageKey)}</Badge>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">{t('ship.etd')}</p>
            <p className="font-medium text-slate-800">{s.etd}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">{t('ship.eta')}</p>
            <p className="font-medium text-slate-800">{s.eta}</p>
          </div>
        </div>

        <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">{t('dash.col.next')}</p>
          <p className="text-sm font-medium text-slate-800">{t(promise.nextKey)}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {t('dash.col.owner')}:{' '}
            <span className="font-medium text-slate-700">{t(`owner.${promise.ownerRole}`)}</span>
          </p>
        </div>

        <p className="mt-auto pt-2 font-mono text-[11px] text-slate-400">{s.ref}</p>
      </Link>
    </li>
  );
}
