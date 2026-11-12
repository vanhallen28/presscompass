import type { Metadata } from 'next';
import Link from 'next/link';
import { ButtonLink } from '@/components/ds/Button';
import { noticeFor } from '@/components/newsroom/notices';
import { EmptyState, Notice, PageHeader, ui } from '@/components/newsroom/ui';
import { requireStaff } from '@/modules/auth/staff';
import { getUsage, listAuthors } from '@/modules/taxonomy/queries';

export const metadata: Metadata = { title: 'Authors' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

export default async function AuthorsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  await requireStaff();
  const [{ notice }, authors, usage] = await Promise.all([searchParams, listAuthors(), getUsage()]);
  const message = noticeFor('author', notice);

  return (
    <>
      <PageHeader
        title="Authors"
        description="Bylines on articles. Each author gets a profile page at /author/… with their articles."
        actions={
          <ButtonLink href="/newsroom/authors/new" variant="primary" icon="plus">
            New author
          </ButtonLink>
        }
      />
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <div className={ui.tableWrap}>
        {authors.length === 0 ? (
          <EmptyState icon="users" title="No authors yet">
            <p>Every article needs at least one author before it can be published.</p>
          </EmptyState>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Role</th>
                <th scope="col" className={ui.num}>
                  Articles
                </th>
              </tr>
            </thead>
            <tbody>
              {authors.map((author) => (
                <tr key={author.id}>
                  <td className={ui.cellTitle}>
                    <Link href={`/newsroom/authors/${author.id}`}>{author.name}</Link>
                    <span className={ui.slug}>/author/{author.slug}</span>
                  </td>
                  <td>{author.role || '—'}</td>
                  <td className={ui.num}>{usage.authors[author.id] ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
