import type { Metadata } from 'next';
import './globals.css';
import { brand } from '@/lib/config/brand';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

export const metadata: Metadata = {
  metadataBase: new URL(brand.siteUrl),
  title: { default: `${brand.name}: SIWES placements, internships and CV builder`, template: `%s | ${brand.name}` },
  description: brand.description,
  openGraph: { title: brand.name, description: brand.description, type: 'website' },
};
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' } as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap" />
      </head>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">Skip to content</a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
