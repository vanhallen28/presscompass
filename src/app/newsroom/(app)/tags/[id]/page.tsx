import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ConfirmButton } from '@/components/newsroom/ConfirmButton';
import forms from '@/components/newsroom/forms.module.css';
import { noticeFor } from '@/components/newsroom/notices';
import { TaxonomyForm } from '@/components/newsroom/TaxonomyForm';
import { Notice, PageHeader } from '@/components/newsroom/ui';
import { UUID } from '@/lib/doc/schema';
import { requireStaff } from '@/modules/auth/staff';
import { deleteTag, saveTag } from '@/modules/taxonomy/actions';
import { getTag, getUsage } from '@/modules/taxonomy/queries';

export const metadata: Metadata = { title: 'Edit tag' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

export default async function EditTagPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  await requireStaff();
  const [{ id }, { notice }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const [tag, usage] = await Promise.all([getTag(id), getUsage()]);
  if (!tag) notFound();
  const articles = usage.tags[id] ?? 0;
  const message = noticeFor('tag', notice);

  return (
    <>
      <PageHeader title={tag.name} back={{ href: '/newsroom/tags', label: 'Tags' }} />
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <TaxonomyForm kind="tag" action={saveTag} initial={{ id: tag.id, name: tag.name, slug: tag.slug, description: tag.description }} cancelHref="/newsroom/tags" />
      <section className={forms.danger}>
        <h2 className={forms.dangerTitle}>
          Delete tag
        </h2>
        <p className={forms.dangerText}>
          {articles > 0 ? `The tag is removed from ${articles === 1 ? 'one article' : `${articles} articles`}. The articles stay.` : 'No articles use this tag.'}
        </p>
        <form action={deleteTag}>
          <input type="hidden" name="id" value={tag.id} />
          <ConfirmButton
            icon="trash"
            title={`Delete ${tag.name}?`}
            body={articles > 0 ? 'The tag is removed from its articles. This cannot be undone.' : 'This cannot be undone.'}
            confirmLabel="Delete tag"
            danger
          >
            Delete tag
          </ConfirmButton>
        </form>
      </section>
    </>
  );
}
