import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { CloudImage } from '@/components/media/CloudImage';
import type { Doc } from '@/lib/doc/schema';
import { formatWib } from '@/lib/time';
import { ArticleBody, type ArticleLinks, type ArticleMedia, BODY_IMAGE_SIZES } from '@/modules/content/ArticleBody';
import type { ArticleType, Source } from '@/modules/editor/input';
import { articleDateLine, kickerFor } from '@/modules/site/format';
import type { SiteImage, SitePerson, SiteSection } from '@/modules/site/types';
import styles from './site.module.css';
import { Avatar, KickerLabel } from './Stories';

// The article as readers see it (locked preview: .art, .art-head, .byline, .lead-fig, .body, .tags).
// The public article page and the Newsroom preview both render this, so the preview is the real thing.

export type ArticleViewData = {
  title: string;
  standfirst: string;
  type: ArticleType;
  kicker: string;
  isBreaking: boolean;
  section: SiteSection | null;
  authors: SitePerson[];
  publishedAt: string | null;
  updatedAt: string | null;
  readingMinutes: number;
  lead: SiteImage | null;
  leadCaption: string;
  body: Doc;
  links: ArticleLinks;
  media: ArticleMedia;
  sources: Source[];
  tags: { name: string; slug: string }[];
};

export function ArticleView({
  article,
  id,
  linked,
  dateLine,
  actions,
  rail,
}: {
  article: ArticleViewData;
  /** id of the article element, the skip link's target. */
  id?: string;
  /** Link the section, authors and tags (the site); the Newsroom preview shows them as text. */
  linked: boolean;
  /** Replaces the published date line (the preview of an unpublished article). */
  dateLine?: string;
  actions?: ReactNode;
  rail?: ReactNode;
}) {
  const sectionKicker = article.section ? kickerFor({ ...article, kicker: '', isBreaking: false, type: 'news' }) : null;
  const ownKicker = kickerFor({ ...article, section: null });
  const writers = article.authors;
  const lead = article.lead;

  return (
    <div className={`${styles.art} ${rail ? '' : styles.artSolo}`}>
      <article id={id} tabIndex={-1}>
        <header className={styles.artHead}>
          <p className={styles.kickers}>
            {sectionKicker &&
              (linked && article.section ? (
                <Link href={`/${article.section.slug}`}>
                  <KickerLabel kicker={sectionKicker} />
                </Link>
              ) : (
                <KickerLabel kicker={sectionKicker} />
              ))}
            {ownKicker && ownKicker.text !== sectionKicker?.text && <KickerLabel kicker={ownKicker} />}
          </p>
          <h1 className={styles.h1}>{article.title || 'Untitled'}</h1>
          {article.standfirst && <p className={styles.stand}>{article.standfirst}</p>}
        </header>
        <div className={styles.byline}>
          {writers[0] && <Avatar person={writers[0]} size={40} />}
          <div>
            <p className={styles.who}>
              {writers.length ? 'By ' : <span>No author yet</span>}
              {writers.map((writer, index) => (
                <Fragment key={writer.slug || writer.name}>
                  {index > 0 && (index === writers.length - 1 ? ' and ' : ', ')}
                  {linked && writer.slug ? (
                    <Link href={`/author/${writer.slug}`}>
                      <b>{writer.name}</b>
                    </Link>
                  ) : (
                    <b>{writer.name}</b>
                  )}
                </Fragment>
              ))}
              {writers.length === 1 && writers[0].role && <span>, {writers[0].role}</span>}
            </p>
            <p className={styles.meta}>
              {dateLine ??
                (article.publishedAt ? (
                  <time dateTime={article.publishedAt}>{articleDateLine(article.publishedAt, article.updatedAt, article.readingMinutes)}</time>
                ) : (
                  'Not published yet'
                ))}
            </p>
          </div>
          {actions}
        </div>
        {lead && (
          <figure className={styles.leadFig}>
            <CloudImage image={lead} alt={lead.alt} preset="card" sizes={BODY_IMAGE_SIZES} priority />
            {(article.leadCaption || lead.credit) && (
              <figcaption className={styles.cap}>
                {article.leadCaption}
                {article.leadCaption && lead.credit && ' '}
                {lead.credit && <span className={styles.credit}>Photo: {lead.credit}</span>}
              </figcaption>
            )}
          </figure>
        )}
        <ArticleBody doc={article.body} links={article.links} media={article.media} />
        {article.sources.length > 0 && (
          <section className={styles.sources} aria-label="Sources">
            <h2>Sources</h2>
            <ol>
              {article.sources.map((source, index) => (
                <li key={index}>
                  {/^https?:\/\//i.test(source.url) ? (
                    <a href={source.url} rel="noopener">
                      {source.title}
                    </a>
                  ) : (
                    source.title
                  )}
                  {source.publisher && `, ${source.publisher}`}
                  {source.accessed && ` (accessed ${formatWib(`${source.accessed}T00:00:00+07:00`, 'date')})`}
                </li>
              ))}
            </ol>
          </section>
        )}
        {article.tags.length > 0 && (
          <ul className={styles.tags} aria-label="Tags">
            {article.tags.map((tag) => (
              <li key={tag.slug}>
                {linked ? (
                  <Link className={styles.tag} href={`/tag/${tag.slug}`}>
                    {tag.name}
                  </Link>
                ) : (
                  <span className={styles.tag}>{tag.name}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </article>
      {rail && (
        <aside className={styles.rail} aria-label="Related">
          {rail}
        </aside>
      )}
    </div>
  );
}
