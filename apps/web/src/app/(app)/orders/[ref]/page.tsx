import Link from 'next/link';
import { redirect } from 'next/navigation';
import { translator, type Translate, type Locale } from '@/i18n';
import { getLocale, getSession } from '@/lib/session';
import { authedCall } from '@/lib/api';
import { can } from '@/lib/permissions';
import { money, percent } from '@/lib/format';
import { orderPromise } from '@/lib/promise';
import type { InvoiceInstallmentView, InvoiceView, OrderView, PaymentView } from '@/lib/types';
import { Badge, Card, DetailShell, Field } from '@/components/ui';
import { ResultError } from '@/components/States';
import { uploadPaymentProofAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ ref: string }>;
  searchParams: Promise<{ paid?: string; err?: string }>;
}) {
  const { ref } = await params;
  const { paid, err } = await searchParams;
  const locale = await getLocale();
  const t = translator(locale);
  const session = await getSession();
  if (!session) redirect('/login');

  const res = await authedCall<OrderView>(`/orders/${ref}`);
  if (res.kind === 'unauthorized') redirect('/login');

  if (res.kind !== 'ok') {
    return (
      <DetailShell>
        <BackLink label={t('action.back')} />
        <ResultError result={res} t={t} />
      </DetailShell>
    );
  }

  const o = res.data;

  // Resolve the invoice for this order (the payment UI holds the order ref, not the invoice
  // ref). This carries the settlement status Finance updates. Fetched in parallel with any
  // pending payments — but only a payment:read role (finance/ceo/vm) may list payments, so
  // a customer skips that call rather than eat a 403.
  const canPay = can(session.actor, 'payment', 'create');
  const canReadPayments = can(session.actor, 'payment', 'read');
  const [invRes, payRes] = await Promise.all([
    authedCall<InvoiceView>(`/invoices/order/${ref}`),
    canReadPayments
      ? authedCall<PaymentView[]>(`/payments?status=pending_verification&limit=100`)
      : Promise.resolve(null),
  ]);
  if (invRes.kind === 'unauthorized') redirect('/login');

  const invoice = invRes.kind === 'ok' ? invRes.data : null;
  // Pending payments for THIS order (the list is scoped + filtered client-side to the order).
  const pendingForOrder =
    payRes && payRes.kind === 'ok' ? payRes.data.filter((p) => p.orderRef === ref) : [];

  const promise = orderPromise(o.status);
  const statusTone =
    o.status === 'delivered' ? 'green' : o.status === 'awaiting_payment' ? 'amber' : o.status === 'cancelled' ? 'slate' : 'blue';

  // Installments: prefer the invoice (carries settlement status); fall back to the order's
  // own copy read-only when the invoice is not yet available (event lag) or out of scope.
  const installments = invoice?.installments ?? null;

  return (
    <DetailShell>
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

      {paid && <SuccessBanner t={t} trigger={paid} />}
      {err === 'pay' && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {t('pay.error')}
        </p>
      )}

      {/* Summary and payment schedule sit side by side on large screens, stacked on a phone. */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
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
          {invoice && (
            <Field label={t('pay.invoice')}>
              <span className="font-mono text-xs">{invoice.ref}</span>
            </Field>
          )}
        </dl>
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">{t('ord.schedule')}</h2>

        {installments ? (
          <ul className="space-y-2">
            {installments.map((inst) => (
              <InstallmentRow
                key={inst.ref}
                inst={inst}
                orderRef={o.ref}
                invoiceRef={invoice!.ref}
                canPay={canPay && o.status === 'awaiting_payment'}
                pending={pendingForOrder.some((p) => p.targetTrigger === inst.trigger)}
                t={t}
                locale={locale}
              />
            ))}
          </ul>
        ) : invRes.kind === 'notfound' ? (
          // The invoice is created by consuming order.created — a brief lag right after the
          // order is placed. Say so honestly rather than showing an empty schedule.
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
            {t('pay.invoiceNotReady')}
          </p>
        ) : (
          // Denied / error: fall back to the order's own read-only schedule.
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
        )}
      </div>
      </div>

      <Link
        href={`/quotations/${o.quotationRef}`}
        className="block rounded-lg border border-slate-300 px-4 py-3 text-center text-sm font-medium text-slate-700 sm:inline-block sm:w-auto sm:px-8"
      >
        {t('ord.viewQuotation')}
      </Link>
    </DetailShell>
  );
}

function InstallmentRow({
  inst,
  orderRef,
  invoiceRef,
  canPay,
  pending,
  t,
  locale,
}: {
  inst: InvoiceInstallmentView;
  orderRef: string;
  invoiceRef: string;
  canPay: boolean;
  pending: boolean;
  t: Translate;
  locale: Locale;
}) {
  const settled = inst.status === 'settled';
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-900">{t(`trigger.${inst.trigger}`)}</p>
          <p className="text-xs text-slate-500">{percent(inst.pct, locale)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums text-slate-900">{money(inst.amountMinor, locale)}</p>
          <Badge tone={settled ? 'green' : pending ? 'blue' : 'amber'}>
            {settled ? t('install.paid') : pending ? t('pay.pending') : t('install.due')}
          </Badge>
        </div>
      </div>

      {!settled && pending && (
        <p className="mt-2 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">{t('pay.pendingNote')}</p>
      )}

      {!settled && !pending && canPay && (
        <form action={uploadPaymentProofAction} className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          <input type="hidden" name="orderRef" value={orderRef} />
          <input type="hidden" name="invoiceRef" value={invoiceRef} />
          <input type="hidden" name="targetTrigger" value={inst.trigger} />
          <input type="hidden" name="amountMinor" value={inst.amountMinor} />
          <label htmlFor={`proof-${inst.ref}`} className="block text-xs font-medium text-slate-600">
            {t('pay.proofLabel')}
          </label>
          <input
            id={`proof-${inst.ref}`}
            name="proofRef"
            required
            placeholder={t('pay.proofPlaceholder')}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
          <button className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white active:scale-[0.99]">
            {t('pay.upload')} · {money(inst.amountMinor, locale)}
          </button>
          <p className="text-[11px] text-slate-400">{t('pay.proofHint')}</p>
        </form>
      )}
    </li>
  );
}

function SuccessBanner({ t, trigger }: { t: Translate; trigger: string }) {
  return (
    <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
      <p className="font-medium">{t('pay.submitted')}</p>
      <p className="mt-0.5 text-xs">
        {t('pay.submittedNote', { trigger: t(`trigger.${trigger}`) })}
      </p>
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
