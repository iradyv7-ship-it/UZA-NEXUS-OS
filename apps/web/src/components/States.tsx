import type { Translate } from '@/i18n';
import type { ApiResult } from '@/lib/api';

/** The four (plus not-found) required states, rendered consistently across every screen. */

export function StatePanel({
  title,
  body,
  tone = 'slate',
}: {
  title: string;
  body: string;
  tone?: 'slate' | 'red' | 'amber';
}) {
  const ring =
    tone === 'red' ? 'border-red-200 bg-red-50' : tone === 'amber' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white';
  return (
    <div className={`rounded-xl border p-6 text-center ${ring}`}>
      <p className="text-base font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-600">{body}</p>
    </div>
  );
}

export function LoadingPanel({ t }: { t: Translate }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-200/70" />
      ))}
      <p className="text-center text-sm text-slate-400">{t('state.loading')}</p>
    </div>
  );
}

/**
 * Render a non-ok ApiResult into the right panel. `unauthorized` is handled by the caller
 * (redirect to login) — this covers denied / not-found / error.
 */
export function ResultError({ result, t }: { result: Exclude<ApiResult<unknown>, { kind: 'ok' }>; t: Translate }) {
  if (result.kind === 'denied') {
    return <StatePanel tone="amber" title={t('state.denied.title')} body={t('state.denied.body')} />;
  }
  if (result.kind === 'notfound') {
    return <StatePanel title={t('state.notfound.title')} body={t('state.notfound.body')} />;
  }
  return <StatePanel tone="red" title={t('state.error.title')} body={t('state.error.body')} />;
}
