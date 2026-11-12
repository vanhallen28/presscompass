import type { Metadata } from 'next';
import { TaxonomyForm } from '@/components/newsroom/TaxonomyForm';
import { PageHeader } from '@/components/newsroom/ui';
import { requireStaff } from '@/modules/auth/staff';
import { saveSection } from '@/modules/taxonomy/actions';

export const metadata: Metadata = { title: 'New section' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

export default async function NewSectionPage() {
  await requireStaff();
  return (
    <>
      <PageHeader title="New section" back={{ href: '/newsroom/sections', label: 'Sections' }} />
      <TaxonomyForm kind="section" action={saveSection} initial={{ name: '', slug: '', description: '', inNav: true }} cancelHref="/newsroom/sections" />
    </>
  );
}
