import en from './messages/en.json';
import fr from './messages/fr.json';
import rw from './messages/rw.json';
import zh from './messages/zh.json';

export const LOCALES = ['en', 'fr', 'rw', 'zh'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  rw: 'Kinyarwanda',
  zh: '中文',
};

type Messages = Record<string, string>;
const BUNDLES: Record<Locale, Messages> = { en, fr, rw, zh };

export function isLocale(value: string | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

/**
 * Build a translator. One canonical record, localised rendering — commercial
 * meaning stored server-side is never translated, only labels are. Missing keys
 * fall back to English, then to the key itself, so partial locales (rw/zh) render
 * gracefully rather than showing blanks.
 */
export function translator(locale: Locale) {
  const primary = BUNDLES[locale] ?? BUNDLES.en;
  return function t(key: string, vars?: Record<string, string | number>): string {
    let template = primary[key] ?? BUNDLES.en[key] ?? key;
    if (vars) {
      for (const [name, value] of Object.entries(vars)) {
        template = template.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value));
      }
    }
    return template;
  };
}

export type Translate = ReturnType<typeof translator>;
