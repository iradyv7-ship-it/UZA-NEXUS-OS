import { redirect } from 'next/navigation';
import { translator } from '@/i18n';
import { getLocale, getSession } from '@/lib/session';
import { homePathFor, isPending } from '@/lib/permissions';
import { Card } from '@/components/ui';

export const dynamic = 'force-dynamic';

/**
 * The waiting room. A first-time Google sign-in lands here with a `pending` role and no
 * grants (see AuthService.loginWithGoogle on the API): the account exists, the CEO can see
 * it in /admin/access, and nothing else is reachable until a role is assigned. Anyone who
 * already holds a role has no business here — send them home.
 */
export default async function PendingPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!isPending(session.actor)) redirect(homePathFor(session.actor));

  const t = translator(await getLocale());

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="text-xl font-bold text-fg">{t('pending.title')}</h1>
        <p className="mt-2 text-sm text-fgMuted">{t('pending.body')}</p>
        <p className="mt-4 text-xs text-fgSubtle">
          {t('pending.ref')}: <span className="font-mono text-fg">{session.actor.userId}</span>
        </p>
      </Card>
    </div>
  );
}
