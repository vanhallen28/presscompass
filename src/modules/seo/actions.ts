'use server';

import { redirect } from 'next/navigation';
import { UUID } from '@/lib/doc/schema';
import { siteUrl } from '@/lib/env';
import { createSessionClient } from '@/lib/supabase/clients';
import { requireStaff } from '@/modules/auth/staff';
import { refreshSite } from '@/modules/site/invalidate';
import { parseRedirect, type RedirectErrors, type RedirectInput } from './redirects';
import { parseSeoSettings, type SeoSettings, type SeoSettingsErrors } from './settings';

// Server Actions for the SEO pages and the editor's SEO panel. Each one checks the session itself.

export type SeoLookup = {
  keyphrase: { id: string; title: string; status: string }[];
  title: { id: string; title: string; status: string }[];
  suggestions: { id: string; title: string; path: string }[];
};

const EMPTY_LOOKUP: SeoLookup = { keyphrase: [], title: [], suggestions: [] };

/** Other articles with the same keyphrase or SEO title, and published articles worth linking to. */
export async function seoLookup(input: {
  articleId: string;
  keyphrase: string;
  title: string;
  sectionId: string | null;
  tagIds: string[];
  linkedIds: string[];
}): Promise<SeoLookup> {
  await requireStaff();
  const ids = [input.articleId, input.sectionId, ...input.tagIds, ...input.linkedIds].filter((id) => id !== null);
  if (!ids.every((id) => typeof id === 'string' && UUID.test(id)) || input.tagIds.length > 30 || input.linkedIds.length > 60) return EMPTY_LOOKUP;
  const supabase = await createSessionClient();
  const { data, error } = await supabase.rpc('article_seo_lookup', {
    p_id: input.articleId,
    p_keyphrase: String(input.keyphrase ?? '').slice(0, 100),
    p_title: String(input.title ?? '').slice(0, 300),
    p_section: input.sectionId,
    p_tags: input.tagIds,
    p_exclude: input.linkedIds,
  });
  if (error || !data) return EMPTY_LOOKUP;
  return { ...EMPTY_LOOKUP, ...(data as SeoLookup) };
}

export type SeoSettingsState = { errors: SeoSettingsErrors; values?: SeoSettings; message?: string };

export async function saveSeoSettings(_prev: SeoSettingsState, form: FormData): Promise<SeoSettingsState> {
  await requireStaff();
  const parsed = parseSeoSettings(form);
  if (!parsed.ok) return { errors: parsed.errors, values: parsed.value, message: 'Check the fields marked below.' };
  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from('layouts')
    .update({ draft: parsed.value, published: parsed.value, published_at: new Date().toISOString() })
    .eq('key', 'seo')
    .select('key');
  if (error || !data?.length) return { errors: {}, values: parsed.value, message: `The settings could not be saved. ${error?.message ?? ''}`.trim() };
  refreshSite();
  redirect('/newsroom/seo?notice=updated');
}

export type RedirectState = { errors: RedirectErrors; values?: RedirectInput; message?: string };

export async function saveRedirect(_prev: RedirectState, form: FormData): Promise<RedirectState> {
  await requireStaff();
  const parsed = parseRedirect(form, new URL(siteUrl()).hostname);
  if (!parsed.ok) return { errors: parsed.errors, values: parsed.value, message: 'Check the fields marked below.' };
  const supabase = await createSessionClient();
  const { error } = await supabase
    .from('redirects')
    .upsert({ from_path: parsed.value.from, to_path: parsed.value.to, code: parsed.value.code, auto: false }, { onConflict: 'from_path' });
  if (error) return { errors: {}, values: parsed.value, message: `The redirect could not be saved. ${error.message}` };
  await supabase.from('not_found_log').delete().eq('path', parsed.value.from);
  refreshSite();
  redirect('/newsroom/seo/redirects?notice=saved');
}

export async function deleteRedirect(form: FormData) {
  await requireStaff();
  const id = String(form.get('id') ?? '');
  if (UUID.test(id)) {
    const supabase = await createSessionClient();
    await supabase.from('redirects').delete().eq('id', id);
    refreshSite();
  }
  redirect('/newsroom/seo/redirects?notice=deleted');
}

export async function dismissNotFound(form: FormData) {
  await requireStaff();
  const supabase = await createSessionClient();
  if (form.get('all') === '1') await supabase.from('not_found_log').delete().neq('path', '');
  else
    await supabase
      .from('not_found_log')
      .delete()
      .eq('path', String(form.get('path') ?? ''));
  redirect('/newsroom/seo/not-found?notice=dismissed');
}
