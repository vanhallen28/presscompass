import { UUID } from '@/lib/doc/schema';
import type { Scores } from './types';

// The SEO settings of one article, stored in articles.seo (jsonb). The editor sends them with every save;
// `scores` is written by the server from the analysis and never trusted from the browser.

export type ArticleSeo = {
  title: string;
  description: string;
  keyphrase: string;
  /** Up to four related keyphrases. */
  related: string[];
  /** Absolute address of the original when this article is a copy; empty for itself. */
  canonical: string;
  noindex: boolean;
  /** Image for social cards; null uses the automatic card. */
  ogMediaId: string | null;
  scores?: Scores;
};

export const EMPTY_SEO: ArticleSeo = { title: '', description: '', keyphrase: '', related: [], canonical: '', noindex: false, ogMediaId: null };

export const SEO_MAX = { title: 120, description: 320, keyphrase: 100, related: 4, canonical: 2000 } as const;

const str = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Reads what the database holds, tolerating old or partial values. */
export function readArticleSeo(raw: unknown): ArticleSeo {
  const r = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const scores = r.scores as Record<string, unknown> | undefined;
  return {
    title: str(r.title, SEO_MAX.title),
    description: str(r.description, SEO_MAX.description),
    keyphrase: str(r.keyphrase, SEO_MAX.keyphrase),
    related: Array.isArray(r.related)
      ? r.related
          .map((k) => str(k, SEO_MAX.keyphrase))
          .filter(Boolean)
          .slice(0, SEO_MAX.related)
      : [],
    canonical: str(r.canonical, SEO_MAX.canonical),
    noindex: r.noindex === true,
    ogMediaId: typeof r.ogMediaId === 'string' && UUID.test(r.ogMediaId) ? r.ogMediaId.toLowerCase() : null,
    ...(scores && Number.isFinite(scores.seo) && Number.isFinite(scores.readability)
      ? { scores: { seo: Number(scores.seo), readability: Number(scores.readability) } }
      : {}),
  };
}

/** Checks what the editor sent. Returns field errors (keys seoTitle, seoDescription, keyphrase, canonical). */
export function parseSeoInput(raw: unknown): { ok: true; value: ArticleSeo; errors: Record<string, string> } | { ok: false } {
  if (raw === undefined) return { ok: true, value: { ...EMPTY_SEO }, errors: {} };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false };
  const r = raw as Record<string, unknown>;
  if (
    !['title', 'description', 'keyphrase', 'canonical'].every((key) => typeof r[key] === 'string') ||
    typeof r.noindex !== 'boolean' ||
    !Array.isArray(r.related) ||
    r.related.length > 10 ||
    !r.related.every((k) => typeof k === 'string') ||
    !(r.ogMediaId === null || (typeof r.ogMediaId === 'string' && UUID.test(r.ogMediaId)))
  ) {
    return { ok: false };
  }
  const errors: Record<string, string> = {};
  const title = (r.title as string).replace(/\s+/g, ' ').trim();
  const description = (r.description as string).replace(/\s+/g, ' ').trim();
  const keyphrase = (r.keyphrase as string).replace(/\s+/g, ' ').trim();
  const canonical = (r.canonical as string).trim();
  const related = [...new Set((r.related as string[]).map((k) => k.replace(/\s+/g, ' ').trim()).filter(Boolean))];
  if (title.length > SEO_MAX.title) errors.seoTitle = `Keep the SEO title under ${SEO_MAX.title} characters.`;
  if (description.length > SEO_MAX.description) errors.seoDescription = `Keep the meta description under ${SEO_MAX.description} characters.`;
  if (keyphrase.length > SEO_MAX.keyphrase || related.some((k) => k.length > SEO_MAX.keyphrase))
    errors.keyphrase = `Keep keyphrases under ${SEO_MAX.keyphrase} characters.`;
  if (related.length > SEO_MAX.related) errors.keyphrase = `Add up to ${SEO_MAX.related} related keyphrases.`;
  if (canonical && (!/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(canonical) || canonical.length > SEO_MAX.canonical)) {
    errors.canonical = 'Use a full address that starts with https://, or leave it empty.';
  }
  return {
    ok: true,
    errors,
    value: {
      title,
      description,
      keyphrase,
      related: related.slice(0, SEO_MAX.related),
      canonical,
      noindex: r.noindex as boolean,
      ogMediaId: (r.ogMediaId as string | null)?.toLowerCase() ?? null,
    },
  };
}

/** Comma-separated text for the related keyphrases field, and back. */
export const relatedToText = (related: string[]) => related.join(', ');
export const textToRelated = (text: string) =>
  text
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
