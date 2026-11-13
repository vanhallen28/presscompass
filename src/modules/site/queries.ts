import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/clients';
import { TAGS } from './cache';
import type { ArticlePage, Home, ListKind, ListPage, NavSection, Redirect, SearchPage, SitePageData, SitePageLink } from './types';

// Reads for the public site: the publishable key (role anon, Row Level Security) and the site_* SQL
// functions, cached with Cache Components. Readers see changes from the Newsroom straight away because
// the Newsroom drops the tags (src/modules/site/invalidate.ts); otherwise entries refresh hourly.

export const PAGE_SIZE = 24;
export const LATEST_HOURS = 24;

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await createPublicClient().rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

export async function getHome(): Promise<Home> {
  'use cache';
  cacheLife('hours');
  cacheTag(TAGS.site, TAGS.articles, TAGS.taxonomy);
  return rpc<Home>('site_home');
}

/** A page of articles (1-based `page`); null for an unknown section, or an author or tag with nothing published. */
export async function getList(kind: ListKind, slug: string | null, page = 1, limit = PAGE_SIZE): Promise<ListPage | null> {
  'use cache';
  cacheLife('hours');
  cacheTag(TAGS.site, TAGS.articles, TAGS.taxonomy);
  return rpc<ListPage | null>('site_list', { p_kind: kind, p_slug: slug, p_limit: limit, p_offset: (page - 1) * limit });
}

/** Articles published in the last day, for the Latest strip under the navigation. */
export async function getLatestStrip(limit = 3): Promise<ListPage> {
  'use cache';
  cacheLife('hours');
  cacheTag(TAGS.site, TAGS.articles);
  const since = new Date(Date.now() - LATEST_HOURS * 3600_000).toISOString();
  return (await rpc<ListPage | null>('site_list', { p_kind: 'latest', p_limit: limit, p_since: since })) ?? { subject: null, total: 0, rows: [] };
}

export async function getArticle(slug: string): Promise<ArticlePage | null> {
  'use cache';
  cacheLife('hours');
  cacheTag(TAGS.site, TAGS.articles);
  const article = await rpc<ArticlePage | null>('site_article', { p_slug: slug });
  if (article) cacheTag(TAGS.article(article.id));
  return article;
}

export async function search(query: string, page = 1, limit = 20): Promise<SearchPage> {
  'use cache';
  cacheLife('hours');
  cacheTag(TAGS.site, TAGS.articles);
  return rpc<SearchPage>('site_search', { p_query: query, p_limit: limit, p_offset: (page - 1) * limit });
}

/** Sections in navigation order. */
export async function getSections(): Promise<NavSection[]> {
  'use cache';
  cacheLife('hours');
  cacheTag(TAGS.site, TAGS.taxonomy);
  const { data, error } = await createPublicClient().from('sections').select('name,slug,in_nav').order('position').order('name');
  if (error) throw new Error(`sections: ${error.message}`);
  return (data as { name: string; slug: string; in_nav: boolean }[]).map((s) => ({ name: s.name, slug: s.slug, inNav: s.in_nav }));
}

/** Published static pages for the footer, by title. Empty before the Plan 5 migration. */
export async function getPages(): Promise<SitePageLink[]> {
  'use cache';
  cacheLife('hours');
  cacheTag(TAGS.site);
  const { data, error } = await createPublicClient().rpc('site_pages');
  return error ? [] : ((data as SitePageLink[] | null) ?? []);
}

/** One published static page by address, or null. */
export async function getPage(slug: string): Promise<SitePageData | null> {
  'use cache';
  cacheLife('hours');
  cacheTag(TAGS.site);
  return rpc<SitePageData | null>('site_page', { p_slug: slug });
}

/** Where an old address now lives (automatic redirects after an address changed). */
export async function findRedirect(path: string): Promise<Redirect | null> {
  'use cache';
  cacheLife('hours');
  cacheTag(TAGS.site, TAGS.articles, TAGS.taxonomy);
  const { data, error } = await createPublicClient().from('redirects').select('to_path,code').eq('from_path', path).maybeSingle();
  if (error) throw new Error(`redirects: ${error.message}`);
  return data ? { to: (data as { to_path: string }).to_path, code: (data as { code: number }).code } : null;
}

/** Today's date in WIB for the top of every page, e.g. "Friday, 13 November 2026". */
export async function todayLine(): Promise<string> {
  'use cache';
  cacheLife('hours');
  cacheTag(TAGS.site);
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date());
}
