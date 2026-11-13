import type { CSSProperties } from 'react';
import type { Placement, SiteAds } from '@/modules/ads/types';
import { AdFill } from './AdFill';
import styles from './ads.module.css';

/**
 * A reserved, labelled place for one ad. Renders nothing while ads are off or the slot is off. The box keeps
 * its height before the ad loads (no layout shift); CSS shows it only after consent and hides it on screen
 * sizes whose height is 0.
 */
export function AdSlot({ ads, placement, className }: { ads: SiteAds; placement: Placement; className?: string }) {
  const slot = ads.enabled ? ads.slots.find((s) => s.placement === placement) : undefined;
  if (!slot) return null;
  const style = { '--ad-h-m': `${slot.heightMobile}px`, '--ad-h-d': `${slot.heightDesktop}px` } as CSSProperties;
  const classes = [styles.slot, slot.heightMobile === 0 && styles.noMobile, slot.heightDesktop === 0 && styles.noDesktop, className]
    .filter(Boolean)
    .join(' ');
  return (
    <aside className={classes} style={style} aria-label={ads.label} data-placement={placement}>
      <p className={styles.label} aria-hidden="true">
        {ads.label}
      </p>
      <AdFill slot={slot} client={ads.adsenseClient} label={ads.label} consentRequired={ads.consentRequired} className={styles.box} />
    </aside>
  );
}
