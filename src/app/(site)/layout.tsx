import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AdRuntime } from '@/components/site/ads/AdRuntime';
import { ConsentBanner } from '@/components/site/ads/ConsentBanner';
import { getSiteAds } from '@/modules/ads/queries';
import { adsActive } from '@/modules/ads/types';
import { parseVerificationMeta } from '@/modules/ads/validate';

// Shared by every public page: verification tags for ad networks, and (while ads are on) the ad runtime and
// the cookie banner. The early consent script is in the root layout (src/app/layout.tsx). The Newsroom and the
// 404 page sit outside this layout.

export async function generateMetadata(): Promise<Metadata> {
  const ads = await getSiteAds();
  const other: Record<string, string> = {};
  if (ads.adsenseClient) other['google-adsense-account'] = ads.adsenseClient;
  for (const tag of parseVerificationMeta(ads.verificationMeta).tags) other[tag.name] = tag.content;
  return Object.keys(other).length ? { other } : {};
}

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const ads = await getSiteAds();
  const active = adsActive(ads);
  return (
    <>
      {children}
      {active && (
        <AdRuntime
          config={{
            consentRequired: ads.consentRequired,
            adsenseClient: ads.adsenseClient,
            adsense: Boolean(ads.adsenseClient) && (ads.adsenseAuto || ads.slots.some((slot) => slot.kind === 'adsense')),
            gpt: ads.slots.some((slot) => slot.kind === 'gpt'),
            metaPixelId: ads.metaPixelId,
            headCode: ads.headCode,
            bodyCode: ads.bodyCode,
          }}
        />
      )}
      {active && ads.consentRequired && <ConsentBanner privacyUrl={ads.privacyUrl} />}
    </>
  );
}
