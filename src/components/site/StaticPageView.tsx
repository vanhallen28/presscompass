import { sanitizeDoc } from '@/lib/doc/sanitize';
import { formatWib } from '@/lib/time';
import { ArticleBody } from '@/modules/content/ArticleBody';
import { articleHref } from '@/modules/site/format';
import type { SitePageData } from '@/modules/site/types';
import { SitePage } from './SitePage';
import styles from './site.module.css';

/** A published static page (About, Privacy policy): title, text, last updated. No ad slots. */
export function StaticPageView({ page }: { page: SitePageData }) {
  const links = new Map(
    page.links.map((link) => [
      link.id,
      { title: link.title, href: articleHref({ slug: link.slug, section: link.section ? { slug: link.section } : null }) },
    ]),
  );
  const media = new Map(page.media.map((item) => [item.id, item]));
  return (
    <SitePage page={`page-${page.slug}`} slots={false}>
      <div className={styles.wrap}>
        <div className={`${styles.art} ${styles.artSolo}`}>
          <article id={`page-${page.slug}`} tabIndex={-1}>
            <header className={styles.artHead}>
              <h1 className={styles.h1}>{page.title}</h1>
            </header>
            <ArticleBody doc={sanitizeDoc(page.body)} links={links} media={media} />
            <p className={styles.meta}>
              Last updated <time dateTime={page.updatedAt}>{formatWib(page.updatedAt, 'date')}</time>
            </p>
          </article>
        </div>
      </div>
    </SitePage>
  );
}
