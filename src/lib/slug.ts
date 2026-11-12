// Addresses (slugs) for articles, sections, tags and authors. The database checks the same pattern.

export const SLUG_MAX = 80;
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Words the site uses for its own routes, so sections and pages cannot take them. */
export const RESERVED_SLUGS = ['page', 'author', 'tag', 'search', 'newsletter', 'newsroom', 'api', 'feed', 'sitemaps'] as const;

export function slugify(text: string, max = SLUG_MAX): string {
  const slug = text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length <= max) return slug;
  const cut = slug.slice(0, max);
  const hyphen = cut.lastIndexOf('-');
  return (hyphen > max / 2 ? cut.slice(0, hyphen) : cut).replace(/-+$/, '');
}

export function isSlug(value: string): boolean {
  return value.length <= SLUG_MAX && SLUG_PATTERN.test(value);
}
