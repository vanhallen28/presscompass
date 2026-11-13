import { UUID } from '@/lib/doc/schema';
import { isSlug, RESERVED_SLUGS, slugify } from '@/lib/slug';

// Checks the Section, Tag and Author forms. Empty addresses are filled in from the name.

export type Errors = Partial<Record<string, string>>;
export type SectionValues = { name: string; slug: string; description: string; inNav: boolean };
export type TagValues = { name: string; slug: string; description: string };
export type AuthorLink = { label: string; url: string };
export type AuthorValues = { name: string; slug: string; role: string; bio: string; links: AuthorLink[]; photoMediaId: string | null };

export const AUTHOR_LINK_ROWS = 4;
const HTTP = /^https?:\/\/\S+$/i;

const read = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
};

function nameAndSlug(form: FormData, noun: string, maxName: number, errors: Errors) {
  const name = read(form, 'name');
  const typed = read(form, 'slug');
  const slug = (typed || slugify(name)).toLowerCase();
  if (!name) errors.name = `Give the ${noun} a name.`;
  else if (name.length > maxName) errors.name = `Keep the name under ${maxName} characters.`;
  if ((name || typed) && !isSlug(slug)) errors.slug = 'Use lowercase letters, numbers and single hyphens.';
  return { name, slug };
}

function limit(value: string, max: number, field: string, label: string, errors: Errors) {
  if (value.length > max) errors[field] = `Keep the ${label} under ${max} characters.`;
  return value;
}

export function parseSection(form: FormData): { values: SectionValues; errors: Errors } {
  const errors: Errors = {};
  const { name, slug } = nameAndSlug(form, 'section', 60, errors);
  if (!errors.slug && (RESERVED_SLUGS as readonly string[]).includes(slug)) {
    errors.slug = `The site already uses /${slug}. Choose another address.`;
  }
  const description = limit(read(form, 'description'), 300, 'description', 'description', errors);
  return { values: { name, slug, description, inNav: form.get('in_nav') === 'on' }, errors };
}

export function parseTag(form: FormData): { values: TagValues; errors: Errors } {
  const errors: Errors = {};
  const { name, slug } = nameAndSlug(form, 'tag', 60, errors);
  const description = limit(read(form, 'description'), 300, 'description', 'description', errors);
  return { values: { name, slug, description }, errors };
}

export function parseAuthor(form: FormData): { values: AuthorValues; errors: Errors } {
  const errors: Errors = {};
  const { name, slug } = nameAndSlug(form, 'author', 80, errors);
  const role = limit(read(form, 'role'), 80, 'role', 'role', errors);
  const bio = limit(read(form, 'bio'), 1000, 'bio', 'biography', errors);
  const links: AuthorLink[] = [];
  for (let i = 0; i < AUTHOR_LINK_ROWS; i++) {
    const label = read(form, `link_label_${i}`).slice(0, 40);
    const url = read(form, `link_url_${i}`).slice(0, 500);
    if (!label && !url) continue;
    if (!label || !HTTP.test(url)) errors.links = 'Each link needs a label and an address that starts with https:// or http://.';
    links.push({ label, url });
  }
  const photo = read(form, 'photo_media_id');
  return { values: { name, slug, role, bio, links, photoMediaId: UUID.test(photo) ? photo.toLowerCase() : null }, errors };
}
