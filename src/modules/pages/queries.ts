import 'server-only';
import type { Doc } from '@/lib/doc/schema';
import { createSessionClient } from '@/lib/supabase/clients';

// Newsroom reads for static pages (owner's session; RLS lets staff see drafts).

export type PageRow = {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published';
  description: string;
  body: Doc;
  publishedAt: string | null;
  updatedAt: string;
};

type DbRow = {
  id: string;
  title: string;
  slug: string;
  status: PageRow['status'];
  seo: { description?: string } | null;
  blocks: unknown;
  published_at: string | null;
  updated_at: string;
};

function toPage(row: DbRow): PageRow {
  const text = Array.isArray(row.blocks) ? (row.blocks as { type?: string; body?: Doc }[]).find((block) => block?.type === 'text') : undefined;
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    description: row.seo?.description ?? '',
    body: text?.body ?? { type: 'doc', content: [] },
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
  };
}

export async function listPages(): Promise<PageRow[]> {
  const supabase = await createSessionClient();
  const { data, error } = await supabase.from('pages').select('id,title,slug,status,seo,blocks,published_at,updated_at').order('title');
  if (error) throw new Error(`pages: ${error.message}`);
  return (data as DbRow[]).map(toPage);
}

export async function getPageForEdit(id: string): Promise<PageRow | null> {
  const supabase = await createSessionClient();
  const { data, error } = await supabase.from('pages').select('id,title,slug,status,seo,blocks,published_at,updated_at').eq('id', id).maybeSingle();
  if (error) throw new Error(`pages: ${error.message}`);
  return data ? toPage(data as DbRow) : null;
}
