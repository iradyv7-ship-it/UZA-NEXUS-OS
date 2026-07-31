import { redirect } from 'next/navigation';
import { translator } from '@/i18n';
import { getLocale, getSession } from '@/lib/session';
import { homePathFor } from '@/lib/permissions';
import { isGoogleConfigured } from '@/lib/googleAuth';
import LoginForm from './LoginForm';
import GoogleSignInButton from './GoogleSignInButton';
import { LocaleSwitch } from '@/components/LocaleSwitch';

type GoogleError = 'unauthorized' | 'not_configured' | 'google_failed';

function googleErrorKey(error: string | undefined): string | null {
  switch (error as GoogleError) {
    case 'unauthorized':
      return 'login.error.unauthorized';
    case 'not_configured':
      return 'login.google.unavailable';
    case 'google_failed':
      return 'login.error.google';
    default:
      return null;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (session) redirect(homePathFor(session.actor));

  const [locale, googleConfigured, { error }] = await Promise.all([
    getLocale(),
    isGoogleConfigured(),
    searchParams,
  ]);
  const t = translator(locale);
  const errorKey = googleErrorKey(error);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10 sm:max-w-lg sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand">{t('app.name')}</h1>
          <p className="text-sm text-slate-500">{t('app.tagline')}</p>
        </div>
        <LocaleSwitch locale={locale} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">{t('login.title')}</h2>
        <p className="mb-5 text-sm text-slate-500">{t('login.subtitle')}</p>

        {errorKey && (
          <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {t(errorKey)}
          </p>
        )}

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

        <div className="my-5 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-xs uppercase tracking-wide text-slate-400">{t('login.google.or')}</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <GoogleSignInButton
          configured={googleConfigured}
          label={t('login.google.submit')}
          unavailable={t('login.google.unavailable')}
        />
      </div>

      <p className="mt-4 text-center text-xs text-slate-400">{t('login.hint')}</p>
    </main>
  );
}
