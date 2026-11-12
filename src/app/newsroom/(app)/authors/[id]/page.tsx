import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ConfirmButton } from '@/components/newsroom/ConfirmButton';
import forms from '@/components/newsroom/forms.module.css';
import { noticeFor } from '@/components/newsroom/notices';
import { TaxonomyForm } from '@/components/newsroom/TaxonomyForm';
import { Notice, PageHeader } from '@/components/newsroom/ui';
import { UUID } from '@/lib/doc/schema';
import { requireStaff } from '@/modules/auth/staff';
import { deleteAuthor, saveAuthor } from '@/modules/taxonomy/actions';
import { getAuthor, getUsage } from '@/modules/taxonomy/queries';

export const metadata: Metadata = { title: 'Edit author' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

export default async function EditAuthorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  await requireStaff();
  const [{ id }, { notice }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const [author, usage] = await Promise.all([getAuthor(id), getUsage()]);
  if (!author) notFound();
  const articles = usage.authors[id] ?? 0;
  const message = noticeFor('author', notice);

  return (
    <>
      <PageHeader title={author.name} back={{ href: '/newsroom/authors', label: 'Authors' }} />
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <TaxonomyForm
        kind="author"
        action={saveAuthor}
        initial={{ id: author.id, name: author.name, slug: author.slug, role: author.role, bio: author.bio, links: author.links }}
        cancelHref="/newsroom/authors"
      />
      <section className={forms.danger}>
        <h2 className={forms.dangerTitle}>
          Delete author
        </h2>
        {articles > 0 ? (
          <p className={forms.dangerText}>
            {articles === 1 ? 'One article credits' : `${articles} articles credit`} this author. Remove the byline from{' '}
            {articles === 1 ? 'that article' : 'those articles'} before deleting.
          </p>
        ) : (
          <form action={deleteAuthor}>
            <input type="hidden" name="id" value={author.id} />
            <ConfirmButton icon="trash" title={`Delete ${author.name}?`} body="The profile is removed. This cannot be undone." confirmLabel="Delete author" danger>
              Delete author
            </ConfirmButton>
          </form>
        )}
      </section>
    </>
  );
}
