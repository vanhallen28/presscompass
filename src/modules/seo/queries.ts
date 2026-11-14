import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { createPublicClient, createSessionClient } from '@/lib/supabase/clients';
import type { Card, SiteImage } from '@/modules/site/types';
import { TAGS } from '@/modules/site/cache';
import { readSeoSettings, type SeoSettings } from './settings';

// SEO reads. The site reads the site_* functions (cached, tags `site`, `articles`, `taxonomy`); the Newsroom
// reads with the owner's session.

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await createPublicClient().rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

/** The published SEO settings, with defaults. Falls back to the defaults when the migration is missing. */
export async function getSeoSettings(): Promise<SeoSettings> {
  'use cache';
  cacheLife('hours');
  cacheTag(TAGS.site);
  const { data, error } = await createPublicClient().rpc('site_seo');
  return readSeoSettings(error ? {} : data);
}

export type SitemapIndex = {
  months: { month: string; lastmod: string }[];
  sections: { slug: string; lastmod: string | null }[];
  authors: { slug: string; lastmod: string }[];
  tags: { slug: string; lastmod: string }[];
  pages: { slug: string; lastmod: string }[];
  lastmod: string | null;
};

export async function getSitemap(): Promise<SitemapIndex> {
  'use cache';
  cacheLife('hours');
  cacheTag(TAGS.site, TAGS.articles, TAGS.taxonomy);
  return rpc<SitemapIndex>('site_sitemap');
}

export type SitemapArticle = { slug: string; section: string; lastmod: string; image: SiteImage | null };

export async function getSitemapArticles(month: string): Promise<SitemapArticle[]> {
  'use cache';
  cacheLife('hours');
  cacheTag(TAGS.site, TAGS.articles, TAGS.taxonomy);
  return rpc<SitemapArticle[]>('site_sitemap_articles', { p_month: month });
}

export type NewsSitemapItem = { slug: string; section: string; title: string; publishedAt: string };

export async function getNewsSitemap(): Promise<NewsSitemapItem[]> {
  'use cache';
  cacheLife('hours');
  cacheTag(TAGS.site, TAGS.articles, TAGS.taxonomy);
  return rpc<NewsSitemapItem[]>('site_news_sitemap');
}

// ---------------------------------------------------------------- Newsroom

/** The settings as stored (draft column, which Save keeps equal to the published one). */
export async function getSeoSettingsForEdit(): Promise<SeoSettings> {
  const supabase = await createSessionClient();
  const { data, error } = await supabase.from('layouts').select('draft').eq('key', 'seo').maybeSingle<{ draft: unknown }>();
  if (error) throw new Error(error.message);
  return readSeoSettings(data?.draft);
}

export type Redirect = { id: string; from_path: string; to_path: string; code: 301 | 308 | 410; auto: boolean; hits: number; created_at: string };

export async function listRedirects(): Promise<Redirect[]> {
  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from('redirects')
    .select('id,from_path,to_path,code,auto,hits,created_at')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as Redirect[];
}

export type NotFoundRow = { path: string; hits: number; referrer: string; first_seen: string; last_seen: string };

export async function listNotFound(): Promise<NotFoundRow[]> {
  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from('not_found_log')
    .select('path,hits,referrer,first_seen,last_seen')
    .order('last_seen', { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as NotFoundRow[];
}

/** One published article as a card (site_card), for its social image. Null when it is not published. */
export async function getCard(id: string): Promise<Card | null> {
  'use cache';
  cacheLife('hours');
  cacheTag(TAGS.site, TAGS.articles, TAGS.article(id));
  return rpc<Card | null>('site_card', { p_id: id });
}
