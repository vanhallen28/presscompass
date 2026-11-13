import { formatWib } from '@/lib/time';
import { TYPE_LABELS } from '@/modules/editor/input';
import type { Card, SitePerson } from './types';

// Small pure helpers for how articles read on the site: addresses, kickers, bylines, date lines.

/** `/business/rice-prices-fall`. Published articles always have a section; `news` is a safe fallback. */
export function articleHref(article: { slug: string; section: { slug: string } | null | string }): string {
  const section = typeof article.section === 'string' ? article.section : article.section?.slug;
  return `/${section || 'news'}/${article.slug}`;
}

export type Kicker = { text: string; tone: 'default' | 'plain' | 'live' } | null;

/**
 * The small label above a headline: Breaking, then the editor's kicker, then the article type when it is
 * not plain news, then the section (left out where the page is already that section).
 */
export function kickerFor(card: Pick<Card, 'isBreaking' | 'kicker' | 'type' | 'section'>, { hideSection = false } = {}): Kicker {
  if (card.isBreaking) return { text: 'Breaking', tone: 'live' };
  if (card.kicker) return { text: card.kicker, tone: 'default' };
  if (card.type !== 'news') return { text: TYPE_LABELS[card.type], tone: 'plain' };
  if (!hideSection && card.section) return { text: card.section.name, tone: 'default' };
  return null;
}

/** `Rani`, `Rani and Bima`, `Rani, Bima and Ayu`. */
export function names(people: Pick<SitePerson, 'name'>[]): string {
  const list = people.map((person) => person.name);
  if (list.length <= 1) return list[0] ?? '';
  return `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`;
}

/** `RP` for Rani Prameswari: the avatar when an author has no photo. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')).toUpperCase();
}

/** The line under a card's headline: `Rani Prameswari · 12 Nov 2026`, optionally with the reading time. */
export function cardMeta(card: Pick<Card, 'authors' | 'publishedAt' | 'readingMinutes'>, { minutes = false } = {}): string {
  return [names(card.authors), formatWib(card.publishedAt, 'date'), minutes && card.readingMinutes > 0 ? `${card.readingMinutes} min read` : '']
    .filter(Boolean)
    .join(' · ');
}

/** `12 Nov 2026 · 19:50 WIB · Updated 20:15 · 6 min read` for an article's byline. */
export function articleDateLine(publishedAt: string, updatedAt: string | null, minutes: number): string {
  const parts = [formatWib(publishedAt, 'date'), `${formatWib(publishedAt, 'time')} WIB`];
  if (updatedAt && new Date(updatedAt).getTime() > new Date(publishedAt).getTime() + 60_000) {
    const sameDay = formatWib(updatedAt, 'date') === formatWib(publishedAt, 'date');
    parts.push(`Updated ${sameDay ? formatWib(updatedAt, 'time') : formatWib(updatedAt, 'short')}`);
  }
  if (minutes > 0) parts.push(`${minutes} min read`);
  return parts.join(' · ');
}

/** A positive page number from a URL segment, or null. Page 1 lives at the list's own address. */
export function pageNumber(segment: string): number | null {
  if (!/^[1-9]\d{0,4}$/.test(segment)) return null;
  const page = Number(segment);
  return page >= 2 ? page : null;
}
