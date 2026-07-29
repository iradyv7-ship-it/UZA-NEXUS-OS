import Link from 'next/link';
import { redirect } from 'next/navigation';
import { translator, type Translate, type Locale } from '@/i18n';
import { getLocale } from '@/lib/session';
import { authedCall } from '@/lib/api';
import { getWorklist, type WorklistEntry } from '@/lib/worklist';
import { orderPromise, quotationPromise, type Promise as Promised } from '@/lib/promise';
import type { OrderView, QuotationView } from '@/lib/types';
import { Badge } from '@/components/ui';
import { StatePanel } from '@/components/States';
import { seedDealAction, trackRefAction, removeEntryAction } from './actions';

export const dynamic = 'force-dynamic';

interface Row {
  entry: WorklistEntry;
  ok: boolean;
  denied?: boolean;
  promise?: Promised;
  projectName?: string;
  customerRef?: string;
}

function toneForStage(key: string): 'slate' | 'green' | 'amber' | 'blue' | 'red' {
  if (key.endsWith('approved') || key.endsWith('delivered')) return 'green';
  if (key.endsWith('draft') || key.endsWith('awaiting_payment')) return 'amber';
  if (key.endsWith('procurement_active') || key.endsWith('in_transit')) return 'blue';
  if (key.endsWith('cancelled') || key.endsWith('superseded')) return 'slate';
  return 'slate';
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const locale = await getLocale();
  const t = translator(locale);
  const { err } = await searchParams;
  const worklist = await getWorklist();

  const rows: Row[] = [];
  for (const entry of worklist) {
    const path = entry.kind === 'quotation' ? `/quotations/${entry.ref}` : `/orders/${entry.ref}`;
    const res = await authedCall<QuotationView | OrderView>(path);
    if (res.kind === 'unauthorized') redirect('/login');
    if (res.kind === 'ok') {
      const promise =
        entry.kind === 'quotation'
          ? quotationPromise((res.data as QuotationView).status)
          : orderPromise((res.data as OrderView).status);
      rows.push({ entry, ok: true, promise, projectName: entry.projectName, customerRef: (res.data as QuotationView).customerRef });
    } else {
      rows.push({ entry, ok: false, denied: res.kind === 'denied' });
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{t('dash.title')}</h1>
        <p className="text-sm text-slate-500">{t('dash.subtitle')}</p>
      </div>

      {err === 'track' && (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {t('dash.track.invalid')}
        </p>
      )}
      {err === 'seed' && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {t('state.error.body')}
        </p>
      )}

      <Toolbar t={t} />

      {rows.length === 0 ? (
        <StatePanel title={t('dash.empty.title')} body={t('dash.empty.body')} />
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <DealCard key={`${row.entry.kind}:${row.entry.ref}`} row={row} t={t} locale={locale} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Toolbar({ t }: { t: Translate }) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <form action={trackRefAction} className="space-y-2">
        <label htmlFor="ref" className="block text-sm font-medium text-slate-700">
          {t('dash.track.label')}
        </label>
        <div className="flex gap-2">
          <input
            id="ref"
            name="ref"
            placeholder={t('dash.track.placeholder')}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
          <button className="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
            {t('dash.track.submit')}
          </button>
        </div>
      </form>
      <form action={seedDealAction} className="border-t border-slate-100 pt-3">
        <button className="w-full rounded-lg border border-brand/40 bg-brand-soft px-4 py-2 text-sm font-semibold text-brand">
          {t('dash.seed.submit')}
        </button>
        <p className="mt-1 text-center text-[11px] text-slate-400">{t('dash.seed.note')}</p>
      </form>
    </div>
  );
}

function DealCard({ row, t, locale }: { row: Row; t: Translate; locale: Locale }) {
  const { entry, promise } = row;
  const recordLabel = entry.kind === 'quotation' ? t('record.quotation') : t('record.order');
  const path = entry.kind === 'quotation' ? `/quotations/${entry.ref}` : `/orders/${entry.ref}`;

  if (!row.ok) {
    return (
      <li className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">{entry.projectName ?? recordLabel}</p>
            <p className="font-mono text-xs text-slate-400">{entry.ref}</p>
          </div>
          <Badge tone={row.denied ? 'amber' : 'slate'}>
            {row.denied ? t('state.denied.title') : t('dash.row.gone')}
          </Badge>
        </div>
        <RemoveForm entry={entry} label={t('dash.remove')} />
      </li>
    );
  }

  return (
    <li className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <Link href={path} className="block p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-slate-900">
              {entry.projectName ?? recordLabel}
            </p>
            <p className="truncate text-xs text-slate-500">
              {recordLabel}
              {entry.customerName ? ` · ${t('record.for')} ${entry.customerName}` : ''}
            </p>
          </div>
          {promise && <Badge tone={toneForStage(promise.stageKey)}>{t(promise.stageKey)}</Badge>}
        </div>

        {promise && (
          <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">{t('dash.col.next')}</p>
            <p className="text-sm font-medium text-slate-800">{t(promise.nextKey)}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {t('dash.col.owner')}: <span className="font-medium text-slate-700">{t(`owner.${promise.ownerRole}`)}</span>
              {entry.ownerId && promise.ownerRole === 'venture_manager' ? (
                <span className="ml-1 font-mono text-[11px] text-slate-400">{entry.ownerId}</span>
              ) : null}
            </p>
          </div>
        )}

        <p className="mt-2 font-mono text-[11px] text-slate-400">{entry.ref}</p>
      </Link>
      <div className="border-t border-slate-100 px-4 py-2">
        <RemoveForm entry={entry} label={t('dash.remove')} />
      </div>
    </li>
  );
}

function RemoveForm({ entry, label }: { entry: WorklistEntry; label: string }) {
  return (
    <form action={removeEntryAction} className="mt-1">
      <input type="hidden" name="kind" value={entry.kind} />
      <input type="hidden" name="ref" value={entry.ref} />
      <button className="text-xs text-slate-400 underline underline-offset-2">{label}</button>
    </form>
  );
}
