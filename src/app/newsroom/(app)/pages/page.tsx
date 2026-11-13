import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ds/Button';
import { EmptyState, Notice, PageHeader, ui } from '@/components/newsroom/ui';
import { formatWib } from '@/lib/time';
import { requireStaff } from '@/modules/auth/staff';
import { createPage } from '@/modules/pages/actions';
import { listPages } from '@/modules/pages/queries';

export const metadata: Metadata = { title: 'Pages' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

const NOTICES: Record<string, { tone: 'success' | 'error'; text: string }> = {
  deleted: { tone: 'success', text: 'Page deleted.' },
  failed: { tone: 'error', text: 'The page could not be created. Try again.' },
};

export default async function PagesPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  await requireStaff();
  const [{ notice }, pages] = await Promise.all([searchParams, listPages()]);
  const message = notice ? NOTICES[notice] : undefined;

  return (
    <>
      <PageHeader
        title="Pages"
        description="Pages that are not news: About, Contact, Privacy policy, Terms. Published pages appear in the footer and at their own address, like /privacy-policy."
        actions={
          <form action={createPage}>
            <Button type="submit" variant="primary" icon="plus">
              New page
            </Button>
          </form>
        }
      />
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <div className={ui.tableWrap}>
        {pages.length === 0 ? (
          <EmptyState icon="file" title="No pages yet">
            <p>Ad networks such as AdSense look for About, Contact and Privacy policy pages before they approve a site.</p>
          </EmptyState>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Status</th>
                <th scope="col">Last saved</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((page) => (
                <tr key={page.id}>
                  <td className={ui.cellTitle}>
                    <Link href={`/newsroom/pages/${page.id}`}>{page.title || 'Untitled page'}</Link>
                    <span className={ui.slug}>/{page.slug}</span>
                  </td>
                  <td>{page.status === 'published' ? 'Published' : 'Draft'}</td>
                  <td>{formatWib(page.updatedAt, 'datetime')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
