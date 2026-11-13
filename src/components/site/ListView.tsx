import { notFound } from 'next/navigation';
import { missing } from '@/modules/site/missing';
import { getList, PAGE_SIZE } from '@/modules/site/queries';
import type { ListKind, ListSubject } from '@/modules/site/types';
import { Pager } from './Pager';
import { SitePage } from './SitePage';
import styles from './site.module.css';
import { Avatar, RowStory } from './Stories';

// Section, author and tag pages: a heading for the subject, then its articles newest first, 24 a page.

const BASE: Record<Exclude<ListKind, 'latest'>, (slug: string) => string> = {
  section: (slug) => `/${slug}`,
  author: (slug) => `/author/${slug}`,
  tag: (slug) => `/tag/${slug}`,
};

export async function ListView({ kind, slug, page }: { kind: Exclude<ListKind, 'latest'>; slug: string; page: number }) {
  const base = BASE[kind](slug);
  const list = await getList(kind, slug, page);
  if (!list) return missing(page > 1 ? `${base}/page/${page}` : base);
  if (page > 1 && list.rows.length === 0) notFound();
  const subject = list.subject as ListSubject;

  return (
    <SitePage page={`${kind}-${slug}-${page}`} active={kind === 'section' ? slug : undefined} current={kind === 'section' && page === 1}>
      <div className={styles.wrap}>
        <header className={styles.pageHead}>
          {kind === 'author' ? (
            <div className={styles.profile}>
              <Avatar person={{ name: subject.name, photo: subject.photo ?? null }} size={96} />
              <div className={styles.rowText}>
                <h1 className={styles.h1}>{subject.name}</h1>
                {subject.role && <p className={styles.meta}>{subject.role}</p>}
              </div>
            </div>
          ) : (
            <>
              {kind === 'tag' && <span className={`${styles.kicker} ${styles.kickerPlain}`}>Tag</span>}
              <h1 className={styles.h1}>{subject.name}</h1>
            </>
          )}
          {(subject.bio || subject.description) && <p className={styles.stand}>{subject.bio || subject.description}</p>}
          {kind === 'author' && subject.links && subject.links.length > 0 && (
            <ul className={styles.profileLinks} aria-label="Elsewhere">
              {subject.links.map((link) => (
                <li key={link.url}>
                  <a href={link.url} rel="noopener me">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </header>
        <p className={styles.count}>
          {list.total === 0 ? 'No articles yet.' : `${list.total.toLocaleString('en-GB')} ${list.total === 1 ? 'article' : 'articles'}`}
          {page > 1 && ` · page ${page}`}
        </p>
        {list.rows.length > 0 && (
          <ul className={styles.rows}>
            {list.rows.map((card) => (
              <li key={card.id}>
                <RowStory card={card} hideSection={kind === 'section'} />
              </li>
            ))}
          </ul>
        )}
        <Pager base={base} page={page} total={list.total} size={PAGE_SIZE} />
      </div>
    </SitePage>
  );
}
