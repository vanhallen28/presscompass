import 'server-only';
import { siteUrl } from '@/lib/env';
import { delivery, shareHeight, shareImageUrl } from '@/lib/media/url';
import { articleHref } from '@/modules/site/format';
import { getList } from '@/modules/site/queries';
import type { Card } from '@/modules/site/types';
import { getNewsSitemap, getSeoSettings, getSitemap, getSitemapArticles } from './queries';
import { newsSitemap, rss, sitemapIndex, urlset } from './xml';

// The XML files the site serves: sitemap index, one sitemap per month of articles and per kind of page, the
// Google News sitemap, and RSS. Built from the cached site reads, so they refresh with the pages.

export const SITEMAP_KINDS = ['sections', 'authors', 'tags', 'pages'] as const;
const MONTH_FILE = /^articles-(\d{4}-\d{2})\.xml$/;
const FEED_SIZE = 30;

export function xmlResponse(body: string | null, type = 'application/xml'): Response {
  return body === null
    ? new Response('Not found\n', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } })
    : new Response(body, { headers: { 'content-type': `${type}; charset=utf-8` } });
}

/** Names of the files under /sitemaps/ (for generateStaticParams and the index). */
export async function sitemapFiles(): Promise<string[]> {
  const map = await getSitemap();
  return [...map.months.map((m) => `articles-${m.month}.xml`), ...SITEMAP_KINDS.filter((kind) => map[kind].length).map((kind) => `${kind}.xml`)];
}

export async function sitemapIndexXml(): Promise<string> {
  const origin = siteUrl();
  const map = await getSitemap();
  const latest = (rows: { lastmod: string | null }[]) =>
    rows
      .map((r) => r.lastmod)
      .filter((v): v is string => Boolean(v))
      .sort()
      .at(-1) ?? null;
  return sitemapIndex([
    ...map.months.map((m) => ({ loc: `${origin}/sitemaps/articles-${m.month}.xml`, lastmod: m.lastmod })),
    ...SITEMAP_KINDS.filter((kind) => map[kind].length).map((kind) => ({ loc: `${origin}/sitemaps/${kind}.xml`, lastmod: latest(map[kind]) })),
  ]);
}

/** One file under /sitemaps/, or null when there is no such file. */
export async function sitemapFileXml(file: string): Promise<string | null> {
  const origin = siteUrl();
  const month = MONTH_FILE.exec(file)?.[1];
  if (month) {
    const rows = await getSitemapArticles(month);
    if (!rows.length) return null;
    const config = delivery();
    return urlset(
      rows.map((row) => ({
        loc: `${origin}${articleHref(row)}`,
        lastmod: row.lastmod,
        images: row.image && config.cloudName ? [shareImageUrl(config, row.image.publicId, '16:9')] : [],
      })),
    );
  }
  const kind = SITEMAP_KINDS.find((k) => file === `${k}.xml`);
  if (!kind) return null;
  const map = await getSitemap();
  const rows = map[kind];
  if (!rows.length) return null;
  const prefix = kind === 'authors' ? '/author/' : kind === 'tags' ? '/tag/' : '/';
  return urlset(rows.map((row) => ({ loc: `${origin}${prefix}${row.slug}`, lastmod: row.lastmod })));
}

export async function newsSitemapXml(): Promise<string> {
  const origin = siteUrl();
  const [items, settings] = await Promise.all([getNewsSitemap(), getSeoSettings()]);
  return newsSitemap(
    items.map((item) => ({ loc: `${origin}${articleHref(item)}`, title: item.title, publishedAt: item.publishedAt })),
    { name: settings.newsName, language: 'en' },
  );
}

function rssItems(cards: Card[], origin: string) {
  const config = delivery();
  return cards.map((card) => ({
    title: card.title,
    link: `${origin}${articleHref(card)}`,
    description: card.standfirst,
    publishedAt: card.publishedAt,
    authors: card.authors.map((author) => author.name),
    category: card.section?.name,
    image:
      card.lead && config.cloudName
        ? { url: shareImageUrl(config, card.lead.publicId, '16:9'), width: 1200, height: shareHeight('16:9') }
        : undefined,
  }));
}

/** RSS for the whole site, or for one section (null when the section does not exist). */
export async function feedXml(section: string | null): Promise<string | null> {
  const origin = siteUrl();
  const [settings, list] = await Promise.all([
    getSeoSettings(),
    section ? getList('section', section, 1, FEED_SIZE) : getList('latest', null, 1, FEED_SIZE),
  ]);
  if (!list || (section && !list.subject)) return null;
  const path = section ? `/${section}` : '';
  return rss({
    title: section && list.subject ? `${list.subject.name} · ${settings.siteName}` : settings.siteName,
    link: `${origin}${path || '/'}`,
    description: (section && list.subject?.description) || settings.description,
    self: `${origin}${path}/feed.xml`,
    items: rssItems(list.rows, origin),
  });
}
