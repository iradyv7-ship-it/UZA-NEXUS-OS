import { redirect } from 'next/navigation';
import { translator, type Translate } from '@/i18n';
import { getLocale, getSession, type Role } from '@/lib/session';
import { authedCall } from '@/lib/api';
import { canApproveAccess, homePathFor } from '@/lib/permissions';
import { Card, CardGrid } from '@/components/ui';
import { StatePanel } from '@/components/States';
import { approveAccessAction, denyAccessAction } from './actions';

export const dynamic = 'force-dynamic';

interface PendingUser {
  id: string;
  ref: string;
  email: string;
  officeId: string;
  createdAt: string;
}

/** Everything a sign-up can be approved INTO. `pending` itself is not a target. */
const ASSIGNABLE: readonly Exclude<Role, 'pending'>[] = [
  'front_office',
  'sales_agent',
  'finance',
  'china_sourcing',
  'china_warehouse',
  'venture_manager',
  'logistics_partner',
  'ceo',
];

const BTN = 'rounded-lg px-3 py-2 text-sm font-semibold';

/**
 * The CEO's approval queue for Google self-sign-ups. Mirrors the finance verify queue: the
 * API is the guard (a non-CEO gets 403 → the denied panel), this page only offers the
 * actions. Each card is one person: who, when, pick a role, approve — or deny.
 */
export default async function AccessRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ approved?: string; role?: string; denied?: string; err?: string }>;
}) {
  const { approved, role, denied, err } = await searchParams;
  const locale = await getLocale();
  const t = translator(locale);
  const session = await getSession();
  if (!session) redirect('/login');
  if (!canApproveAccess(session.actor)) redirect(homePathFor(session.actor));

  const res = await authedCall<PendingUser[]>('/identity/users/pending');
  if (res.kind === 'unauthorized') redirect('/login');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-fg">{t('access.title')}</h1>
        <p className="text-sm text-fgMuted">{t('access.subtitle')}</p>
      </div>

      {approved && (
        <p
          role="status"
          className="rounded-lg border border-ok/30 bg-ok/10 px-3 py-2.5 text-sm text-ok"
        >
          {t('access.approved', { ref: approved, role: t(`role.${role ?? ''}`) })}
        </p>
      )}
      {denied && (
        <p
          role="status"
          className="rounded-lg border border-border bg-surface2 px-3 py-2 text-sm text-fgMuted"
        >
          {t('access.denied', { ref: denied })}
        </p>
      )}
      {err && (
        <p
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {t('access.error')}
        </p>
      )}

      {res.kind === 'denied' ? (
        <StatePanel tone="amber" title={t('state.denied.title')} body={t('state.denied.body')} />
      ) : res.kind !== 'ok' ? (
        <StatePanel tone="red" title={t('state.error.title')} body={t('state.error.body')} />
      ) : res.data.length === 0 ? (
        <StatePanel title={t('access.empty.title')} body={t('access.empty.body')} />
      ) : (
        <CardGrid>
          {res.data.map((u) => (
            <RequestCard key={u.id} u={u} t={t} locale={locale} />
          ))}
        </CardGrid>
      )}
    </div>
  );
}

function RequestCard({ u, t, locale }: { u: PendingUser; t: Translate; locale: string }) {
  const requested = new Date(u.createdAt).toLocaleString(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return (
    <Card>
      <p className="break-all text-base font-semibold text-fg">{u.email}</p>
      <p className="mt-0.5 text-xs text-fgSubtle">
        <span className="font-mono">{u.ref}</span> · {t('access.requested')} {requested}
      </p>

      <form action={approveAccessAction} className="mt-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={u.id} />
        <input type="hidden" name="ref" value={u.ref} />
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs text-fgMuted">
          {t('access.role')}
          <select
            name="role"
            required
            defaultValue="front_office"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg"
          >
            {ASSIGNABLE.map((r) => (
              <option key={r} value={r}>
                {t(`role.${r}`)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={`${BTN} bg-primary text-surface`}>
          {t('access.approve')}
        </button>
      </form>

      <form action={denyAccessAction} className="mt-2">
        <input type="hidden" name="id" value={u.id} />
        <input type="hidden" name="ref" value={u.ref} />
        <button
          type="submit"
          className={`${BTN} border border-border text-fgMuted hover:bg-surface2`}
        >
          {t('access.deny')}
        </button>
      </form>
    </Card>
  );
}
