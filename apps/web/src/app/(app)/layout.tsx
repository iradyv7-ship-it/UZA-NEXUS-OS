import Link from 'next/link';
import { redirect } from 'next/navigation';
import { translator } from '@/i18n';
import { getLocale, getSession } from '@/lib/session';
import { can, homePathFor } from '@/lib/permissions';
import { LocaleSwitch } from '@/components/LocaleSwitch';
import { logoutAction } from '@/app/actions';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const locale = await getLocale();
  const t = translator(locale);
  const roleLabel = t(`role.${session.actor.role}`);
  const showVerifyQueue = can(session.actor, 'payment', 'read');
  const home = homePathFor(session.actor);

  return (
    <div className="mx-auto min-h-screen max-w-md bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <Link href={home} className="flex flex-col leading-tight">
            <span className="text-lg font-bold text-brand">{t('app.name')}</span>
            <span className="text-[11px] text-slate-500">{t('app.tagline')}</span>
          </Link>
          <div className="flex items-center gap-2">
            {showVerifyQueue && (
              <Link
                href="/finance/payments"
                className="rounded-lg border border-brand/40 bg-brand-soft px-3 py-2 text-sm font-semibold text-brand"
              >
                {t('nav.verifyQueue')}
              </Link>
            )}
            <LocaleSwitch locale={locale} />
            <form action={logoutAction}>
              <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600">
                {t('nav.logout')}
              </button>
            </form>
          </div>
        </div>
        <p className="mt-1.5 text-xs text-slate-500">
          {t('nav.signedInAs')} <span className="font-medium text-slate-700">{session.actor.userId}</span>
          {' · '}
          <span className="text-slate-500">{roleLabel}</span>
          {' · '}
          <span className="text-slate-400">{session.actor.office}</span>
        </p>
      </header>
      <main className="px-4 py-4">{children}</main>
    </div>
  );
}
