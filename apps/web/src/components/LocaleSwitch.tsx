'use client';

import { useRef } from 'react';
import { LOCALES, LOCALE_LABELS, type Locale } from '@/i18n';
import { setLocaleAction } from '@/app/actions';

/** Language selector — EN/FR live, RW/ZH key-ready. Submits on change and refreshes so
 *  server-rendered labels re-localize. Commercial data is untouched; only labels change. */
export function LocaleSwitch({ locale }: { locale: Locale }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={setLocaleAction}>
      <select
        name="locale"
        defaultValue={locale}
        aria-label="Language"
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_LABELS[l]}
          </option>
        ))}
      </select>
    </form>
  );
}
