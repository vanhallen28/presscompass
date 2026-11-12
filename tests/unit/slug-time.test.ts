import { describe, expect, it } from 'vitest';
import { isSlug, RESERVED_SLUGS, slugify } from '@/lib/slug';
import { formatWib, parseWibInput, toWibInput, wibDayStart } from '@/lib/time';

describe('slugify', () => {
  it('turns a headline into a lowercase, hyphenated address', () => {
    expect(slugify('Rice prices climb as El Niño dries Java’s fields')).toBe('rice-prices-climb-as-el-nino-dries-javas-fields');
    expect(slugify('  Q3 GDP: 5.1% & rising!  ')).toBe('q3-gdp-5-1-and-rising');
    expect(slugify('Bank Indonesia ⇢ holds')).toBe('bank-indonesia-holds');
    expect(slugify('!!!')).toBe('');
  });

  it('keeps addresses to 80 characters, cutting at a hyphen when it can', () => {
    const slug = slugify('word '.repeat(40));
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith('-')).toBe(false);
    expect(slug.endsWith('word')).toBe(true);
    expect(slugify('a'.repeat(100))).toHaveLength(80);
  });

  it('recognises valid slugs and knows the reserved ones', () => {
    expect(isSlug('rice-prices')).toBe(true);
    expect(isSlug('Rice-prices')).toBe(false);
    expect(isSlug('rice--prices')).toBe(false);
    expect(isSlug('-rice')).toBe(false);
    expect(isSlug('')).toBe(false);
    expect(isSlug('a'.repeat(81))).toBe(false);
    expect(RESERVED_SLUGS).toContain('newsroom');
    expect(RESERVED_SLUGS).toContain('sitemaps');
  });
});

describe('WIB time', () => {
  it('reads a date-time input as Jakarta time and writes it back', () => {
    expect(parseWibInput('2026-11-14T09:00')?.toISOString()).toBe('2026-11-14T02:00:00.000Z');
    expect(parseWibInput('2026-11-14T03:30')?.toISOString()).toBe('2026-11-13T20:30:00.000Z');
    expect(toWibInput(new Date('2026-11-13T20:30:00Z'))).toBe('2026-11-14T03:30');
  });

  it('refuses inputs that are not real date-times', () => {
    expect(parseWibInput('')).toBeNull();
    expect(parseWibInput('2026-02-30T09:00')).toBeNull();
    expect(parseWibInput('2026-11-14 09:00')).toBeNull();
    expect(parseWibInput('2026-11-14T24:00')).toBeNull();
  });

  it('formats dates for the Newsroom in WIB', () => {
    const date = new Date('2026-11-13T14:40:00Z');
    expect(formatWib(date)).toBe('13 Nov 2026, 21:40');
    expect(formatWib(date, 'date')).toBe('13 Nov 2026');
    expect(formatWib(date, 'time')).toBe('21:40');
    expect(formatWib(date, 'short')).toBe('13 Nov · 21:40');
    expect(formatWib('2026-11-13T17:05:00Z', 'short')).toBe('14 Nov · 00:05');
  });

  it('finds the start of the WIB day', () => {
    expect(wibDayStart(new Date('2026-11-13T18:00:00Z')).toISOString()).toBe('2026-11-13T17:00:00.000Z');
    expect(wibDayStart(new Date('2026-11-13T16:59:00Z')).toISOString()).toBe('2026-11-12T17:00:00.000Z');
  });
});
