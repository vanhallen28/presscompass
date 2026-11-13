import Link from 'next/link';
import { Button, ButtonLink } from '@/components/ds/Button';
import { Logo } from '@/components/ds/Logo';
import { formatWib } from '@/lib/time';
import { articleHref } from '@/modules/site/format';
import { getLatestStrip, getSections, todayLine } from '@/modules/site/queries';
import { SearchForm } from './SearchForm';
import styles from './site.module.css';

// Utility bar with the date, masthead, section navigation and the Latest strip (locked preview header).
// The section menu on the left is a popover: it opens and closes without JavaScript.
//
// `page` makes element ids unique per page: Next keeps recently visited pages in the DOM (hidden), so a fixed
// id would make the menu button open another page's menu.

export async function SiteHeader({ page, active, current = false }: { page: string; active?: string; current?: boolean }) {
  const [sections, latest, today] = await Promise.all([getSections(), getLatestStrip(), todayLine()]);
  const nav = sections.filter((section) => section.inNav);
  const menu = `menu-${page}`;
  const mark = (slug: string) => (slug === active ? (current ? 'page' : 'true') : undefined);

  return (
    <header>
      <a className={styles.skip} href={`#main-${page}`}>
        Skip to content
      </a>
      <div className={styles.util}>
        <div className={`${styles.wrap} ${styles.utilInner}`}>
          <span className={styles.date}>{today}</span>
        </div>
      </div>
      <div className={styles.masthead}>
        <div className={`${styles.wrap} ${styles.mastInner}`}>
          <Button variant="quiet" icon="menu" aria-label="Menu" popoverTarget={menu} className={styles.mastLeft} />
          <Link href="/" className={styles.logoLink} aria-label="PressCompass home">
            <Logo height={36} label="" className={styles.logo} />
          </Link>
          <div className={styles.mastRight}>
            <ButtonLink href="/search" variant="quiet" icon="search" aria-label="Search" />
          </div>
        </div>
      </div>
      {nav.length > 0 && (
        <nav className={styles.nav} aria-label="Sections">
          <ul>
            {nav.map((section) => (
              <li key={section.slug}>
                <Link href={`/${section.slug}`} aria-current={mark(section.slug)}>
                  {section.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      {latest.rows.length > 0 && (
        <section className={styles.latest} aria-label="Latest">
          <div className={`${styles.wrap} ${styles.latestInner}`}>
            <span className={styles.latestLabel}>
              <span className={styles.dot} aria-hidden="true" />
              Latest
            </span>
            <ul>
              {latest.rows.map((card) => (
                <li key={card.id}>
                  <time dateTime={card.publishedAt}>{formatWib(card.publishedAt, 'time')}</time>
                  <Link href={articleHref(card)}>{card.title}</Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
      <div id={menu} popover="auto" className={styles.menu} aria-label="Menu">
        <div className={styles.menuTop}>
          <p className={styles.menuTitle}>Sections</p>
          <Button variant="quiet" icon="x" aria-label="Close menu" popoverTarget={menu} popoverTargetAction="hide" />
        </div>
        <ul className={styles.menuList}>
          <li>
            <Link href="/">Front page</Link>
          </li>
          {sections.map((section) => (
            <li key={section.slug}>
              <Link href={`/${section.slug}`} aria-current={mark(section.slug)}>
                {section.name}
              </Link>
            </li>
          ))}
        </ul>
        <SearchForm />
      </div>
    </header>
  );
}
