import type { ReactNode } from 'react';
import { getSiteAds } from '@/modules/ads/queries';
import { NO_ADS, slotFor } from '@/modules/ads/types';
import { AdSlot } from './ads/AdSlot';
import styles from './site.module.css';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

/**
 * Header, main and footer of a public page. `page` is a key unique to this page (used for element ids,
 * see SiteHeader); `active` marks a section in the navigation, `current` when this page is that section.
 * The top and footer ad slots appear here while ads are on; `ads={false}` leaves out everything about ads
 * (the 404 page sits outside the site layout, so it has no cookie banner).
 */
export async function SitePage({
  page,
  active,
  current,
  ads: withAds = true,
  slots = true,
  children,
}: {
  page: string;
  active?: string;
  current?: boolean;
  ads?: boolean;
  /** false: no ad slots on this page (static pages), but the cookie banner and Cookie settings stay. */
  slots?: boolean;
  children: ReactNode;
}) {
  const ads = withAds ? await getSiteAds() : NO_ADS;
  return (
    <>
      <SiteHeader page={page} active={active} current={current} />
      <main id={`main-${page}`} tabIndex={-1}>
        {slots && slotFor(ads, 'top') && (
          <div className={styles.wrap}>
            <AdSlot ads={ads} placement="top" />
          </div>
        )}
        {children}
        {slots && slotFor(ads, 'footer') && (
          <div className={styles.wrap}>
            <AdSlot ads={ads} placement="footer" />
          </div>
        )}
      </main>
      <SiteFooter ads={ads} />
    </>
  );
}
