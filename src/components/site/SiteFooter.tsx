import Link from 'next/link';
import { Logo } from '@/components/ds/Logo';
import { getSections, todayLine } from '@/modules/site/queries';
import styles from './site.module.css';
import { ThemeSwitch } from './ThemeSwitch';

// Navy footer (paper-sunken in dark mode). Its text becomes editable in Plan 5; columns without content
// (pages, newsletters, RSS) appear once those exist.

const ABOUT = 'Independent, English-language news about Indonesia. Facts verified, context explained.';

export async function SiteFooter() {
  const [sections, today] = await Promise.all([getSections(), todayLine()]);
  const year = today.slice(-4);
  return (
    <footer className={styles.foot}>
      <div className={styles.wrap}>
        <div className={styles.footTop}>
          <div>
            <Logo height={30} tone="inverse" className={styles.footLogo} />
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
            </ul>
          </div>
          <div>
            <h2 className={styles.footHead}>Theme</h2>
            <ThemeSwitch />
          </div>
        </div>
        <div className={styles.footBot}>
          <span>© {year} PressCompass · presscompass.site</span>
        </div>
      </div>
    </footer>
  );
}
