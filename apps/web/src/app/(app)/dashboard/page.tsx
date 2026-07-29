import Link from 'next/link';
import { redirect } from 'next/navigation';
import { translator, type Translate, type Locale } from '@/i18n';
import { getLocale } from '@/lib/session';
import { loadQueue, PAGE_SIZE, type QueueCard } from '@/lib/queue';
import { money } from '@/lib/format';
import { Badge } from '@/components/ui';
import { StatePanel } from '@/components/States';
import { seedDealAction, trackRefAction } from './actions';

export const dynamic = 'force-dynamic';

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
  searchParams: Promise<{ err?: string; count?: string }>;
}) {
  const locale = await getLocale();
  const t = translator(locale);
  const { err, count: countParam } = await searchParams;
  const requested = Number.parseInt(countParam ?? '', 10);

  const result = await loadQueue(Number.isFinite(requested) ? requested : PAGE_SIZE);
  if (result.kind === 'unauthorized') redirect('/login');

  const { quotations, orders, quotationsState, ordersState, hasMore, count } = result;
  const total = quotations.length + orders.length;
  const bothDenied = quotationsState === 'denied' && ordersState === 'denied';
  const bothFailed =
    quotationsState !== 'ok' && ordersState !== 'ok' && !(quotationsState === 'denied' && ordersState === 'denied');

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

      {bothDenied ? (
        <StatePanel tone="amber" title={t('state.denied.title')} body={t('state.denied.body')} />
      ) : bothFailed ? (
        <StatePanel tone="red" title={t('state.error.title')} body={t('state.error.body')} />
      ) : total === 0 ? (
        <StatePanel title={t('dash.empty.title')} body={t('dash.empty.body')} />
      ) : (
        <div className="space-y-5">
          <QueueSection
            title={t('record.quotation')}
            cards={quotations}
            state={quotationsState}
            t={t}
            locale={locale}
          />
          <QueueSection title={t('record.order')} cards={orders} state={ordersState} t={t} locale={locale} />

          {hasMore && (
            <Link
              href={`/dashboard?count=${count + PAGE_SIZE}`}
              className="block rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-700"
            >
              {t('dash.loadMore')}
            </Link>
          )}
        </div>
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

function QueueSection({
  title,
  cards,
  state,
  t,
  locale,
}: {
  title: string;
  cards: QueueCard[];
  state: 'ok' | 'denied' | 'error';
  t: Translate;
  locale: Locale;
}) {
  // Nothing to say for an empty-but-ok section — the other section (or empty state) covers it.
  if (state === 'ok' && cards.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
        {state === 'ok' && (
          <span className="text-xs font-medium text-slate-400">{cards.length}</span>
        )}
      </div>

      {state === 'denied' ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{t('dash.section.denied')}</p>
      ) : state === 'error' ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{t('dash.section.error')}</p>
      ) : (
        <ul className="space-y-3">
          {cards.map((card) => (
            <DealCard key={`${card.kind}:${card.ref}`} card={card} t={t} locale={locale} />
          ))}
        </ul>
      )}
    </section>
  );
}

function DealCard({ card, t, locale }: { card: QueueCard; t: Translate; locale: Locale }) {
  const recordLabel = card.kind === 'quotation' ? t('record.quotation') : t('record.order');
  const path = card.kind === 'quotation' ? `/quotations/${card.ref}` : `/orders/${card.ref}`;
  const { promise } = card;
  const amount = money(card.amount.minor, locale);

  return (
    <li className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <Link href={path} className="block p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-slate-900">
              {card.projectName ?? recordLabel}
            </p>
            <p className="truncate text-xs text-slate-500">
              {recordLabel} · {t('record.for')} <span className="font-mono">{card.customerRef}</span>
            </p>
          </div>
          <Badge tone={toneForStage(promise.stageKey)}>{t(promise.stageKey)}</Badge>
        </div>

        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">{t('dash.col.next')}</p>
          <p className="text-sm font-medium text-slate-800">{t(promise.nextKey)}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {t('dash.col.owner')}:{' '}
            <span className="font-medium text-slate-700">{t(`owner.${promise.ownerRole}`)}</span>
            {card.ownerId ? <span className="ml-1 font-mono text-[11px] text-slate-400">{card.ownerId}</span> : null}
          </p>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <p className="font-mono text-[11px] text-slate-400">{card.ref}</p>
          <p className="text-xs tabular-nums text-slate-600">
            <span className="font-medium text-slate-800">{amount}</span>
            {card.amount.per === 'unit' ? <span className="text-slate-400"> {t('dash.perUnit')}</span> : null}
          </p>
        </div>
      </Link>
    </li>
  );
}
