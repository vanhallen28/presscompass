import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ConfirmButton } from '@/components/newsroom/ConfirmButton';
import forms from '@/components/newsroom/forms.module.css';
import { noticeFor } from '@/components/newsroom/notices';
import { TaxonomyForm } from '@/components/newsroom/TaxonomyForm';
import { Notice, PageHeader } from '@/components/newsroom/ui';
import { UUID } from '@/lib/doc/schema';
import { requireStaff } from '@/modules/auth/staff';
import { deleteSection, saveSection } from '@/modules/taxonomy/actions';
import { getSection, getUsage } from '@/modules/taxonomy/queries';

export const metadata: Metadata = { title: 'Edit section' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

export default async function EditSectionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  await requireStaff();
  const [{ id }, { notice }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const [section, usage] = await Promise.all([getSection(id), getUsage()]);
  if (!section) notFound();
  const articles = usage.sections[id] ?? 0;
  const message = noticeFor('section', notice);

  return (
    <>
      <PageHeader title={section.name} back={{ href: '/newsroom/sections', label: 'Sections' }} />
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <TaxonomyForm
        kind="section"
        action={saveSection}
        initial={{ id: section.id, name: section.name, slug: section.slug, description: section.description, inNav: section.in_nav }}
        cancelHref="/newsroom/sections"
      />
      <section className={forms.danger}>
        <h2 className={forms.dangerTitle}>
          Delete section
        </h2>
        {articles > 0 ? (
          <p className={forms.dangerText}>
            {articles === 1 ? 'One article uses' : `${articles} articles use`} this section. Move {articles === 1 ? 'it' : 'them'} to another section
            before deleting it.
          </p>
        ) : (
          <form action={deleteSection}>
            <input type="hidden" name="id" value={section.id} />
            <ConfirmButton
              icon="trash"
              title={`Delete ${section.name}?`}
              body="The section is removed from the Newsroom and the navigation. This cannot be undone."
              confirmLabel="Delete section"
              danger
            >
              Delete section
            </ConfirmButton>
          </form>
        )}
      </section>
    </>
  );
}
