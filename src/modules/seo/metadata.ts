import type { Metadata } from 'next';
import { type Delivery, shareHeight, shareImageUrl } from '@/lib/media/url';
import { articleHref } from '@/modules/site/format';
import type { ArticlePage, ListSubject } from '@/modules/site/types';
import { applyTemplate } from './snippet';
import type { SeoSettings } from './settings';

// Next.js metadata for the public pages: titles from the SEO settings pattern, descriptions, canonical
// addresses, robots (with max-image-preview:large for Discover), Open Graph and X cards. Pure: the routes pass
// in the settings, the site origin and whether this is the live site.

export type MetaContext = { settings: SeoSettings; origin: string; production: boolean; delivery: Delivery };

const LOCALE = 'en_GB';

/** Indexable only on the live site, with indexing turned on in SEO settings, and when the page itself allows it. */
export function robots(ctx: MetaContext, noindex = false): NonNullable<Metadata['robots']> {
  if (!ctx.production || !ctx.settings.indexing || noindex) return { index: false, follow: ctx.production && ctx.settings.indexing };
  return {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
  };
}

/** Shared by every public page: the title pattern, the default description, RSS discovery, card defaults. */
export function siteMetadata(ctx: MetaContext): Metadata {
  return {
    title: { default: ctx.settings.homeTitle, template: ctx.settings.titleTemplate },
    description: ctx.settings.description,
    robots: robots(ctx),
    alternates: { types: { 'application/rss+xml': [{ url: '/feed.xml', title: ctx.settings.siteName }] } },
    openGraph: { siteName: ctx.settings.siteName, locale: LOCALE, type: 'website' },
    twitter: { card: 'summary_large_image' },
  };
}

export function homeMetadata(ctx: MetaContext): Metadata {
  return {
    title: { absolute: ctx.settings.homeTitle },
    description: ctx.settings.description,
    alternates: { canonical: '/', types: { 'application/rss+xml': [{ url: '/feed.xml', title: ctx.settings.siteName }] } },
    openGraph: {
      title: ctx.settings.homeTitle,
      description: ctx.settings.description,
      url: '/',
      siteName: ctx.settings.siteName,
      locale: LOCALE,
      type: 'website',
    },
  };
}

/** Sections, authors, tags, static pages and their later pages (each page is its own canonical). */
export function listMetadata(
  ctx: MetaContext,
  {
    title,
    description,
    path,
    page = 1,
    feed,
    profile,
  }: { title: string; description?: string; path: string; page?: number; feed?: string; profile?: boolean },
): Metadata {
  const full = page > 1 ? `${title}, page ${page}` : title;
  const canonical = page > 1 ? `${path}/page/${page}` : path;
  const text = description?.trim() || ctx.settings.description;
  return {
    title: full,
    description: text,
    alternates: { canonical, ...(feed ? { types: { 'application/rss+xml': [{ url: feed, title: `${title} · ${ctx.settings.siteName}` }] } } : {}) },
    openGraph: {
      title: applyTemplate(ctx.settings.titleTemplate, full),
      description: text,
      url: canonical,
      siteName: ctx.settings.siteName,
      locale: LOCALE,
      type: profile ? 'profile' : 'website',
    },
    twitter: { card: 'summary_large_image', title: applyTemplate(ctx.settings.titleTemplate, full), description: text },
  };
}

/** Social card image: the editor's choice cropped to 1.91:1, or the automatic card. */
export function socialImage(ctx: MetaContext, article: Pick<ArticlePage, 'id' | 'ogImage' | 'modifiedAt' | 'title' | 'lead'>) {
  if (article.ogImage) {
    return {
      url: shareImageUrl(ctx.delivery, article.ogImage.publicId, '1.91:1'),
      width: 1200,
      height: shareHeight('1.91:1'),
      alt: article.ogImage.alt || article.title,
    };
  }
  const version = Math.floor(new Date(article.modifiedAt).getTime() / 1000);
  return { url: `/og/${article.id}?v=${version}`, width: 1200, height: 630, alt: article.lead?.alt || article.title };
}

export function articleMetadata(ctx: MetaContext, article: ArticlePage): Metadata {
  const path = articleHref(article);
  const title = article.seo.title || article.title;
  const description = article.seo.description || article.standfirst || ctx.settings.description;
  const image = socialImage(ctx, article);
  const shared = applyTemplate(ctx.settings.titleTemplate, title);
  return {
    title,
    description,
    robots: robots(ctx, article.seo.noindex),
    alternates: { canonical: article.seo.canonical || path, types: { 'application/rss+xml': [{ url: '/feed.xml', title: ctx.settings.siteName }] } },
    authors: article.authors.map((author) => ({ name: author.name, url: `/author/${author.slug}` })),
    openGraph: {
      type: 'article',
      title: shared,
      description,
      url: path,
      siteName: ctx.settings.siteName,
      locale: LOCALE,
      images: [image],
      publishedTime: article.publishedAt,
      modifiedTime: article.modifiedAt,
      section: article.section?.name,
      tags: article.tags.map((tag) => tag.name),
      authors: article.authors.map((author) => `${ctx.origin}/author/${author.slug}`),
    },
    twitter: { card: 'summary_large_image', title: shared, description, images: [image] },
  };
}

/** Description for an author or tag page from its subject. */
export function subjectDescription(subject: ListSubject | null | undefined): string | undefined {
  const text = subject?.bio || subject?.description || '';
  return text ? text.replace(/\s+/g, ' ').trim().slice(0, 300) : undefined;
}
