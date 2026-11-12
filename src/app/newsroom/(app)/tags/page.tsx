import type { Metadata } from 'next';
import Link from 'next/link';
import { ButtonLink } from '@/components/ds/Button';
import { noticeFor } from '@/components/newsroom/notices';
import { EmptyState, Notice, PageHeader, ui } from '@/components/newsroom/ui';
import { requireStaff } from '@/modules/auth/staff';
import { getUsage, listTags } from '@/modules/taxonomy/queries';

export const metadata: Metadata = { title: 'Tags' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

export default async function TagsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  await requireStaff();
  const [{ notice }, tags, usage] = await Promise.all([searchParams, listTags(), getUsage()]);
  const message = noticeFor('tag', notice);

  return (
    <>
      <PageHeader
        title="Tags"
        description="Tags connect articles across sections, for example Elections or Rice. Each tag gets its own page at /tag/…"
        actions={
          <ButtonLink href="/newsroom/tags/new" variant="primary" icon="plus">
            New tag
          </ButtonLink>
        }
      />
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <div className={ui.tableWrap}>
        {tags.length === 0 ? (
          <EmptyState icon="tag" title="No tags yet">
            <p>Add tags for the topics you cover often.</p>
          </EmptyState>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col" className={ui.num}>
                  Articles
                </th>
                <th scope="col">Description</th>
              </tr>
            </thead>
            <tbody>
              {tags.map((tag) => (
                <tr key={tag.id}>
                  <td className={ui.cellTitle}>
                    <Link href={`/newsroom/tags/${tag.id}`}>{tag.name}</Link>
                    <span className={ui.slug}>/tag/{tag.slug}</span>
                  </td>
                  <td className={ui.num}>{usage.tags[tag.id] ?? 0}</td>
                  <td className={ui.cellTitle}>{tag.description || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
