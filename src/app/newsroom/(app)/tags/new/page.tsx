import type { Metadata } from 'next';
import { TaxonomyForm } from '@/components/newsroom/TaxonomyForm';
import { PageHeader } from '@/components/newsroom/ui';
import { requireStaff } from '@/modules/auth/staff';
import { saveTag } from '@/modules/taxonomy/actions';

export const metadata: Metadata = { title: 'New tag' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

export default async function NewTagPage() {
  await requireStaff();
  return (
    <>
      <PageHeader title="New tag" back={{ href: '/newsroom/tags', label: 'Tags' }} />
      <TaxonomyForm kind="tag" action={saveTag} initial={{ name: '', slug: '', description: '' }} cancelHref="/newsroom/tags" />
    </>
  );
}
