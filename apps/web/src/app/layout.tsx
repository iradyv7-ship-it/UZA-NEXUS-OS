import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { getLocale } from '@/lib/session';

// One primary typeface for the whole console — next/font self-hosts it at build time (no
// runtime request to Google, no layout shift, no separate CDN dependency to configure).
// Variable font, so Tailwind's font-weight utilities (font-medium, font-semibold, …) all work
// without shipping multiple static weights.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

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
    <html lang={locale} className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
