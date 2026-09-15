import type { Metadata, Viewport } from 'next';
import { Archivo } from 'next/font/google';
import './globals.css';
import { getLocale } from '@/lib/session';

// The brand kit's own type family (UZA Build branding project / Claude Design canvas):
// Archivo, weights 400/500/600/700, for both headings and body — one family, per the kit's
// type scale. Helvetica Neue (declared in tailwind.config.ts) is the kit's own documented
// office fallback if Archivo fails to load. next/font self-hosts at build time — no runtime
// request to Google, no layout shift — which matters on the outdoor/warehouse connections
// this app runs on.
const brandFont = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-brand',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'UZA Nexus OS',
  description: 'China → Kigali/Goma trade corridor operations console',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#233448', // brand navy (--primary, light mode) — was a stray placeholder green
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={brandFont.variable}>
      <body>{children}</body>
    </html>
  );
}
