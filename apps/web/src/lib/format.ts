import type { Locale } from '@/i18n';
import { isMasked, MASK, type Maskable } from './types';

/** Minor integer units → localized currency. 1234 → $12.34. USD is the corridor's
 *  quote currency; symbol placement follows the locale. */
export function money(minor: number, locale: Locale): string {
  const intl =
    locale === 'fr' ? 'fr-FR' : locale === 'zh' ? 'zh-CN' : locale === 'rw' ? 'rw-RW' : 'en-US';
  return new Intl.NumberFormat(intl, { style: 'currency', currency: 'USD' }).format(minor / 100);
}

/** Render a possibly-masked money field: real amounts format as currency, "***" passes
 *  through so the UI shows the API's masking rather than fabricating or hiding data. */
export function maskedMoney(v: Maskable<number>, locale: Locale): string {
  return isMasked(v) ? MASK : money(v, locale);
}

export function percent(fraction: number, locale: Locale): string {
  const intl = locale === 'fr' ? 'fr-FR' : locale === 'zh' ? 'zh-CN' : 'en-US';
  return new Intl.NumberFormat(intl, { style: 'percent', maximumFractionDigits: 1 }).format(
    fraction,
  );
}

export function maskedPercent(v: Maskable<number | null>, locale: Locale): string {
  if (isMasked(v)) return MASK;
  if (v === null) return '—';
  return percent(v, locale);
}
