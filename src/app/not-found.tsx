import type { Metadata } from 'next';
import { SearchForm } from '@/components/site/SearchForm';
import { SitePage } from '@/components/site/SitePage';
import { TopStory } from '@/components/site/Stories';
import styles from '@/components/site/site.module.css';
import { getList } from '@/modules/site/queries';

export const metadata: Metadata = { title: 'Page not found' };

// Every address without a page, and every notFound() on the site. (The Newsroom keeps its own messages.)
export default async function NotFound() {
  const latest = await getList('latest', null, 1, 5);
  return (
    <SitePage page="not-found" ads={false}>
      <div className={styles.wrap}>
        <header className={`${styles.pageHead} ${styles.pageHeadPlain}`}>
          <h1 className={styles.h1}>Page not found</h1>
          <p className={styles.stand}>The page may have moved or been taken down. Search for it, or start from the latest stories.</p>
          <SearchForm />
        </header>
        {latest && latest.rows.length > 0 && (
          <section className={styles.sec} aria-label="Latest stories">
            <h2 className={styles.railTitle}>Latest</h2>
            <ul className={styles.toplist}>
              {latest.rows.map((card) => (
                <li key={card.id}>
                  <TopStory card={card} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </SitePage>
  );
}
