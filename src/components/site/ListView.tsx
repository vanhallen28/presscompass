import { notFound } from 'next/navigation';
import { Fragment } from 'react';
import { getSiteAds } from '@/modules/ads/queries';
import { missing } from '@/modules/site/missing';
import { getList, PAGE_SIZE } from '@/modules/site/queries';
import type { ListKind, ListSubject } from '@/modules/site/types';
import { AdSlot } from './ads/AdSlot';
import { Pager } from './Pager';
import { SitePage } from './SitePage';
import styles from './site.module.css';
import { Avatar, RowStory } from './Stories';

// Section, author and tag pages: a heading for the subject, then its articles newest first, 24 a page,
// with the list ad slot after the sixth story.

const LIST_AD_AFTER = 6;

const BASE: Record<Exclude<ListKind, 'latest'>, (slug: string) => string> = {
  section: (slug) => `/${slug}`,
  author: (slug) => `/author/${slug}`,
  tag: (slug) => `/tag/${slug}`,
};

export async function ListView({ kind, slug, page }: { kind: Exclude<ListKind, 'latest'>; slug: string; page: number }) {
  const base = BASE[kind](slug);
  const [list, ads] = await Promise.all([getList(kind, slug, page), getSiteAds()]);
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
        {[list.rows.slice(0, LIST_AD_AFTER), list.rows.slice(LIST_AD_AFTER)].map(
          (rows, part) =>
            rows.length > 0 && (
              <Fragment key={part}>
                {part === 1 && <AdSlot ads={ads} placement="list" />}
                <ul className={styles.rows}>
                  {rows.map((card) => (
                    <li key={card.id}>
                      <RowStory card={card} hideSection={kind === 'section'} />
                    </li>
                  ))}
                </ul>
              </Fragment>
            ),
        )}
        <Pager base={base} page={page} total={list.total} size={PAGE_SIZE} />
      </div>
    </SitePage>
  );
}
