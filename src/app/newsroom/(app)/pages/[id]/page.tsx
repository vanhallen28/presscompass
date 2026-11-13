import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { UUID } from '@/lib/doc/schema';
import { bodyMediaIds } from '@/lib/doc/text';
import { sanitizeDoc } from '@/lib/doc/sanitize';
import { requireStaff } from '@/modules/auth/staff';
import { mediaByIds } from '@/modules/media/queries';
import { getPageForEdit } from '@/modules/pages/queries';
import { PageEditor } from './PageEditor';

export const metadata: Metadata = { title: 'Edit page' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

export default async function EditPagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  await requireStaff();
  const [{ id }, { notice }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const page = await getPageForEdit(id);
  if (!page) notFound();
  const body = sanitizeDoc(page.body);
  const media = await mediaByIds(bodyMediaIds(body));
  return (
    <PageEditor
      key={page.id}
      page={{ ...page, body }}
      media={[...media.values()]}
      notice={notice === 'delete-failed' ? 'The page could not be deleted. Unpublish it first.' : null}
    />
  );
}
