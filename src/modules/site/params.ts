import 'server-only';
import { createPublicClient } from '@/lib/supabase/clients';

// Sample params for generateStaticParams. With Cache Components a dynamic route needs at least one, and
// having them lets pages await params outside Suspense, so a missing article answers with a real 404 (and
// a moved one with a real 308) instead of a streamed page. Other addresses render on first visit and are
// cached from then on. When the database is still empty, a placeholder stands in.

export const PLACEHOLDER = 'pc-placeholder';

export async function recentArticleParams(limit = 20): Promise<{ section: string; slug: string }[]> {
  const { data, error } = await createPublicClient().rpc('site_list', { p_kind: 'latest', p_limit: limit });
  if (error) throw new Error(`site_list: ${error.message}`);
  const rows = ((data as { rows: { slug: string; section: { slug: string } | null }[] } | null)?.rows ?? []).filter((row) => row.section);
  return rows.length ? rows.map((row) => ({ section: row.section!.slug, slug: row.slug })) : [{ section: PLACEHOLDER, slug: PLACEHOLDER }];
}

export async function sectionParams(): Promise<{ section: string }[]> {
  const { data, error } = await createPublicClient().from('sections').select('slug');
  if (error) throw new Error(`sections: ${error.message}`);
  const rows = (data as { slug: string }[]) ?? [];
  return rows.length ? rows.map((row) => ({ section: row.slug })) : [{ section: PLACEHOLDER }];
}
