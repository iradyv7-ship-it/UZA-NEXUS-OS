import Link from 'next/link';
import { redirect } from 'next/navigation';
import { translator } from '@/i18n';
import { getLocale } from '@/lib/session';
import { authedCall } from '@/lib/api';
import { maskedMoney, maskedPercent, money } from '@/lib/format';
import { quotationPromise } from '@/lib/promise';
import { isMasked, type QuotationView } from '@/lib/types';
import { Badge, Card, DetailShell, Field, Masked } from '@/components/ui';
import { ResultError } from '@/components/States';
import { approveQuotationAction, createOrderAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function QuotationPage({
  params,
  searchParams,
}: {
  params: Promise<{ ref: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  const { ref } = await params;
  const { err } = await searchParams;
  const locale = await getLocale();
  const t = translator(locale);

  const res = await authedCall<QuotationView>(`/quotations/${ref}`);
  if (res.kind === 'unauthorized') redirect('/login');

  if (res.kind !== 'ok') {
    return (
      <DetailShell>
        <BackLink label={t('action.back')} />
        <ResultError result={res} t={t} />
      </DetailShell>
    );
  }

  const q = res.data;
  const promise = quotationPromise(q.status);
  const anyMasked = isMasked(q.marginPct);

  return (
    <DetailShell>
      <BackLink label={t('action.back')} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-fg">{t('quo.title')}</h1>
          <p className="font-mono text-xs text-fgSubtle">{q.ref}</p>
        </div>
        <Badge tone={q.status === 'approved' ? 'green' : q.status === 'draft' ? 'amber' : 'slate'}>
          {t(promise.stageKey)}
        </Badge>
      </div>

      {/* The product promise, up top. */}
      <div className="rounded-xl border border-primary/30 bg-primarySoft/20 p-4">
        <p className="text-[11px] uppercase tracking-wide text-primary/70">{t('dash.col.next')}</p>
        <p className="text-base font-semibold text-fg">{t(promise.nextKey)}</p>
        <p className="mt-0.5 text-sm text-fgMuted">
          {t('dash.col.owner')}:{' '}
          <span className="font-medium">{t(`owner.${promise.ownerRole}`)}</span>
        </p>
      </div>

      {err === 'approve' && <ErrBanner t={t} />}
      {err === 'order' && <ErrBanner t={t} />}

      {/* On wider screens the two cards sit side by side; they stack on a phone. */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Card>
          <dl className="divide-y divide-border">
            <Field label={t('record.project')}>
              <span className="font-mono text-xs">{q.projectRef}</span>
            </Field>
            <Field label={t('record.customer')}>
              <span className="font-mono text-xs">{q.customerRef}</span>
            </Field>
            <Field label={t('quo.qty')}>{q.qty}</Field>
            <Field label={t('quo.incoterm')}>{q.sellIncoterm}</Field>
            <Field label={t('quo.version')}>v{q.version}</Field>
            <Field label={t('quo.unitPrice')}>{money(q.customerUnitPriceMinor, locale)}</Field>
          </dl>
        </Card>

        {/* Confidential block: supplier cost / target / walkaway + BOTH margins. */}
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-fgMuted">Margins &amp; cost</h2>
          <dl className="divide-y divide-border">
            <Field label={t('quo.supplierCost')}>
              {isMasked(q.supplierUnitCost) ? <Masked /> : maskedMoney(q.supplierUnitCost, locale)}
            </Field>
            <Field label={t('quo.targetPrice')}>
              {isMasked(q.targetPrice) ? <Masked /> : maskedMoney(q.targetPrice, locale)}
            </Field>
            <Field label={t('quo.walkaway')}>
              {isMasked(q.walkawayPrice) ? <Masked /> : maskedMoney(q.walkawayPrice, locale)}
            </Field>
            <Field
              label={`${t('quo.marginQuoted')} (${t('quo.marginQuoted.at', { incoterm: q.sellIncoterm })})`}
            >
              {isMasked(q.marginPct) ? <Masked /> : maskedPercent(q.marginPct, locale)}
            </Field>
            <Field label={t('quo.marginDap')}>
              {isMasked(q.dapMargin) ? <Masked /> : maskedPercent(q.dapMargin, locale)}
            </Field>
            <Field label={t('quo.marginRealized')}>
              {isMasked(q.realizedMargin) ? <Masked /> : maskedPercent(q.realizedMargin, locale)}
            </Field>
          </dl>
          <p className="mt-2 text-xs text-fgSubtle">
            {anyMasked ? t('quo.masked.note') : t('quo.marginHint')}
          </p>
        </Card>
      </div>

      {/* End-to-end flow controls, gated by lifecycle. Full-width on a phone; a comfortable
          fixed width on larger screens rather than a button stretched across the page. */}
      {q.status === 'draft' && (
        <form action={approveQuotationAction}>
          <input type="hidden" name="ref" value={q.ref} />
          <button className="w-full rounded-lg bg-primary px-4 py-3 text-base font-semibold text-surface active:scale-[0.99] sm:w-auto sm:min-w-64 sm:px-10">
            {t('quo.approve')}
          </button>
        </form>
      )}
      {q.status === 'approved' && (
        <form action={createOrderAction}>
          <input type="hidden" name="ref" value={q.ref} />
          <button className="w-full rounded-lg bg-primary px-4 py-3 text-base font-semibold text-surface active:scale-[0.99] sm:w-auto sm:min-w-64 sm:px-10">
            {t('quo.createOrder')}
          </button>
        </form>
      )}
    </DetailShell>
  );
}

function BackLink({ label }: { label: string }) {
  return (
    <Link href="/dashboard" className="inline-flex items-center text-sm text-fgMuted">
      ← {label}
    </Link>
  );
}

function ErrBanner({ t }: { t: ReturnType<typeof translator> }) {
  return (
    <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
      {t('state.error.body')}
    </p>
  );
}
