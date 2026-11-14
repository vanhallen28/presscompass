import { UUID } from '@/lib/doc/schema';
import { isSlug } from '@/lib/slug';
import { type ArticleSeo, parseSeoInput } from '@/modules/seo/article';

// Checks what the editor in the browser sends before anything is saved. Shape problems (wrong
// types, unknown ids) reject the request; content problems come back as messages per field.

export const ARTICLE_TYPES = ['news', 'analysis', 'explainer', 'opinion', 'feature'] as const;
export type ArticleType = (typeof ARTICLE_TYPES)[number];

export const TYPE_LABELS: Record<ArticleType, string> = {
  news: 'News',
  analysis: 'Analysis',
  explainer: 'Explainer',
  opinion: 'Opinion',
  feature: 'Feature',
};

export const MAX = { title: 200, kicker: 40, standfirst: 400, authors: 10, tags: 30, related: 6, sources: 30, leadCaption: 300 } as const;

export type Source = { title: string; url: string; publisher: string; accessed: string };

export type ArticleInput = {
  id: string;
  version: number;
  title: string;
  slug: string;
  slugAuto: boolean;
  sectionId: string | null;
  type: ArticleType;
  kicker: string;
  standfirst: string;
  body: unknown;
  isBreaking: boolean;
  authorIds: string[];
  tagIds: string[];
  relatedIds: string[];
  sources: Source[];
  scheduledAt: string | null;
  majorUpdate: boolean;
  leadMediaId: string | null;
  leadCaption: string;
  seo: ArticleSeo;
};

export type InputField = 'title' | 'slug' | 'kicker' | 'standfirst' | 'sources';
export type FieldErrors = Partial<Record<string, string>>;

export type ParseResult = { ok: true; value: ArticleInput; errors: FieldErrors } | { ok: false; error: string };

const UNEXPECTED = 'The editor sent something unexpected. Reload the page and try again.';
const HTTP = /^https?:\/\/\S+$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isIdList = (value: unknown, max: number): value is string[] =>
  Array.isArray(value) && value.length <= max && value.every((id) => typeof id === 'string' && UUID.test(id)) && new Set(value).size === value.length;

export function parseArticleInput(raw: unknown): ParseResult {
  if (!isObject(raw)) return { ok: false, error: UNEXPECTED };
  const r = raw;
  const strings = ['title', 'slug', 'kicker', 'standfirst'] as const;
  if (
    typeof r.id !== 'string' ||
    !UUID.test(r.id) ||
    !Number.isInteger(r.version) ||
    (r.version as number) < 1 ||
    strings.some((key) => typeof r[key] !== 'string') ||
    typeof r.slugAuto !== 'boolean' ||
    typeof r.isBreaking !== 'boolean' ||
    typeof r.majorUpdate !== 'boolean' ||
    !(r.sectionId === null || (typeof r.sectionId === 'string' && UUID.test(r.sectionId))) ||
    !ARTICLE_TYPES.includes(r.type as ArticleType) ||
    !isIdList(r.authorIds, MAX.authors) ||
    !isIdList(r.tagIds, MAX.tags) ||
    !isIdList(r.relatedIds, MAX.related) ||
    !Array.isArray(r.sources) ||
    r.sources.length > MAX.sources ||
    !r.sources.every(isObject) ||
    !(r.scheduledAt === null || typeof r.scheduledAt === 'string') ||
    !(r.leadMediaId === null || (typeof r.leadMediaId === 'string' && UUID.test(r.leadMediaId))) ||
    typeof r.leadCaption !== 'string'
  ) {
    return { ok: false, error: UNEXPECTED };
  }
  const seo = parseSeoInput(r.seo);
  if (!seo.ok) return { ok: false, error: UNEXPECTED };

  const errors: FieldErrors = { ...seo.errors };
  const title = (r.title as string).trim();
  const slug = (r.slug as string).trim();
  const kicker = (r.kicker as string).trim();
  const standfirst = (r.standfirst as string).trim();
  if (title.length > MAX.title) errors.title = `Keep the headline under ${MAX.title} characters.`;
  if (!isSlug(slug)) errors.slug = 'Use lowercase letters, numbers and single hyphens.';
  if (kicker.length > MAX.kicker) errors.kicker = `Keep the label under ${MAX.kicker} characters.`;
  if (standfirst.length > MAX.standfirst) errors.standfirst = `Keep the standfirst under ${MAX.standfirst} characters.`;
  const leadCaption = (r.leadCaption as string).trim();
  if (leadCaption.length > MAX.leadCaption) errors.leadCaption = `Keep the caption under ${MAX.leadCaption} characters.`;

  const sources: Source[] = [];
  let badSource = false;
  for (const item of r.sources as Record<string, unknown>[]) {
    const source = {
      title: typeof item.title === 'string' ? item.title.trim().slice(0, 200) : '',
      url: typeof item.url === 'string' ? item.url.trim().slice(0, 2000) : '',
      publisher: typeof item.publisher === 'string' ? item.publisher.trim().slice(0, 120) : '',
      accessed: typeof item.accessed === 'string' ? item.accessed.trim() : '',
    };
    if (!source.title && !source.url && !source.publisher && !source.accessed) continue;
    if (!source.title || !HTTP.test(source.url) || (source.accessed && !DATE.test(source.accessed))) badSource = true;
    sources.push(source);
  }
  if (badSource) errors.sources = 'Each source needs a title and a link that starts with https:// or http://. Dates use YYYY-MM-DD.';

  return {
    ok: true,
    errors,
    value: {
      id: (r.id as string).toLowerCase(),
      version: r.version as number,
      title,
      slug,
      slugAuto: r.slugAuto as boolean,
      sectionId: (r.sectionId as string | null)?.toLowerCase() ?? null,
      type: r.type as ArticleType,
      kicker,
      standfirst,
      body: r.body,
      isBreaking: r.isBreaking as boolean,
      authorIds: (r.authorIds as string[]).map((id) => id.toLowerCase()),
      tagIds: (r.tagIds as string[]).map((id) => id.toLowerCase()),
      relatedIds: (r.relatedIds as string[]).map((id) => id.toLowerCase()),
      sources,
      scheduledAt: r.scheduledAt as string | null,
      majorUpdate: r.majorUpdate as boolean,
      leadMediaId: (r.leadMediaId as string | null)?.toLowerCase() ?? null,
      leadCaption,
      seo: seo.value,
    },
  };
}
