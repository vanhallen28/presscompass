import type { Metadata } from 'next';
import { TaxonomyForm } from '@/components/newsroom/TaxonomyForm';
import { PageHeader } from '@/components/newsroom/ui';
import { requireStaff } from '@/modules/auth/staff';
import { saveAuthor } from '@/modules/taxonomy/actions';

export const metadata: Metadata = { title: 'New author' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

export default async function NewAuthorPage() {
  await requireStaff();
  return (
    <>
      <PageHeader title="New author" back={{ href: '/newsroom/authors', label: 'Authors' }} />
      <TaxonomyForm kind="author" action={saveAuthor} initial={{ name: '', slug: '', role: '', bio: '', links: [] }} cancelHref="/newsroom/authors" />
    </>
  );
}
