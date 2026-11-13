import 'server-only';
import type { Doc } from '@/lib/doc/schema';
import { createSessionClient } from '@/lib/supabase/clients';
import type { ArticleType, Source } from './input';
import type { ArticleStatus } from './status';

// Reads for the Articles list, the editor, history and preview (Newsroom session, RLS applies).

export const PAGE_SIZE = 25;

export type ArticleListRow = {
  id: string;
  title: string;
  slug: string;
  status: ArticleStatus;
  type: ArticleType;
  is_breaking: boolean;
  word_count: number;
  updated_at: string;
  published_at: string | null;
  scheduled_at: string | null;
  section: { id: string; name: string; slug: string } | null;
  authors: string[];
};

export type ArticleFilter = { status?: ArticleStatus; q?: string; section?: string; author?: string; page?: number; limit?: number };

export type EditableArticle = {
  id: string;
  version: number;
  title: string;
  slug: string;
  section_id: string | null;
  type: ArticleType;
  kicker_label: string;
  standfirst: string;
  body: Doc;
  lead_media_id: string | null;
  lead_caption: string;
  status: ArticleStatus;
  published_at: string | null;
  scheduled_at: string | null;
  major_update_at: string | null;
  is_breaking: boolean;
  sources: Source[];
  word_count: number;
  updated_at: string;
  authorIds: string[];
  tagIds: string[];
  related: { id: string; title: string; status: ArticleStatus }[];
};

export type Revision = { id: number; note: string; created_at: string };
export type RevisionSnapshot = Revision & {
  snapshot: Partial<Omit<EditableArticle, 'related' | 'authorIds' | 'tagIds'>> & { authors?: string[]; tags?: string[]; related?: string[] };
};

function check<T>({ data, error }: { data: unknown; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

export async function listArticles(filter: ArticleFilter = {}): Promise<{ total: number; rows: ArticleListRow[] }> {
  const supabase = await createSessionClient();
  const limit = filter.limit ?? PAGE_SIZE;
  return check(
    await supabase.rpc('newsroom_articles', {
      p_status: filter.status ?? null,
      p_query: filter.q || null,
      p_section: filter.section ?? null,
      p_author: filter.author ?? null,
      p_limit: limit,
      p_offset: Math.max(0, (filter.page ?? 1) - 1) * limit,
    }),
  );
}

export async function statusCounts(): Promise<Partial<Record<ArticleStatus, number>>> {
  const supabase = await createSessionClient();
  return check(await supabase.rpc('article_status_counts'));
}

/** Publishes scheduled articles whose time has passed. Never blocks a page: failures are logged. */
export async function publishDue(): Promise<number> {
  try {
    const supabase = await createSessionClient();
    const { data, error } = await supabase.rpc('publish_due_articles');
    if (error) throw new Error(error.message);
    return Number(data ?? 0);
  } catch (error) {
    console.error('Scheduled publishing check failed:', (error as Error).message);
    return 0;
  }
}

export async function getArticle(id: string): Promise<EditableArticle | null> {
  const supabase = await createSessionClient();
  const article = check<Omit<EditableArticle, 'authorIds' | 'tagIds' | 'related'> | null>(
    await supabase
      .from('articles')
      .select(
        'id,version,title,slug,section_id,type,kicker_label,standfirst,body,lead_media_id,lead_caption,status,published_at,scheduled_at,major_update_at,is_breaking,sources,word_count,updated_at',
      )
      .eq('id', id)
      .maybeSingle(),
  );
  if (!article) return null;
  const [authors, tags, related] = await Promise.all([
    supabase.from('article_authors').select('author_id,position').eq('article_id', id).order('position'),
    supabase.from('article_tags').select('tag_id').eq('article_id', id),
    supabase.from('article_related').select('related_id,position').eq('article_id', id).order('position'),
  ]);
  const relatedIds = check<{ related_id: string }[]>(related).map((row) => row.related_id);
  let relatedArticles: { id: string; title: string; status: ArticleStatus }[] = [];
  if (relatedIds.length) {
    const rows = check<{ id: string; title: string; status: ArticleStatus }[]>(
      await supabase.from('articles').select('id,title,status').in('id', relatedIds),
    );
    relatedArticles = relatedIds.map((rid) => rows.find((row) => row.id === rid)).filter((row) => row !== undefined);
  }
  return {
    ...article,
    authorIds: check<{ author_id: string }[]>(authors).map((row) => row.author_id),
    tagIds: check<{ tag_id: string }[]>(tags).map((row) => row.tag_id),
    related: relatedArticles,
  };
}

export async function listRevisions(articleId: string): Promise<Revision[]> {
  const supabase = await createSessionClient();
  return check(await supabase.from('article_revisions').select('id,note,created_at').eq('article_id', articleId).order('id', { ascending: false }));
}

export async function getRevision(articleId: string, revisionId: number): Promise<RevisionSnapshot | null> {
  const supabase = await createSessionClient();
  return check(
    await supabase.from('article_revisions').select('id,note,created_at,snapshot').eq('article_id', articleId).eq('id', revisionId).maybeSingle(),
  );
}

export type Dashboard = {
  published_today: number;
  review: number;
  scheduled: number;
  drafts: number;
  next_scheduled_at: string | null;
};

export async function getDashboard(dayStart: Date): Promise<Dashboard> {
  const supabase = await createSessionClient();
  return check(await supabase.rpc('newsroom_dashboard', { p_day_start: dayStart.toISOString() }));
}

/** Titles and addresses of articles linked from a body (Read more cards) or chosen as related. */
export async function articleLinks(ids: string[]): Promise<Map<string, { title: string; href: string; status: ArticleStatus }>> {
  const links = new Map<string, { title: string; href: string; status: ArticleStatus }>();
  if (!ids.length) return links;
  const supabase = await createSessionClient();
  const rows = check<{ id: string; title: string; slug: string; status: ArticleStatus; section_id: string | null }[]>(
    await supabase.from('articles').select('id,title,slug,status,section_id').in('id', ids),
  );
  const sectionIds = [...new Set(rows.map((row) => row.section_id).filter((id) => id !== null))];
  const sections = sectionIds.length
    ? check<{ id: string; slug: string }[]>(await supabase.from('sections').select('id,slug').in('id', sectionIds))
    : [];
  for (const row of rows) {
    const section = sections.find((s) => s.id === row.section_id);
    links.set(row.id, { title: row.title || 'Untitled', href: section ? `/${section.slug}/${row.slug}` : `/${row.slug}`, status: row.status });
  }
  return links;
}
