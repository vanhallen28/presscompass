import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { consentScript } from '@/components/site/ads/consent';
import { THEME_SCRIPT } from '@/components/site/theme';
import { siteUrl } from '@/lib/env';
import { getSiteAds } from '@/modules/ads/queries';
import { adsActive } from '@/modules/ads/types';
import { newsreader, plexMono, plexSans } from './fonts';
import '@/styles/tokens.css';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: 'PressCompass', template: '%s · PressCompass' },
  description: 'News with a sense of direction.',
  // Not indexed until launch (Plan 8 turns indexing on).
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f4ef' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1524' },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The early script runs before the first paint: the theme, and (while ads are on) the consent state for CSS
  // and Google Consent Mode. It lives here because the root layout is never rendered again in the browser;
  // React does not run a <script> it creates on the client and warns about it in development.
  const ads = await getSiteAds();
  const early = THEME_SCRIPT + (adsActive(ads) ? `;${consentScript(ads.consentRequired)}` : '');
  return (
    // The early script sets data-theme and data-consent before React hydrates, hence suppressHydrationWarning.
    <html lang="en" className={`${newsreader.variable} ${plexSans.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: early }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
