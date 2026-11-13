'use server';

import { redirect } from 'next/navigation';
import { UUID } from '@/lib/doc/schema';
import { createSessionClient } from '@/lib/supabase/clients';
import { requireStaff } from '@/modules/auth/staff';
import { refreshSite } from '@/modules/site/invalidate';
import { bodyBlocks, type PageErrors, parsePageInput } from './validate';

// Server Actions for static pages. Each one checks the session itself.

export type PageSaveResult =
  | { ok: true; status: 'draft' | 'published'; publishedAt: string | null; updatedAt: string; message: string }
  | { ok: false; errors: PageErrors; message: string };

const UNEXPECTED: PageSaveResult = { ok: false, errors: {}, message: 'The editor sent something unexpected. Reload the page and try again.' };

export async function createPage() {
  await requireStaff();
  const supabase = await createSessionClient();
  const slug = `new-page-${Date.now().toString(36)}`;
  const { data, error } = await supabase.from('pages').insert({ title: '', slug, blocks: [] }).select('id').single();
  if (error || !data) redirect('/newsroom/pages?notice=failed');
  redirect(`/newsroom/pages/${data.id}`);
}

export async function savePage(raw: unknown): Promise<PageSaveResult> {
  await requireStaff();
  const parsed = parsePageInput(raw);
  if (!parsed.ok) return UNEXPECTED;
  const { value, errors } = parsed;
  if (Object.keys(errors).length) return { ok: false, errors, message: 'Check the fields marked below.' };
  const supabase = await createSessionClient();

  const { data: section } = await supabase.from('sections').select('id').eq('slug', value.slug).maybeSingle();
  if (section)
    return { ok: false, errors: { slug: 'A section already uses this address. Choose another.' }, message: 'Check the fields marked below.' };
  const { data: current } = await supabase
    .from('pages')
    .select('status,published_at')
    .eq('id', value.id)
    .maybeSingle<{ status: string; published_at: string | null }>();
  if (!current) return { ok: false, errors: {}, message: 'This page no longer exists.' };

  const publish = value.intent === 'publish' || (value.intent === 'save' && current.status === 'published');
  const row = {
    title: value.title,
    slug: value.slug,
    seo: { description: value.description },
    blocks: bodyBlocks(value.body),
    status: publish ? 'published' : 'draft',
    published_at: publish ? (current.published_at ?? new Date().toISOString()) : null,
  };
  const { data, error } = await supabase.from('pages').update(row).eq('id', value.id).select('status,published_at,updated_at').single();
  if (error?.code === '23505')
    return { ok: false, errors: { slug: 'Another page already uses this address.' }, message: 'Check the fields marked below.' };
  if (error || !data) return { ok: false, errors: {}, message: `The page could not be saved. ${error?.message ?? ''}`.trim() };
  refreshSite();
  const message =
    value.intent === 'publish'
      ? 'Page published.'
      : value.intent === 'unpublish'
        ? 'Page unpublished. Readers no longer see it.'
        : publish
          ? 'Page updated.'
          : 'Draft saved.';
  return { ok: true, status: data.status, publishedAt: data.published_at, updatedAt: data.updated_at, message };
}

export async function deletePage(form: FormData) {
  await requireStaff();
  const id = form.get('id');
  if (typeof id !== 'string' || !UUID.test(id)) redirect('/newsroom/pages');
  const supabase = await createSessionClient();
  const { data, error } = await supabase.from('pages').delete().eq('id', id).eq('status', 'draft').select('id');
  if (error || !data?.length) redirect(`/newsroom/pages/${id}?notice=delete-failed`);
  redirect('/newsroom/pages?notice=deleted');
}
