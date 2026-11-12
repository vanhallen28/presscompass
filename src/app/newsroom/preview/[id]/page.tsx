import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ButtonLink } from '@/components/ds/Button';
import { Logo } from '@/components/ds/Logo';
import { sanitizeDoc } from '@/lib/doc/sanitize';
import { type Block, UUID } from '@/lib/doc/schema';
import { docText, readingMinutes, wordCount } from '@/lib/doc/text';
import { formatWib } from '@/lib/time';
import { requireStaff } from '@/modules/auth/staff';
import { ArticleBody } from '@/modules/content/ArticleBody';
import { TYPE_LABELS } from '@/modules/editor/input';
import { articleLinks, getArticle, getRevision } from '@/modules/editor/queries';
import { STATUS_LABELS } from '@/modules/editor/status';
import { getSection, listAuthors } from '@/modules/taxonomy/queries';
import styles from './preview.module.css';

export const metadata: Metadata = { title: 'Preview' };

// Previews read the session and drafts on every request.
export const instant = false;

export default async function PreviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ revision?: string }> }) {
  await requireStaff();
  const [{ id }, { revision: revisionParam }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const article = await getArticle(id);
  if (!article) notFound();

  const revisionId = Number(revisionParam);
  const revision = revisionParam && Number.isInteger(revisionId) ? await getRevision(id, revisionId) : null;
  const snap = revision?.snapshot ?? {};
  const view = {
    title: snap.title ?? article.title,
    standfirst: snap.standfirst ?? article.standfirst,
    kicker: snap.kicker_label ?? article.kicker_label,
    type: snap.type ?? article.type,
    sectionId: snap.section_id !== undefined ? snap.section_id : article.section_id,
    authorIds: snap.authors ?? article.authorIds,
    body: sanitizeDoc(snap.body ?? article.body),
    sources: snap.sources ?? article.sources,
  };

  const readMoreIds = view.body.content.filter((block): block is Extract<Block, { type: 'readMore' }> => block.type === 'readMore').map((block) => block.attrs.articleId);
  const [section, authors, links] = await Promise.all([view.sectionId ? getSection(view.sectionId) : null, listAuthors(), articleLinks(readMoreIds)]);
  const byline = view.authorIds.map((authorId) => authors.find((a) => a.id === authorId)).filter((a) => a !== undefined);
  const minutes = readingMinutes(wordCount(docText(view.body)));
  const dateLine = article.published_at
    ? `${formatWib(article.published_at)} WIB`
    : article.scheduled_at
      ? `Scheduled for ${formatWib(article.scheduled_at)} WIB`
      : 'Not published yet';
  const kicker = view.kicker || section?.name || TYPE_LABELS[view.type];

  return (
    <div className={styles.page}>
      <div className={styles.bar} role="region" aria-label="Preview">
        <p>
          <b>{revision ? `Version from ${formatWib(revision.created_at)} WIB` : `Preview · ${STATUS_LABELS[article.status]}`}</b>
          <span>
            {revision
              ? 'This is an older version from the history. It is not on the site.'
              : article.status === 'published'
                ? 'Readers see this version.'
                : 'Readers cannot see this page.'}
          </span>
        </p>
        <ButtonLink href={revision ? `/newsroom/articles/${id}/history` : `/newsroom/articles/${id}`} size="sm" icon="arrow-left">
          {revision ? 'Back to history' : 'Back to editor'}
        </ButtonLink>
      </div>
      <header className={styles.masthead}>
        <Logo height={30} />
      </header>
      <main className={styles.wrap}>
        <article className={styles.article}>
          <header className={styles.head}>
            <p className={styles.kickers}>
              <span className={styles.kicker}>{kicker}</span>
              {view.type !== 'news' && kicker !== TYPE_LABELS[view.type] && <span className={styles.kickerPlain}>{TYPE_LABELS[view.type]}</span>}
            </p>
            <h1 className={styles.headline}>{view.title || 'Untitled'}</h1>
            {view.standfirst && <p className={styles.stand}>{view.standfirst}</p>}
          </header>
          <div className={styles.byline}>
            <p className={styles.who}>
              {byline.length ? (
                <>
                  By{' '}
                  {byline.map((author, index) => (
                    <span key={author.id}>
                      {index > 0 && (index === byline.length - 1 ? ' and ' : ', ')}
                      <b>{author.name}</b>
                    </span>
                  ))}
                  {byline.length === 1 && byline[0].role && <span className={styles.role}> · {byline[0].role}</span>}
                </>
              ) : (
                <span className={styles.role}>No author yet</span>
              )}
            </p>
            <p className={styles.meta}>
              {dateLine}
              {minutes > 0 && ` · ${minutes} min read`}
            </p>
          </div>
          <ArticleBody doc={view.body} links={links} />
          {view.sources.length > 0 && (
            <section className={styles.sources} aria-label="Sources">
              <h2>Sources</h2>
              <ol>
                {view.sources.map((source, index) => (
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
        </article>
      </main>
    </div>
  );
}
