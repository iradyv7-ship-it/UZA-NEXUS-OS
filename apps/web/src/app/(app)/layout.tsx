import Link from 'next/link';
import { redirect } from 'next/navigation';
import { translator } from '@/i18n';
import { getLocale, getSession } from '@/lib/session';
import { can, homePathFor } from '@/lib/permissions';
import { LocaleSwitch } from '@/components/LocaleSwitch';
import { SHELL_PADDING_X, SHELL_WIDTH } from '@/components/ui';
import { logoutAction } from '@/app/actions';
import { authedCall } from '@/lib/api';

/** One class for every secondary nav item, so the bar stays even as links are added. */
const NAV = 'rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const locale = await getLocale();
  const t = translator(locale);
  const roleLabel = t(`role.${session.actor.role}`);
  const showVerifyQueue = can(session.actor, 'payment', 'read');
  const showCommand = session.actor.role === 'ceo' || session.actor.role === 'venture_manager';
  const home = homePathFor(session.actor);

  // The unread count. A message nobody is told about is not a message, and until now the
  // count existed in the API and was only ever seen by someone who already went looking.
  // Failure here must never take the shell down with it — a badge is not worth a blank page.
  const inbox = await authedCall<{ unread: number }>('/planning/memos');
  const unread = inbox.kind === 'ok' ? inbox.data.unread : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Full-bleed sticky bar; its inner content is centred to the shared shell width so
          the header lines up with the page below at every breakpoint. */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className={`mx-auto w-full ${SHELL_WIDTH} ${SHELL_PADDING_X} py-3`}>
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2">
            <Link href={home} className="flex flex-col leading-tight">
              <span className="text-lg font-bold text-brand">{t('app.name')}</span>
              <span className="text-[11px] text-slate-500">{t('app.tagline')}</span>
            </Link>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {showCommand && (
                <Link
                  href="/nexus"
                  className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white"
                >
                  Nexus
                </Link>
              )}
              <Link href="/my-week" className={NAV}>
                My week
              </Link>
              {showCommand && (
                <Link href="/digest" className={NAV}>
                  Monday digest
                </Link>
              )}
              <Link href="/week" className={NAV}>
                Initiatives
              </Link>
              <Link href="/memos" className={`${NAV} relative`}>
                Messages
                {unread > 0 && (
                  <span
                    aria-label={`${unread} unread`}
                    className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white"
                  >
                    {unread}
                  </span>
                )}
              </Link>
              <Link href="/tasks" className={NAV}>
                Tasks
              </Link>
              {showCommand && (
                <Link href="/projects" className={NAV}>
                  Projects
                </Link>
              )}
              {showCommand && (
                <Link href="/funding" className={NAV}>
                  Funding
                </Link>
              )}
              {showCommand && (
                <Link href="/register" className={NAV}>
                  Review
                </Link>
              )}
              {showCommand && (
                <Link href="/command" className={NAV}>
                  Command
                </Link>
              )}
              {showCommand && (
                <Link href="/systems" className={NAV}>
                  Systems
                </Link>
              )}
              {showVerifyQueue && (
                <Link
                  href="/finance/payments"
                  className={NAV}
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
        </div>
      </header>
      <main className={`mx-auto w-full ${SHELL_WIDTH} ${SHELL_PADDING_X} py-4 sm:py-6`}>{children}</main>
    </div>
  );
}
