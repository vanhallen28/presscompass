import { describe, expect, it } from 'vitest';
import { articleDateLine, articleHref, cardMeta, initials, kickerFor, names, pageNumber } from '@/modules/site/format';

const card = { isBreaking: false, kicker: '', type: 'news' as const, section: { name: 'Business', slug: 'business' } };

describe('site formatting', () => {
  it('builds article addresses', () => {
    expect(articleHref({ slug: 'rice-prices', section: { slug: 'business' } })).toBe('/business/rice-prices');
    expect(articleHref({ slug: 'rice-prices', section: 'politics' })).toBe('/politics/rice-prices');
    expect(articleHref({ slug: 'orphan', section: null })).toBe('/news/orphan');
  });

  it('chooses the kicker: breaking, editor label, type, then section', () => {
    expect(kickerFor({ ...card, isBreaking: true, kicker: 'Markets' })).toEqual({ text: 'Breaking', tone: 'live' });
    expect(kickerFor({ ...card, kicker: 'Markets', type: 'analysis' })).toEqual({ text: 'Markets', tone: 'default' });
    expect(kickerFor({ ...card, type: 'explainer' })).toEqual({ text: 'Explainer', tone: 'plain' });
    expect(kickerFor(card)).toEqual({ text: 'Business', tone: 'default' });
    expect(kickerFor(card, { hideSection: true })).toBeNull();
  });

  it('writes bylines, initials and card lines', () => {
    expect(names([])).toBe('');
    expect(names([{ name: 'Rani' }, { name: 'Bima' }, { name: 'Ayu' }])).toBe('Rani, Bima and Ayu');
    expect(initials('Rani Prameswari')).toBe('RP');
    expect(initials('Plato')).toBe('P');
    const article = { authors: [{ name: 'Rani', slug: 'rani', role: '', photo: null }], publishedAt: '2026-11-12T12:50:00Z', readingMinutes: 6 };
    expect(cardMeta(article)).toBe('Rani · 12 Nov 2026');
    expect(cardMeta({ ...article, authors: [] }, { minutes: true })).toBe('12 Nov 2026 · 6 min read');
  });

  it('dates articles in WIB with the update time when it changed later', () => {
    expect(articleDateLine('2026-11-12T12:50:00Z', null, 6)).toBe('12 Nov 2026 · 19:50 WIB · 6 min read');
    expect(articleDateLine('2026-11-12T12:50:00Z', '2026-11-12T13:15:00Z', 6)).toBe('12 Nov 2026 · 19:50 WIB · Updated 20:15 · 6 min read');
    expect(articleDateLine('2026-11-12T12:50:00Z', '2026-11-13T01:00:00Z', 0)).toBe('12 Nov 2026 · 19:50 WIB · Updated 13 Nov · 08:00');
    expect(articleDateLine('2026-11-12T12:50:00Z', '2026-11-12T12:50:20Z', 0)).toBe('12 Nov 2026 · 19:50 WIB');
  });

  it('reads page numbers from addresses', () => {
    expect(pageNumber('2')).toBe(2);
    expect(pageNumber('1')).toBeNull();
    expect(pageNumber('02')).toBeNull();
    expect(pageNumber('x')).toBeNull();
  });
});
