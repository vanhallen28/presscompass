import { sanitizeDoc } from '@/lib/doc/sanitize';
import { bodyMediaIds, docText, readingMinutes, wordCount } from '@/lib/doc/text';
import { parseWibInput } from '@/lib/time';
import { analyseArticle, scoresOf } from '@/modules/seo/analysis';
import type { ArticleInput, FieldErrors } from './input';
import { publishProblems } from './rules';
import { type Intent, type Timing, transition } from './status';

// Turns a checked editor input and the article's current status into exactly what save_article
// stores: the fields, the relations and the revision note. Pure, so the whole decision is tested.

export type SavePlan =
  | {
      ok: true;
      fields: Record<string, unknown>;
      authors: string[];
      tags: string[];
      related: string[];
      revision: string;
      throttle: boolean;
    }
  | { ok: false; errors: FieldErrors };

export type Scoring = { siteHost: string; titleTemplate: string; usage: { keyphrase: number; title: number } | null };
const DEFAULT_SCORING: Scoring = { siteHost: 'presscompass.site', titleTemplate: '%s · PressCompass', usage: null };

export function prepareSave({
  input,
  current,
  intent,
  now,
  media,
  scoring = DEFAULT_SCORING,
}: {
  input: { value: ArticleInput; errors: FieldErrors };
  current: Timing;
  intent: Intent;
  now: Date;
  /** Alt text and width of the media items this article uses (lead image and images in the text), by id. */
  media: Map<string, { alt: string; width?: number }>;
  /** What the SEO scores need from outside the article (site host, title template, other articles' keyphrases). */
  scoring?: Scoring;
}): SavePlan {
  if (Object.keys(input.errors).length) return { ok: false, errors: input.errors };
  const article = input.value;

  let scheduledAt: Date | null = null;
  if (article.scheduledAt) {
    scheduledAt = parseWibInput(article.scheduledAt);
    if (!scheduledAt) return { ok: false, errors: { scheduledAt: 'Enter a valid date and time.' } };
  }

  const step = transition(current, intent, { now, scheduledAt, majorUpdate: article.majorUpdate });
  if (!step.ok) return { ok: false, errors: { [step.field ?? 'status']: step.error } };

  const body = sanitizeDoc(article.body);
  const text = docText(body);
  const words = wordCount(text);

  if (step.needsRules) {
    const problems = publishProblems({
      title: article.title,
      slug: article.slug,
      sectionId: article.sectionId,
      authorIds: article.authorIds,
      standfirst: article.standfirst,
      wordCount: words,
      leadImage: article.leadMediaId ? (media.get(article.leadMediaId) ?? null) : null,
      imagesWithoutAlt: bodyMediaIds(body).filter((id) => !media.get(id)?.alt.trim()).length,
    });
    if (Object.keys(problems).length) return { ok: false, errors: problems };
  }

  const fields: Record<string, unknown> = {
    title: article.title,
    slug: article.slug,
    slug_auto: article.slugAuto,
    section_id: article.sectionId,
    type: article.type,
    kicker_label: article.kicker,
    standfirst: article.standfirst,
    body,
    body_text: text,
    word_count: words,
    reading_minutes: readingMinutes(words),
    is_breaking: article.isBreaking,
    lead_media_id: article.leadMediaId,
    lead_caption: article.leadCaption,
    sources: article.sources,
    status: step.status,
    published_at: step.published_at,
    scheduled_at: step.scheduled_at,
  };
  if (step.major_update_at) fields.major_update_at = step.major_update_at;

  const lead = article.leadMediaId ? media.get(article.leadMediaId) : undefined;
  const analysis = analyseArticle({
    title: article.title,
    seoTitle: article.seo.title,
    description: article.seo.description,
    standfirst: article.standfirst,
    slug: article.slug,
    keyphrase: article.seo.keyphrase,
    related: article.seo.related,
    body,
    noindex: article.seo.noindex,
    canonical: article.seo.canonical,
    lead: lead ? { alt: lead.alt, width: lead.width ?? 0 } : null,
    imageAlts: bodyMediaIds(body).map((id) => media.get(id)?.alt ?? ''),
    sources: article.sources.length,
    ...scoring,
  });
  fields.seo = { ...article.seo, scores: scoresOf(analysis) };

  return {
    ok: true,
    fields,
    authors: article.authorIds,
    tags: article.tagIds,
    related: article.relatedIds.filter((id) => id !== article.id),
    revision: step.note,
    throttle: step.throttle,
  };
}
