import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ButtonLink } from '@/components/ds/Button';
import { Logo } from '@/components/ds/Logo';
import { sanitizeDoc } from '@/lib/doc/sanitize';
import { type Block, UUID } from '@/lib/doc/schema';
import { bodyMediaIds, docText, readingMinutes, wordCount } from '@/lib/doc/text';
import { formatWib } from '@/lib/time';
import { requireStaff } from '@/modules/auth/staff';
import { ArticleView } from '@/components/site/ArticleView';
import { mediaByIds } from '@/modules/media/queries';
import { articleLinks, getArticle, getRevision } from '@/modules/editor/queries';
import { STATUS_LABELS } from '@/modules/editor/status';
import { getSection, listAuthors, listTags } from '@/modules/taxonomy/queries';
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
    leadMediaId: snap.lead_media_id !== undefined ? snap.lead_media_id : article.lead_media_id,
    leadCaption: snap.lead_caption ?? article.lead_caption,
    isBreaking: snap.is_breaking ?? article.is_breaking,
    tagIds: snap.tags ?? article.tagIds,
  };

  const readMoreIds = view.body.content.filter((block): block is Extract<Block, { type: 'readMore' }> => block.type === 'readMore').map((block) => block.attrs.articleId);
  const [section, authors, tags, links] = await Promise.all([
    view.sectionId ? getSection(view.sectionId) : null,
    listAuthors(),
    listTags(),
    articleLinks(readMoreIds),
  ]);
  const byline = view.authorIds.map((authorId) => authors.find((a) => a.id === authorId)).filter((a) => a !== undefined);
  const media = await mediaByIds([view.leadMediaId, ...bodyMediaIds(view.body), ...byline.map((author) => author.photo_media_id)]);
  const image = (mediaId: string | null) => (mediaId ? (media.get(mediaId) ?? null) : null);
  const published = article.status === 'published' && article.published_at;
  const dateLine = published
    ? undefined
    : article.scheduled_at && article.status === 'scheduled'
      ? `Scheduled for ${formatWib(article.scheduled_at)} WIB`
      : 'Not published yet';

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
        <ArticleView
          linked={false}
          dateLine={dateLine}
          article={{
            title: view.title,
            standfirst: view.standfirst,
            type: view.type,
            kicker: view.kicker,
            isBreaking: view.isBreaking,
            section: section ? { name: section.name, slug: section.slug } : null,
            authors: byline.map((author) => ({ name: author.name, slug: '', role: author.role, photo: image(author.photo_media_id) })),
            publishedAt: published ? article.published_at : null,
            updatedAt: article.major_update_at,
            readingMinutes: readingMinutes(wordCount(docText(view.body))),
            lead: image(view.leadMediaId),
            leadCaption: view.leadCaption,
            body: view.body,
            links,
            media,
            sources: view.sources,
            tags: view.tagIds.map((tagId) => tags.find((tag) => tag.id === tagId)).filter((tag) => tag !== undefined),
          }}
        />
      </main>
    </div>
  );
}
