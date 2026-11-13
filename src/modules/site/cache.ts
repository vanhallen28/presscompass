// Cache tags for the public site. Every cached read carries `site`; lists and slug lookups carry `articles`;
// an article page carries `article:{id}`; sections, authors, tags and the navigation carry `taxonomy`.
// src/modules/site/invalidate.ts drops them when the Newsroom changes something readers can see.

export const TAGS = {
  site: 'site',
  articles: 'articles',
  taxonomy: 'taxonomy',
  article: (id: string) => `article:${id}`,
} as const;
