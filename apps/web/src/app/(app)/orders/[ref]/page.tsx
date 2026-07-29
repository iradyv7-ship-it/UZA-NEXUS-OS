import Link from 'next/link';
import { redirect } from 'next/navigation';
import { translator } from '@/i18n';
import { getLocale } from '@/lib/session';
import { authedCall } from '@/lib/api';
import { money, percent } from '@/lib/format';
import { orderPromise } from '@/lib/promise';
import type { OrderView } from '@/lib/types';
import { Badge, Card, Field } from '@/components/ui';
import { ResultError } from '@/components/States';

export const dynamic = 'force-dynamic';

export default async function OrderPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const locale = await getLocale();
  const t = translator(locale);

  const res = await authedCall<OrderView>(`/orders/${ref}`);
  if (res.kind === 'unauthorized') redirect('/login');

  if (res.kind !== 'ok') {
    return (
      <div className="space-y-4">
        <BackLink label={t('action.back')} />
        <ResultError result={res} t={t} />
      </div>
    );
  }

  const o = res.data;
  const promise = orderPromise(o.status);
  const statusTone =
    o.status === 'delivered' ? 'green' : o.status === 'awaiting_payment' ? 'amber' : o.status === 'cancelled' ? 'slate' : 'blue';

  return (
    <div className="space-y-4">
      <BackLink label={t('action.back')} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t('ord.title')}</h1>
          <p className="font-mono text-xs text-slate-400">{o.ref}</p>
        </div>
        <Badge tone={statusTone}>{t(promise.stageKey)}</Badge>
      </div>

      <div className="rounded-xl border border-brand/30 bg-brand-soft/50 p-4">
        <p className="text-[11px] uppercase tracking-wide text-brand/70">{t('dash.col.next')}</p>
        <p className="text-base font-semibold text-slate-900">{t(promise.nextKey)}</p>
        <p className="mt-0.5 text-sm text-slate-600">
          {t('dash.col.owner')}: <span className="font-medium">{t(`owner.${promise.ownerRole}`)}</span>
        </p>
      </div>

      <Card>
        <dl className="divide-y divide-slate-100">
          <Field label={t('ord.total')}>{money(o.totalMinor, locale)}</Field>
          <Field label={t('ord.tier')}>{o.tier === 'established' ? t('ord.tier.established') : t('ord.tier.new')}</Field>
          <Field label={t('record.project')}>
            <span className="font-mono text-xs">{o.projectRef}</span>
          </Field>
          <Field label={t('record.customer')}>
            <span className="font-mono text-xs">{o.customerRef}</span>
          </Field>
        </dl>
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">{t('ord.schedule')}</h2>
        <ul className="space-y-2">
          {o.installments.map((inst) => (
            <li key={inst.ref} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">{t(`trigger.${inst.trigger}`)}</p>
                  <p className="text-xs text-slate-500">{percent(inst.pct, locale)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums text-slate-900">{money(inst.amountMinor, locale)}</p>
                  <Badge tone={inst.status === 'paid' ? 'green' : 'amber'}>
                    {inst.status === 'paid' ? t('install.paid') : t('install.due')}
                  </Badge>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <Link
        href={`/quotations/${o.quotationRef}`}
        className="block rounded-lg border border-slate-300 px-4 py-3 text-center text-sm font-medium text-slate-700"
      >
        {t('ord.viewQuotation')}
      </Link>
    </div>
  );
}

function BackLink({ label }: { label: string }) {
  return (
    <Link href="/dashboard" className="inline-flex items-center text-sm text-slate-500">
      ← {label}
    </Link>
  );
}
