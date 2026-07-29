import type { Metadata, Viewport } from 'next';
import './globals.css';
import { getLocale } from '@/lib/session';

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
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
