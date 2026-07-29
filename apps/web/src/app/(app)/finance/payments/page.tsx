import Link from 'next/link';
import { redirect } from 'next/navigation';
import { translator, type Translate, type Locale } from '@/i18n';
import { getLocale, getSession } from '@/lib/session';
import { authedCall } from '@/lib/api';
import { money } from '@/lib/format';
import type { PaymentView } from '@/lib/types';
import { Badge, Card } from '@/components/ui';
import { StatePanel } from '@/components/States';
import { verifyPaymentAction, rejectPaymentAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function VerifyQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string; rejected?: string; err?: string }>;
}) {
  const { verified, rejected, err } = await searchParams;
  const locale = await getLocale();
  const t = translator(locale);
  const session = await getSession();
  if (!session) redirect('/login');

  const res = await authedCall<PaymentView[]>('/payments?status=pending_verification&limit=100');
  if (res.kind === 'unauthorized') redirect('/login');

  return (
    <div className="space-y-4">
      <Link href="/dashboard" className="inline-flex items-center text-sm text-slate-500">
        ← {t('action.back')}
      </Link>

      <div>
        <h1 className="text-xl font-bold text-slate-900">{t('verify.title')}</h1>
        <p className="text-sm text-slate-500">{t('verify.subtitle')}</p>
      </div>

      {verified && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
          <p className="font-medium">{t('verify.done')}</p>
          <Link href={`/orders/${verified}`} className="mt-0.5 inline-block text-xs font-semibold underline">
            {t('verify.doneLink')} → {verified}
          </Link>
        </div>
      )}
      {rejected && (
        <p role="status" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {t('verify.rejected')}
        </p>
      )}
      {err === 'denied' && <StatePanel tone="amber" title={t('state.denied.title')} body={t('state.denied.body')} />}
      {err === 'verify' && <ErrLine t={t} msg={t('verify.error')} />}
      {err === 'reject' && <ErrLine t={t} msg={t('verify.error')} />}
      {err === 'reason' && <ErrLine t={t} msg={t('verify.reasonRequired')} />}

      {res.kind === 'denied' ? (
        <StatePanel tone="amber" title={t('state.denied.title')} body={t('verify.deniedBody')} />
      ) : res.kind !== 'ok' ? (
        <StatePanel tone="red" title={t('state.error.title')} body={t('state.error.body')} />
      ) : res.data.length === 0 ? (
        <StatePanel title={t('verify.empty.title')} body={t('verify.empty.body')} />
      ) : (
        <ul className="space-y-3">
          {res.data.map((p) => (
            <PaymentCard key={p.ref} p={p} t={t} locale={locale} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PaymentCard({ p, t, locale }: { p: PaymentView; t: Translate; locale: Locale }) {
  return (
    <li>
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-semibold text-slate-900">{money(p.amountMinor, locale)}</p>
            <p className="text-xs text-slate-500">{t(`trigger.${p.targetTrigger}`)}</p>
          </div>
          <Badge tone="blue">{t('pay.pending')}</Badge>
        </div>

        <dl className="mt-3 space-y-1 text-xs">
          <Row label={t('record.order')}>
            <Link href={`/orders/${p.orderRef}`} className="font-mono text-brand underline">
              {p.orderRef}
            </Link>
          </Row>
          <Row label={t('pay.invoice')}>
            <span className="font-mono text-slate-600">{p.invoiceRef}</span>
          </Row>
          <Row label={t('record.customer')}>
            <span className="font-mono text-slate-600">{p.customerRef}</span>
          </Row>
          <Row label={t('verify.proof')}>
            <span className="font-mono text-slate-600">{p.proofRef}</span>
          </Row>
        </dl>

        <div className="mt-3 flex gap-2">
          <form action={verifyPaymentAction} className="flex-1">
            <input type="hidden" name="ref" value={p.ref} />
            <input type="hidden" name="orderRef" value={p.orderRef} />
            <button className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white active:scale-[0.99]">
              {t('verify.verify')}
            </button>
          </form>
        </div>

        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-slate-500">{t('verify.reject')}</summary>
          <form action={rejectPaymentAction} className="mt-2 space-y-2">
            <input type="hidden" name="ref" value={p.ref} />
            <input
              name="reason"
              required
              placeholder={t('verify.reasonPlaceholder')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-200"
            />
            <button className="w-full rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">
              {t('verify.rejectConfirm')}
            </button>
          </form>
        </details>

        <p className="mt-2 font-mono text-[11px] text-slate-400">{p.ref}</p>
      </Card>
    </li>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

function ErrLine({ t, msg }: { t: Translate; msg: string }) {
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {msg}
    </p>
  );
}
