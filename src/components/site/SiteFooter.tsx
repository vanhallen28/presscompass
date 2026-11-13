import Link from 'next/link';
import { Logo } from '@/components/ds/Logo';
import { adsActive, type SiteAds } from '@/modules/ads/types';
import { getPages, getSections, todayLine } from '@/modules/site/queries';
import { CookieSettingsButton } from './ads/CookieSettingsButton';
import styles from './site.module.css';
import { ThemeSwitch } from './ThemeSwitch';

// Navy footer (paper-sunken in dark mode). Published static pages are listed under PressCompass; Cookie
// settings appears while ads with the consent banner are on. The footer text becomes editable in a later plan.

const ABOUT = 'Independent, English-language news about Indonesia. Facts verified, context explained.';

export async function SiteFooter({ ads }: { ads: SiteAds }) {
  const [sections, pages, today] = await Promise.all([getSections(), getPages(), todayLine()]);
  const year = today.slice(-4);
  return (
    <footer className={styles.foot}>
      <div className={styles.wrap}>
        <div className={styles.footTop}>
          <div>
            <Logo height={30} tone="current" className={styles.footLogo} />
            <p className={styles.footAbout}>{ABOUT}</p>
          </div>
          <div>
            <h2 className={styles.footHead}>Sections</h2>
            <ul>
              {sections
                .filter((section) => section.inNav)
                .map((section) => (
                  <li key={section.slug}>
                    <Link href={`/${section.slug}`}>{section.name}</Link>
                  </li>
                ))}
            </ul>
          </div>
          <div>
            <h2 className={styles.footHead}>PressCompass</h2>
            <ul>
              <li>
                <Link href="/">Front page</Link>
              </li>
              <li>
                <Link href="/search">Search</Link>
              </li>
              {pages.map((page) => (
                <li key={page.slug}>
                  <Link href={`/${page.slug}`}>{page.title}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className={styles.footHead}>Theme</h2>
            <ThemeSwitch />
          </div>
        </div>
        <div className={styles.footBot}>
          <span>© {year} PressCompass · presscompass.site</span>
          {adsActive(ads) && ads.consentRequired && <CookieSettingsButton />}
        </div>
      </div>
    </footer>
  );
}
