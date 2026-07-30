import { redirect } from 'next/navigation';
import { translator } from '@/i18n';
import { getLocale, getSession } from '@/lib/session';
import { homePathFor } from '@/lib/permissions';
import LoginForm from './LoginForm';
import { LocaleSwitch } from '@/components/LocaleSwitch';

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(homePathFor(session.actor));

  const locale = await getLocale();
  const t = translator(locale);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
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

      <p className="mt-4 text-center text-xs text-slate-400">{t('login.hint')}</p>
    </main>
  );
}
