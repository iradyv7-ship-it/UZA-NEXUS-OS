import { redirect } from 'next/navigation';
import { translator } from '@/i18n';
import { getLocale, getSession } from '@/lib/session';
import { homePathFor } from '@/lib/permissions';
import LoginForm from './LoginForm';
import { LocaleSwitch } from '@/components/LocaleSwitch';

/**
 * Email + password only. Every seat is provisioned by `prisma/seed-users.ts` (one address
 * per person, a shared temporary password everyone changes on first sign-in) — there is no
 * self-service sign-up and no third-party identity provider, so this page renders without
 * touching the API at all.
 */
export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(homePathFor(session.actor));

  const locale = await getLocale();
  const t = translator(locale);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10 sm:max-w-lg sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">{t('app.name')}</h1>
          <p className="text-sm text-fgMuted">{t('app.tagline')}</p>
        </div>
        <LocaleSwitch locale={locale} />
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-fg">{t('login.title')}</h2>
        <p className="mb-5 text-sm text-fgMuted">{t('login.subtitle')}</p>

        <LoginForm
          labels={{
            email: t('login.email'),
            password: t('login.password'),
            submit: t('login.submit'),
            submitting: t('login.submitting'),
            invalid: t('login.error.invalid'),
            network: t('login.error.network'),
          }}
        />
      </div>

      <p className="mt-4 text-center text-xs text-fgSubtle">{t('login.hint')}</p>
    </main>
  );
}
