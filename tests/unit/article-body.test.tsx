import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Doc } from '@/lib/doc/schema';
import { ArticleBody } from '@/modules/content/ArticleBody';

const doc = (content: unknown[]) => ({ type: 'doc', content }) as Doc;

describe('ArticleBody', () => {
  it('renders text blocks with their marks', () => {
    const html = renderToStaticMarkup(
      <ArticleBody
        doc={doc([
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'What changed' }] },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Prices ' },
              { type: 'text', text: 'rose', marks: [{ type: 'bold' }, { type: 'link', attrs: { href: 'https://bps.go.id' } }] },
              { type: 'hardBreak' },
              { type: 'text', text: 'again', marks: [{ type: 'italic' }] },
            ],
          },
          { type: 'paragraph' },
          { type: 'orderedList', attrs: { start: 2 }, content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Two' }] }] }] },
        ])}
      />,
    );
    expect(html).toContain('<h2>What changed</h2>');
    expect(html).toContain('<a href="https://bps.go.id" rel="noopener"><strong>rose</strong></a><br/><em>again</em>');
    expect(html).toContain('<ol start="2"><li><p>Two</p></li></ol>');
    expect(html.match(/<p>/g)).toHaveLength(2);
  });

  it('never renders a link it does not trust', () => {
    const html = renderToStaticMarkup(
      <ArticleBody doc={doc([{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }])} />,
    );
    expect(html).toBe('<div class="body"><p>x</p></div>');
  });

  it('renders the special blocks', () => {
    const id = '0b8a6f5e-58a8-4d5c-9b8e-0a5b8a1c2d3e';
    const html = renderToStaticMarkup(
      <ArticleBody
        links={new Map([[id, { title: 'Earlier story', href: '/business/earlier-story' }]])}
        doc={doc([
          { type: 'pullQuote', attrs: { text: 'We are not done.', attribution: 'Finance minister' } },
          { type: 'editorNote', attrs: { kind: 'correction', date: '2026-11-13', text: 'An earlier version misstated the figure.' } },
          { type: 'keyFigures', attrs: { title: 'Harvest', items: [{ value: '31.5m', label: 'tonnes' }], source: 'BPS' } },
          { type: 'readMore', attrs: { articleId: id, title: 'Old title' } },
          { type: 'readMore', attrs: { articleId: '1b8a6f5e-58a8-4d5c-9b8e-0a5b8a1c2d3e', title: 'Deleted story' } },
          { type: 'youtube', attrs: { videoId: 'dQw4w9WgXcQ', title: 'Briefing' } },
        ])}
      />,
    );
    expect(html).toContain('<blockquote><p>We are not done.</p></blockquote><figcaption>Finance minister</figcaption>');
    expect(html).toContain('<b>Correction · 13 Nov 2026.</b> An earlier version misstated the figure.');
    expect(html).toContain('<dd class="figValue">31.5m</dd>');
    expect(html).toContain('Source: BPS');
    expect(html).toContain('<a href="/business/earlier-story">Earlier story</a>');
    expect(html).not.toContain('Deleted story');
    expect(html).toContain('Play video: Briefing');
    expect(html).not.toContain('<iframe');
  });
});
