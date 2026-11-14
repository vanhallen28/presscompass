import { shareImageUrl } from '@/lib/media/url';
import { articleHref } from '@/modules/site/format';
import type { ArticlePage, ListSubject } from '@/modules/site/types';
import type { MetaContext } from './metadata';
import { absolute } from './settings';

// Structured data (JSON-LD) after Google's Article guidelines: one Person per author with a URL, ISO dates
// with a time zone, images in 16:9, 4:3 and 1:1, the publisher as a NewsMediaOrganization.

type Json = Record<string, unknown>;

const TYPES: Record<ArticlePage['type'], string> = {
  news: 'NewsArticle',
  opinion: 'OpinionNewsArticle',
  analysis: 'Article',
  explainer: 'Article',
  feature: 'Article',
};

export function organizationId(origin: string) {
  return `${origin}/#organization`;
}

export function organization(ctx: MetaContext): Json {
  const { settings, origin } = ctx;
  return {
    '@type': 'NewsMediaOrganization',
    '@id': organizationId(origin),
    name: settings.siteName,
    url: `${origin}/`,
    logo: { '@type': 'ImageObject', url: `${origin}/brand/logo.png`, width: 512, height: 512 },
    ...(settings.sameAs.length ? { sameAs: settings.sameAs } : {}),
    ...(settings.publishingPrinciples ? { publishingPrinciples: absolute(origin, settings.publishingPrinciples) } : {}),
    ...(settings.correctionsPolicy ? { correctionsPolicy: absolute(origin, settings.correctionsPolicy) } : {}),
  };
}

/** The front page: the website and the organisation behind it. */
export function homeJsonLd(ctx: MetaContext): Json {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${ctx.origin}/#website`,
        name: ctx.settings.siteName,
        url: `${ctx.origin}/`,
        inLanguage: 'en',
        publisher: { '@id': organizationId(ctx.origin) },
      },
      organization(ctx),
    ],
  };
}

export function breadcrumbs(ctx: MetaContext, items: { name: string; path?: string }[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      ...(item.path ? { item: `${ctx.origin}${item.path}` } : {}),
    })),
  };
}

export function articleJsonLd(ctx: MetaContext, article: ArticlePage): Json {
  const url = `${ctx.origin}${articleHref(article)}`;
  const images = article.lead
    ? (['16:9', '4:3', '1:1'] as const).map((shape) => shareImageUrl(ctx.delivery, article.lead!.publicId, shape))
    : undefined;
  return {
    '@context': 'https://schema.org',
    '@type': TYPES[article.type],
    '@id': `${url}#article`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    headline: article.title,
    description: article.seo.description || article.standfirst,
    ...(images ? { image: images } : {}),
    datePublished: article.publishedAt,
    dateModified: article.modifiedAt,
    author: article.authors.map((author) => ({
      '@type': 'Person',
      name: author.name,
      url: `${ctx.origin}/author/${author.slug}`,
      ...(author.role ? { jobTitle: author.role } : {}),
    })),
    publisher: {
      '@type': 'NewsMediaOrganization',
      '@id': organizationId(ctx.origin),
      name: ctx.settings.siteName,
      logo: { '@type': 'ImageObject', url: `${ctx.origin}/brand/logo.png` },
    },
    ...(article.section ? { articleSection: article.section.name } : {}),
    ...(article.tags.length ? { keywords: article.tags.map((tag) => tag.name).join(', ') } : {}),
    inLanguage: 'en',
    isAccessibleForFree: true,
    ...(article.sources.length
      ? {
          citation: article.sources.map((source) => ({
            '@type': 'CreativeWork',
            name: source.title,
            url: source.url,
            ...(source.publisher ? { publisher: { '@type': 'Organization', name: source.publisher } } : {}),
          })),
        }
      : {}),
  };
}

/** An author's page: a ProfilePage about a Person. */
export function profileJsonLd(ctx: MetaContext, slug: string, subject: ListSubject): Json {
  const url = `${ctx.origin}/author/${slug}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url,
    mainEntity: {
      '@type': 'Person',
      '@id': `${url}#person`,
      name: subject.name,
      url,
      ...(subject.role ? { jobTitle: subject.role } : {}),
      ...(subject.bio ? { description: subject.bio } : {}),
      ...(subject.photo ? { image: shareImageUrl(ctx.delivery, subject.photo.publicId, '1:1', 400) } : {}),
      ...(subject.links?.length ? { sameAs: subject.links.map((link) => link.url).filter((link) => /^https:\/\//.test(link)) } : {}),
      worksFor: { '@type': 'NewsMediaOrganization', '@id': organizationId(ctx.origin), name: ctx.settings.siteName },
    },
  };
}

/** JSON for a <script type="application/ld+json">, with "<" escaped so the text cannot close the script. */
export function jsonLdText(data: Json): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
