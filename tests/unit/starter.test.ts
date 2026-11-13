import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sanitizeDoc } from '@/lib/doc/sanitize';
import { docText, readingMinutes as appReadingMinutes, wordCount as appWordCount } from '@/lib/doc/text';
import type { Doc } from '@/lib/doc/schema';
import { slugify as appSlugify } from '@/lib/slug';
import { bodyText, inline, markdownToDoc, parseArticle, readingMinutes, SECTIONS, slugify, splitFrontMatter, wordCount } from '../../scripts/starter/parse.mjs';

const ROOT = join(process.cwd(), 'content', 'starter');
const files = readdirSync(join(ROOT, 'articles')).filter((name) => name.endsWith('.md')).sort();
const articles = files.map((file) => parseArticle(readFileSync(join(ROOT, 'articles', file), 'utf8'), file));

describe('starter content format', () => {
  it('reads front matter, quoted values and sources', () => {
    const { meta, body } = splitFrontMatter(
      '---\ntitle: "Nusantara: a test"\nslug: a-test\nsources:\n- One | https://example.com/1 | Example | 2026-11-13\n---\nBody line\n',
    );
    expect(meta).toMatchObject({ title: 'Nusantara: a test', slug: 'a-test' });
    expect(meta.sources).toEqual([{ title: 'One', url: 'https://example.com/1', publisher: 'Example', accessed: '2026-11-13' }]);
    expect(body).toBe('Body line\n');
  });

  it('turns bold, italic and links into marks', () => {
    expect(inline('A **bold** and *italic* [link](https://example.com) end')).toEqual([
      { type: 'text', text: 'A ' },
      { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
      { type: 'text', text: ' and ' },
      { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
      { type: 'text', text: ' ' },
      { type: 'text', text: 'link', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] },
      { type: 'text', text: ' end' },
    ]);
  });

  it('builds headings, paragraphs, lists and special blocks', () => {
    const doc = markdownToDoc(
      'First line\nsame paragraph.\n\n## Heading\n\n- one\n- two\n\n```figures\n{"title": "T", "items": [{"value": "1", "label": "L"}], "source": "S"}\n```\n',
    );
    expect(doc.content.map((block: { type: string }) => block.type)).toEqual(['paragraph', 'heading', 'bulletList', 'keyFigures']);
    expect(doc.content[0]).toEqual({ type: 'paragraph', content: [{ type: 'text', text: 'First line same paragraph.' }] });
    expect(doc.content[2].content).toHaveLength(2);
  });

  it('reports every problem in a file', () => {
    expect(() => parseArticle('---\ntitle: X\nslug: Not A Slug\ntype: rumour\n---\n```chart\n{oops\n```\n', 'bad.md')).toThrow(
      /bad\.md: section is missing.*slug must use.*type must be one of.*not valid JSON/,
    );
  });

  it('makes the same slugs as the app', () => {
    for (const name of ['Food prices', 'Time zones', 'BRICS', 'Nickel']) expect(slugify(name)).toBe(appSlugify(name));
  });
});

describe('starter articles', () => {
  it('has ten articles with unique slugs', () => {
    expect(articles).toHaveLength(10);
    expect(new Set(articles.map((article) => article.slug)).size).toBe(10);
  });

  it.each(articles.map((article) => [article.file, article] as const))('%s survives the sanitizer unchanged', (_file, article) => {
    expect(sanitizeDoc(article.body)).toEqual(article.body);
  });

  it.each(articles.map((article) => [article.file, article] as const))('%s counts words like the editor', (_file, article) => {
    const text = docText(article.body as Doc);
    expect(bodyText(article.body)).toBe(text);
    expect(wordCount(text)).toBe(appWordCount(text));
    expect(readingMinutes(wordCount(text))).toBe(appReadingMinutes(appWordCount(text)));
    expect(appWordCount(text)).toBeGreaterThan(250);
  });

  it('points to images, sections and related articles that exist', () => {
    const slugs = articles.map((article) => article.slug);
    for (const article of articles) {
      expect(existsSync(join(ROOT, 'images', `${article.image}.jpg`)), article.file).toBe(true);
      expect(SECTIONS.map((section) => section.slug), article.file).toContain(article.section);
      for (const slug of article.related) expect(slugs, article.file).toContain(slug);
      expect(article.sources.length, article.file).toBeGreaterThan(0);
    }
    expect(new Set(articles.map((article) => article.section)).size).toBe(SECTIONS.length);
  });
});
