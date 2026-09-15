import Link from 'next/link';
import { redirect } from 'next/navigation';
import { translator, type Translate, type Locale } from '@/i18n';
import { getLocale, getSession } from '@/lib/session';
import { authedCall } from '@/lib/api';
import { money } from '@/lib/format';
import type { PaymentView } from '@/lib/types';
import { Badge, Card, CardGrid } from '@/components/ui';
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
      <Link href="/dashboard" className="inline-flex items-center text-sm text-fgMuted">
        ← {t('action.back')}
      </Link>

      <div>
        <h1 className="text-xl font-bold text-fg">{t('verify.title')}</h1>
        <p className="text-sm text-fgMuted">{t('verify.subtitle')}</p>
      </div>

      {verified && (
        <div
          role="status"
          className="rounded-lg border border-ok/30 bg-ok/10 px-3 py-2.5 text-sm text-ok"
        >
          <p className="font-medium">{t('verify.done')}</p>
          <Link
            href={`/orders/${verified}`}
            className="mt-0.5 inline-block text-xs font-semibold underline"
          >
            {t('verify.doneLink')} → {verified}
          </Link>
        </div>
      )}
      {rejected && (
        <p
          role="status"
          className="rounded-lg border border-border bg-surface2 px-3 py-2 text-sm text-fgMuted"
        >
          {t('verify.rejected')}
        </p>
      )}
      {err === 'denied' && (
        <StatePanel tone="amber" title={t('state.denied.title')} body={t('state.denied.body')} />
      )}
      {err === 'verify' && <ErrLine msg={t('verify.error')} />}
      {err === 'reject' && <ErrLine msg={t('verify.error')} />}
      {err === 'reason' && <ErrLine msg={t('verify.reasonRequired')} />}

      {res.kind === 'denied' ? (
        <StatePanel tone="amber" title={t('state.denied.title')} body={t('verify.deniedBody')} />
      ) : res.kind !== 'ok' ? (
        <StatePanel tone="red" title={t('state.error.title')} body={t('state.error.body')} />
      ) : res.data.length === 0 ? (
        <StatePanel title={t('verify.empty.title')} body={t('verify.empty.body')} />
      ) : (
        <CardGrid>
          {res.data.map((p) => (
            <PaymentCard key={p.ref} p={p} t={t} locale={locale} />
          ))}
        </CardGrid>
      )}
    </div>
  );
}

function PaymentCard({ p, t, locale }: { p: PaymentView; t: Translate; locale: Locale }) {
  return (
    <li className="h-full">
      <Card className="h-full">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-semibold text-fg">{money(p.amountMinor, locale)}</p>
            <p className="text-xs text-fgMuted">{t(`trigger.${p.targetTrigger}`)}</p>
          </div>
          <Badge tone="blue">{t('pay.pending')}</Badge>
        </div>

        <dl className="mt-3 space-y-1 text-xs">
          <Row label={t('record.order')}>
            <Link href={`/orders/${p.orderRef}`} className="font-mono text-primary underline">
              {p.orderRef}
            </Link>
          </Row>
          <Row label={t('pay.invoice')}>
            <span className="font-mono text-fgMuted">{p.invoiceRef}</span>
          </Row>
          <Row label={t('record.customer')}>
            <span className="font-mono text-fgMuted">{p.customerRef}</span>
          </Row>
          <Row label={t('verify.proof')}>
            <span className="font-mono text-fgMuted">{p.proofRef}</span>
          </Row>
        </dl>

        <div className="mt-3 flex gap-2">
          <form action={verifyPaymentAction} className="flex-1">
            <input type="hidden" name="ref" value={p.ref} />
            <input type="hidden" name="orderRef" value={p.orderRef} />
            <button className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-surface active:scale-[0.99]">
              {t('verify.verify')}
            </button>
          </form>
        </div>

        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-fgMuted">
            {t('verify.reject')}
          </summary>
          <form action={rejectPaymentAction} className="mt-2 space-y-2">
            <input type="hidden" name="ref" value={p.ref} />
            <input
              name="reason"
              required
              placeholder={t('verify.reasonPlaceholder')}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-danger focus:ring-2 focus:ring-danger/20"
            />
            <button className="w-full rounded-lg border border-danger/40 bg-danger/10 px-4 py-2 text-sm font-semibold text-danger">
              {t('verify.rejectConfirm')}
            </button>
          </form>
        </details>

        <p className="mt-2 font-mono text-[11px] text-fgSubtle">{p.ref}</p>
      </Card>
    </li>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-fgSubtle">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

function ErrLine({ msg }: { msg: string }) {
  return (
    <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
      {msg}
    </p>
  );
}
