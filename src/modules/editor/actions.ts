'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { UUID } from '@/lib/doc/schema';
import { sanitizeDoc } from '@/lib/doc/sanitize';
import { docText, readingMinutes, wordCount } from '@/lib/doc/text';
import { createSessionClient } from '@/lib/supabase/clients';
import { formatWib } from '@/lib/time';
import { requireStaff } from '@/modules/auth/staff';
import { type FieldErrors, parseArticleInput } from './input';
import { type ArticleListRow, getRevision, listArticles } from './queries';
import { publishProblems } from './rules';
import { prepareSave } from './save';
import type { ArticleStatus, Intent } from './status';

// Server Actions for articles. Each checks the session; the database checks it again (RLS + is_staff).

const INTENTS: Intent[] = ['autosave', 'save', 'review', 'draft', 'publish', 'schedule', 'update', 'unschedule', 'unpublish', 'archive', 'restore'];
const MAX_REQUEST = 1_000_000;

export type SaveResult =
  | {
      ok: true;
      version: number;
      slug: string;
      status: ArticleStatus;
      publishedAt: string | null;
      scheduledAt: string | null;
      savedAt: string;
    }
  | { ok: false; errors?: FieldErrors; conflict?: boolean; message?: string };

/** Creates an empty draft and opens it in the editor. A form action, so a link prefetch never creates drafts. */
export async function createArticle() {
  await requireStaff();
  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from('articles')
    .insert({ title: '', slug: `untitled-${crypto.randomUUID().slice(0, 8)}` })
    .select('id')
    .single();
  if (error || !data) throw new Error(`The article could not be created. ${error?.message ?? ''}`);
  redirect(`/newsroom/articles/${(data as { id: string }).id}`);
}

export async function saveArticle(raw: unknown, intent: Intent): Promise<SaveResult> {
  await requireStaff();
  if (!INTENTS.includes(intent)) return { ok: false, message: 'Unknown action.' };
  if (JSON.stringify(raw ?? null).length > MAX_REQUEST) {
    return { ok: false, message: 'This article is too long to save in one go. Split it into two articles.' };
  }
  const input = parseArticleInput(raw);
  if (!input.ok) return { ok: false, message: input.error };

  const supabase = await createSessionClient();
  const { data: current, error: readError } = await supabase
    .from('articles')
    .select('status,published_at,scheduled_at')
    .eq('id', input.value.id)
    .maybeSingle();
  if (readError) return { ok: false, message: `The article could not be saved. ${readError.message}` };
  if (!current) return { ok: false, message: 'This article no longer exists.' };

  const plan = prepareSave({ input, current: current as { status: ArticleStatus; published_at: string | null; scheduled_at: string | null }, intent, now: new Date() });
  if (!plan.ok) return { ok: false, errors: plan.errors };

  const { data, error } = await supabase.rpc('save_article', {
    p_id: input.value.id,
    p_version: input.value.version,
    p_fields: plan.fields,
    p_authors: plan.authors,
    p_tags: plan.tags,
    p_related: plan.related,
    p_revision: intent === 'autosave' ? 'Autosaved' : plan.revision,
    p_throttle: plan.throttle,
  });
  if (error) {
    if (error.message.includes('version_conflict')) return { ok: false, conflict: true };
    if (error.message.includes('slug_taken') || error.code === '23505') {
      return { ok: false, errors: { slug: 'Another article already uses this address. Change it, for example by adding a keyword.' } };
    }
    return { ok: false, message: `The article could not be saved. ${error.message}` };
  }
  const saved = data as { version: number; slug: string; status: ArticleStatus; published_at: string | null; scheduled_at: string | null; updated_at: string };
  return {
    ok: true,
    version: saved.version,
    slug: saved.slug,
    status: saved.status,
    publishedAt: saved.published_at,
    scheduledAt: saved.scheduled_at,
    savedAt: saved.updated_at,
  };
}

/** Deletes an article that is not published. Published articles must be unpublished or archived first. */
export async function deleteArticle(form: FormData) {
  await requireStaff();
  const id = String(form.get('id') ?? '');
  if (!UUID.test(id)) redirect('/newsroom/articles');
  const supabase = await createSessionClient();
  const { data, error } = await supabase.from('articles').delete().eq('id', id).neq('status', 'published').select('id');
  if (error || !(data as unknown[] | null)?.length) redirect(`/newsroom/articles/${id}?notice=delete-failed`);
  redirect('/newsroom/articles?notice=deleted');
}

export type BulkState = { tone?: 'success' | 'error'; message?: string; problems?: { title: string; reasons: string[] }[] };

const BULK = ['publish', 'unpublish', 'archive', 'delete'] as const;
type BulkAction = (typeof BULK)[number];
const PAST: Record<BulkAction, string> = { publish: 'published', unpublish: 'unpublished', archive: 'archived', delete: 'deleted' };
const count = (n: number) => (n === 1 ? '1 article' : `${n} articles`);

export async function bulkArticles(_prev: BulkState, form: FormData): Promise<BulkState> {
  await requireStaff();
  const action = form.get('action') as BulkAction;
  const ids = form.getAll('ids').map(String).filter((id) => UUID.test(id));
  if (!BULK.includes(action)) return { tone: 'error', message: 'Choose what to do with the selected articles.' };
  if (!ids.length) return { tone: 'error', message: 'Select at least one article first.' };
  const supabase = await createSessionClient();

  if (action === 'delete') {
    const { data, error } = await supabase.from('articles').delete().in('id', ids).neq('status', 'published').select('id');
    if (error) return { tone: 'error', message: `Nothing was deleted. ${error.message}` };
    const deleted = (data as unknown[]).length;
    refresh();
    const skipped = ids.length - deleted;
    return {
      tone: 'success',
      message: `${count(deleted)} deleted.${skipped ? ` ${count(skipped)} skipped: published articles must be unpublished or archived first.` : ''}`,
    };
  }

  let ready = ids;
  const problems: { title: string; reasons: string[] }[] = [];
  if (action === 'publish') {
    const [{ data: rows }, { data: bylines }] = await Promise.all([
      supabase.from('articles').select('id,title,slug,section_id,standfirst,word_count,status').in('id', ids),
      supabase.from('article_authors').select('article_id,author_id').in('article_id', ids),
    ]);
    ready = [];
    for (const row of (rows ?? []) as { id: string; title: string; slug: string; section_id: string | null; standfirst: string; word_count: number }[]) {
      const found = publishProblems({
        title: row.title,
        slug: row.slug,
        sectionId: row.section_id,
        authorIds: ((bylines ?? []) as { article_id: string; author_id: string }[]).filter((b) => b.article_id === row.id).map((b) => b.author_id),
        standfirst: row.standfirst,
        wordCount: row.word_count,
      });
      if (Object.keys(found).length) problems.push({ title: row.title || 'Untitled', reasons: Object.values(found) as string[] });
      else ready.push(row.id);
    }
  }

  let moved = 0;
  if (ready.length) {
    const { data, error } = await supabase.rpc('set_article_status', { p_ids: ready, p_action: action });
    if (error) return { tone: 'error', message: `Nothing changed. ${error.message}` };
    moved = Number(data ?? 0);
  }
  refresh();
  return {
    tone: problems.length ? 'error' : 'success',
    message: `${count(moved)} ${PAST[action]}.${problems.length ? ` ${problems.length === 1 ? '1 article needs' : `${problems.length} articles need`} work before publishing:` : ''}`,
    problems,
  };
}

/** Puts a stored version back into the article. The current state is kept in history first. */
export async function restoreRevision(form: FormData) {
  await requireStaff();
  const articleId = String(form.get('articleId') ?? '');
  const revisionId = Number(form.get('revisionId'));
  if (!UUID.test(articleId) || !Number.isInteger(revisionId)) redirect('/newsroom/articles');
  const revision = await getRevision(articleId, revisionId);
  if (!revision) redirect(`/newsroom/articles/${articleId}/history?notice=missing`);
  const supabase = await createSessionClient();
  const { data: current } = await supabase.from('articles').select('version').eq('id', articleId).maybeSingle();
  if (!current) redirect('/newsroom/articles');

  await supabase.rpc('record_revision', { p_id: articleId, p_note: 'Before restore' });
  const snap = revision.snapshot;
  const fields: Record<string, unknown> = {};
  for (const key of ['title', 'standfirst', 'body', 'type', 'kicker_label', 'is_breaking', 'sources', 'section_id', 'lead_media_id', 'lead_caption'] as const) {
    if (key in snap) fields[key] = (snap as Record<string, unknown>)[key];
  }
  const body = sanitizeDoc(snap.body);
  const text = docText(body);
  Object.assign(fields, { body, body_text: text, word_count: wordCount(text), reading_minutes: readingMinutes(wordCount(text)) });
  const { error } = await supabase.rpc('save_article', {
    p_id: articleId,
    p_version: (current as { version: number }).version,
    p_fields: fields,
    p_authors: snap.authors ?? null,
    p_tags: snap.tags ?? null,
    p_related: snap.related ?? null,
    p_revision: `Restored the version from ${formatWib(revision.created_at)} WIB`,
  });
  if (error) redirect(`/newsroom/articles/${articleId}/history?notice=restore-failed`);
  redirect(`/newsroom/articles/${articleId}?notice=restored`);
}

/** Articles for the Related and Read more pickers. */
export async function findArticles(query: string, excludeId: string): Promise<Pick<ArticleListRow, 'id' | 'title' | 'status' | 'section'>[]> {
  await requireStaff();
  const { rows } = await listArticles({ q: query.slice(0, 100), limit: 8 });
  return rows.filter((row) => row.id !== excludeId).map(({ id, title, status, section }) => ({ id, title, status, section }));
}
