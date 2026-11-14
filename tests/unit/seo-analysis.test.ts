import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Block, Doc } from '@/lib/doc/schema';
import { analyseArticle, type SeoInput } from '@/modules/seo/analysis';
import { fleschReadingEase, isPassive, sentences, syllables } from '@/modules/seo/readability';
import { applyTemplate, fitWidth, SERP, textWidth } from '@/modules/seo/snippet';
import { bodyStructure, isInternal } from '@/modules/seo/structure';
import { assess } from '@/modules/seo/types';
import { containsAll, phraseCount, stem } from '@/modules/seo/words';
import { writingCheck } from '@/modules/seo/writing';
import { parseArticle } from '../../scripts/starter/parse.mjs';

const p = (text: string, href?: string): Block => ({
  type: 'paragraph',
  content: href ? [{ type: 'text', text, marks: [{ type: 'link', attrs: { href } }] }] : [{ type: 'text', text }],
});
const h = (level: 2 | 3, text: string): Block => ({ type: 'heading', attrs: { level }, content: [{ type: 'text', text }] });
const doc = (...content: Block[]): Doc => ({ type: 'doc', content });

const filler = (n: number, sentence = 'Farmers in Java sell their harvest to the state buyer before the rains come.') =>
  Array.from({ length: n }, () => sentence).join(' ');

const base = (overrides: Partial<SeoInput> = {}): SeoInput => ({
  title: 'How Indonesia keeps rice prices stable through the year',
  seoTitle: '',
  description: '',
  standfirst: 'Rice prices in Indonesia are managed by a state buyer, an import quota and a reserve that Bulog holds for lean months.',
  slug: 'how-indonesia-keeps-rice-prices-stable',
  keyphrase: 'rice prices',
  related: [],
  body: doc(
    p(`Rice prices matter to every household in Indonesia. ${filler(4)}`),
    h(2, 'Who sets rice prices'),
    p(`The government sets a ceiling for rice prices, and Bulog buys at a floor. ${filler(8)}`),
    p('Read the background on ', '/business/bulog-explained'),
    p('the import quota', 'https://www.bps.go.id/en'),
    { type: 'readMore', attrs: { articleId: '00000000-0000-4000-8000-000000000001', title: '' } },
    { type: 'readMore', attrs: { articleId: '00000000-0000-4000-8000-000000000002', title: '' } },
  ),
  noindex: false,
  canonical: '',
  lead: { width: 1800, alt: 'A rice field in Java at harvest time' },
  imageAlts: [],
  sources: 2,
  siteHost: 'presscompass.site',
  titleTemplate: '%s · PressCompass',
  usage: { keyphrase: 0, title: 0 },
  ...overrides,
});

const check = (analysis: ReturnType<typeof analyseArticle>, id: string) =>
  [...analysis.seo.checks, ...analysis.readability.checks].find((c) => c.id === id);

describe('keyphrase matching', () => {
  it('folds plurals and possessives', () => {
    expect(stem('dragons')).toBe('dragon');
    expect(stem('cities')).toBe('city');
    expect(stem("Indonesia's")).toBe('indonesia');
    expect(stem('boxes')).toBe('box');
    expect(stem('status')).toBe('status');
    expect(containsAll("Indonesia's rice price ceiling", 'rice prices')).toBe(true);
    expect(containsAll('The price of rice', 'rice prices')).toBe(true);
    expect(containsAll('Rice harvest', 'rice prices')).toBe(false);
    expect(phraseCount('Rice prices rose. Rice prices fell.', 'rice price')).toBe(2);
  });
});

describe('search result widths', () => {
  it('measures and cuts titles like Google', () => {
    expect(textWidth('iiii', 20)).toBeLessThan(textWidth('MMMM', 20));
    const long = 'Indonesia and the North Natuna Sea: what the fishing dispute with China means for Jakarta';
    const cut = fitWidth(long, SERP.desktop.titleMax, SERP.desktop.titleFont);
    expect(cut.cut).toBe(true);
    expect(cut.text.endsWith(' …')).toBe(true);
    expect(textWidth(cut.text, 20)).toBeLessThanOrEqual(600);
    expect(fitWidth('Short title', 600, 20)).toEqual({ text: 'Short title', cut: false });
    expect(applyTemplate('%s · PressCompass', 'Rice')).toBe('Rice · PressCompass');
    expect(applyTemplate('PressCompass', 'Rice')).toBe('Rice');
  });
});

describe('body structure', () => {
  it('collects prose, headings, sections and links', () => {
    const body = bodyStructure(
      doc(p('One two three.'), h(2, 'Heading'), p('Four five.'), p('link', 'https://presscompass.site/news/x'), {
        type: 'bulletList',
        content: [{ type: 'listItem', content: [p('Item one.') as never] }],
      }),
    );
    expect(body.headings).toEqual([{ level: 2, text: 'Heading' }]);
    expect(body.sectionWords).toEqual([3, 5]);
    expect(body.prose).toEqual(['One two three.', 'Four five.', 'link', 'Item one.']);
    expect(body.links).toEqual([{ href: 'https://presscompass.site/news/x', text: 'link' }]);
    expect(isInternal('https://www.presscompass.site/a', 'presscompass.site')).toBe(true);
    expect(isInternal('//evil.example/a', 'presscompass.site')).toBe(false);
    expect(isInternal('https://bps.go.id', 'presscompass.site')).toBe(false);
  });
});

describe('readability', () => {
  it('splits sentences without breaking abbreviations or decimals', () => {
    expect(sentences('Inflation was 2.9% in 2025. Mr. Prabowo spoke on Monday. Prices rose!')).toEqual([
      'Inflation was 2.9% in 2025.',
      'Mr. Prabowo spoke on Monday.',
      'Prices rose!',
    ]);
  });

  it('counts syllables and scores reading ease', () => {
    expect(syllables('cat')).toBe(1);
    expect(syllables('government')).toBe(3);
    expect(syllables('Indonesia')).toBeGreaterThanOrEqual(4);
    const easy = fleschReadingEase([filler(5, 'The cat sat on the mat. It was a warm day.')]);
    const hard = fleschReadingEase([filler(5, 'Macroeconomic stabilisation necessitates comprehensive institutional coordination mechanisms.')]);
    expect(easy).toBeGreaterThan(80);
    expect(hard).toBeLessThan(20);
    expect(fleschReadingEase(['Too short.'])).toBeNull();
  });

  it('spots the passive voice', () => {
    expect(isPassive('The law was passed by parliament.')).toBe(true);
    expect(isPassive('The dragons were counted in 2024.')).toBe(true);
    expect(isPassive('The bridge has been built.')).toBe(true);
    expect(isPassive('Parliament passed the law.')).toBe(false);
  });
});

describe('writing check', () => {
  it('flags stock phrases, exclamation marks and figures without a source', () => {
    const result = writingCheck(['This plays a pivotal role in the economy!', 'Exports rose 12% last year.', 'He said: “We won!”'], {
      hasSources: false,
    });
    expect(result.rating).toBe('ok');
    expect(result.details?.join(' ')).toContain('pivotal');
    expect(result.details?.join(' ')).toContain('exclamation');
    expect(result.details?.join(' ')).toContain('figure');
    expect(writingCheck(['Exports rose 12% last year.'], { hasSources: true }).rating).toBe('good');
    expect(writingCheck(['The census ran in 2020.'], { hasSources: false }).rating).toBe('good');
  });
});

describe('SEO analysis', () => {
  it('rates a well-prepared article as good', () => {
    const analysis = analyseArticle(base());
    expect(analysis.title).toBe('How Indonesia keeps rice prices stable through the year · PressCompass');
    expect(analysis.usesStandfirst).toBe(true);
    const bad = analysis.seo.checks.filter((c) => c.rating === 'bad').map((c) => c.id);
    expect(bad).toEqual([]);
    expect(analysis.seo.rating).toBe('good');
    expect(check(analysis, 'internal-links')?.rating).toBe('good');
    expect(check(analysis, 'sources')?.rating).toBe('good');
  });

  it('asks for a keyphrase before the keyphrase checks', () => {
    const analysis = analyseArticle(base({ keyphrase: '' }));
    expect(check(analysis, 'keyphrase')?.rating).toBe('bad');
    expect(check(analysis, 'title-keyphrase')).toBeUndefined();
    expect(check(analysis, 'density')).toBeUndefined();
  });

  it('flags keyword stuffing, missing images and links', () => {
    const stuffed = doc(p(filler(20, 'Rice prices rise when rice prices fall.')));
    const analysis = analyseArticle(base({ body: stuffed, lead: null, sources: 0 }));
    expect(check(analysis, 'density')?.rating).toBe('bad');
    expect(check(analysis, 'lead-image')?.rating).toBe('bad');
    expect(check(analysis, 'internal-links')?.rating).toBe('bad');
    expect(check(analysis, 'sources')?.rating).toBe('bad');
  });

  it('checks title width, description length, headings and alt text', () => {
    const long = analyseArticle(base({ seoTitle: 'Rice prices in Indonesia: how the state buyer, import quotas and reserves keep them steady' }));
    expect(check(long, 'title-width')?.rating).toBe('bad');
    const short = analyseArticle(base({ description: 'Rice prices.' }));
    expect(check(short, 'description-length')?.rating).toBe('ok');
    expect(short.usesStandfirst).toBe(false);
    const order = analyseArticle(base({ body: doc(h(3, 'Rice prices first'), p(filler(30))) }));
    expect(check(order, 'headings-order')?.rating).toBe('bad');
    const alts = analyseArticle(base({ imageAlts: ['', 'Bulog warehouse'], lead: { width: 800, alt: 'Field' } }));
    expect(check(alts, 'image-alt')?.rating).toBe('bad');
    expect(check(alts, 'lead-image')?.rating).toBe('ok');
  });

  it('warns about keyphrases and titles used elsewhere, noindex and generic link text', () => {
    const analysis = analyseArticle(
      base({ usage: { keyphrase: 2, title: 1 }, noindex: true, body: doc(p(`Rice prices. ${filler(30)}`), p('click here', 'https://example.org')) }),
    );
    expect(check(analysis, 'keyphrase-used')?.text).toContain('2 other articles');
    expect(check(analysis, 'title-unique')?.rating).toBe('bad');
    expect(check(analysis, 'noindex')?.rating).toBe('bad');
    expect(check(analysis, 'link-text')?.rating).toBe('ok');
    expect(analyseArticle(base({ usage: null })).seo.checks.some((c) => c.id === 'keyphrase-used')).toBe(false);
  });

  it('scores 9, 5 and 0 points per light', () => {
    expect(assess([{ id: 'a', rating: 'good', text: '' }]).score).toBe(100);
    expect(
      assess([
        { id: 'a', rating: 'good', text: '' },
        { id: 'b', rating: 'bad', text: '' },
      ]).score,
    ).toBe(50);
    expect(
      assess([
        { id: 'a', rating: 'good', text: '' },
        { id: 'b', rating: 'bad', text: '' },
      ]).rating,
    ).toBe('ok');
    expect(assess([{ id: 'a', rating: 'ok', text: '' }]).rating).toBe('ok');
    expect(assess([]).score).toBe(0);
  });

  it('runs on every starter article', () => {
    const dir = 'content/starter/articles';
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
      const article = parseArticle(readFileSync(`${dir}/${file}`, 'utf8'), file);
      const analysis = analyseArticle(
        base({
          title: article.title,
          standfirst: article.standfirst,
          slug: article.slug,
          body: article.body,
          keyphrase: article.tags[0] ?? '',
          sources: article.sources.length,
        }),
      );
      expect(analysis.readability.checks.find((c) => c.id === 'flesch')?.text, file).toMatch(/Reading ease is/);
      expect(analysis.seo.score, file).toBeGreaterThan(30);
    }
  });
});
