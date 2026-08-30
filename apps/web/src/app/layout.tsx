import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';
import { getLocale } from '@/lib/session';

// Stand-in for the brand book's Mont (a licensed commercial font, not on Google Fonts — can't
// be embedded without the actual license/font files; swap this for real Mont if/when those
// arrive). Manrope over the more geometrically-exact Jost: Jost's single-story "a" and
// perfectly circular "o" read closer to Mont, but this app is dense tables and forms all day,
// and Manrope stays legible at small sizes where Jost starts to blur letterforms together.
// next/font self-hosts at build time — no runtime request to Google, no layout shift.
const brandFont = Manrope({ subsets: ['latin'], variable: '--font-brand', display: 'swap' });

export const metadata: Metadata = {
  title: 'UZA Nexus',
  description: 'China → Kigali/Goma trade corridor operations console',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f5132',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={brandFont.variable}>
      <body>{children}</body>
    </html>
  );
}
