import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { UUID } from '@/lib/doc/schema';
import { sanitizeDoc } from '@/lib/doc/sanitize';
import { bodyMediaIds } from '@/lib/doc/text';
import { requireStaff } from '@/modules/auth/staff';
import { getArticle, publishDue } from '@/modules/editor/queries';
import { mediaByIds } from '@/modules/media/queries';
import { listAuthors, listSections, listTags } from '@/modules/taxonomy/queries';
import { ArticleEditor } from './ArticleEditor';

export const metadata: Metadata = { title: 'Edit article' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

const NOTICES: Record<string, { tone: 'success' | 'error'; text: string }> = {
  restored: { tone: 'success', text: 'Earlier version restored. The version before it is kept in History.' },
  'delete-failed': { tone: 'error', text: 'The article could not be deleted. Published articles must be unpublished or archived first.' },
};

export default async function EditArticlePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  await requireStaff();
  const [{ id }, { notice }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  await publishDue();
  const [article, sections, authors, tags] = await Promise.all([getArticle(id), listSections(), listAuthors(), listTags()]);
  if (!article) notFound();
  const media = await mediaByIds([article.lead_media_id, ...bodyMediaIds(sanitizeDoc(article.body))]);

  return (
    <ArticleEditor
      key={`${article.id}-${article.version}`}
      article={article}
      sections={sections.map(({ id: sid, name, slug }) => ({ id: sid, name, slug }))}
      authors={authors.map(({ id: aid, name, role }) => ({ id: aid, name, role }))}
      tags={tags.map(({ id: tid, name }) => ({ id: tid, name }))}
      media={[...media.values()]}
      notice={notice ? (NOTICES[notice] ?? null) : null}
    />
  );
}
