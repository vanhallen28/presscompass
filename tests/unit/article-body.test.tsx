import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Doc } from '@/lib/doc/schema';
import { ArticleBody } from '@/modules/content/ArticleBody';

const doc = (content: unknown[]) => ({ type: 'doc', content }) as Doc;

const IMAGE = '2c9e7a2b-3d4f-4a5b-8c6d-7e8f9a0b1c2d';

describe('ArticleBody', () => {
  it('renders images from the media library with caption and credit, and skips deleted ones', () => {
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = 'demo';
    const html = renderToStaticMarkup(
      <ArticleBody
        media={new Map([[IMAGE, { publicId: 'presscompass/images/rice-abcd1234', width: 1600, height: 900, alt: 'Farmers in Karawang', credit: 'Rani/PressCompass' }]])}
        doc={doc([
          { type: 'image', attrs: { mediaId: IMAGE, caption: 'The harvest came early.' } },
          { type: 'image', attrs: { mediaId: '3c9e7a2b-3d4f-4a5b-8c6d-7e8f9a0b1c2d', caption: 'Gone' } },
        ])}
      />,
    );
    expect(html).toContain('alt="Farmers in Karawang"');
    expect(html).toContain('width="1600" height="900"');
    expect(html).toContain('srcSet="https://res.cloudinary.com/demo/image/upload/c_limit,w_320,f_auto,q_auto/presscompass/images/rice-abcd1234 320w');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('<figcaption>The harvest came early. <span class="credit">Photo: Rani/PressCompass</span></figcaption>');
    expect(html).not.toContain('Gone');
  });

  it('draws bar charts as SVG with a data table for screen readers', () => {
    const html = renderToStaticMarkup(
      <ArticleBody
        doc={doc([
          {
            type: 'chart',
            attrs: { kind: 'bar', title: 'Annual food inflation', subtitle: 'Per cent', source: 'BPS', axis: 'Month', labels: ['May', 'Jun', 'Jul'], series: [{ name: 'Inflation', values: [4.1, -0.5, 2.1] }] },
          },
        ])}
      />,
    );
    expect(html.match(/<rect /g)).toHaveLength(3);
    // The last bar is highlighted, like the locked preview; negative values get a true minus sign.
    expect(html).toContain('class="bar two"');
    expect(html).toContain('>\u22120.5</text>');
    expect(html).toContain('<svg viewBox="0 0 640 260" aria-hidden="true" focusable="false">');
    expect(html).toContain('<caption>Annual food inflation. Per cent</caption>');
    expect(html).toContain('<th scope="col">Month</th><th scope="col">Inflation</th>');
    expect(html).toContain('<tr><th scope="row">Jun</th><td>\u22120.5</td></tr>');
    expect(html).toContain('<figcaption class="source">Source: BPS</figcaption>');
  });

  it('draws line charts with end labels and gaps for missing values', () => {
    const html = renderToStaticMarkup(
      <ArticleBody
        doc={doc([
          {
            type: 'chart',
            attrs: {
              kind: 'line',
              title: 'Prices',
              subtitle: '',
              source: '',
              axis: '',
              labels: ['W1', 'W2', 'W3', 'W4'],
              series: [
                { name: 'Retail', values: [100, 99, 99, 99] },
                { name: 'Farm', values: [100, null, 92, 88] },
              ],
            },
          },
        ])}
      />,
    );
    expect(html.match(/<polyline /g)).toHaveLength(2);
    expect(html.match(/<circle /g)).toHaveLength(1);
    expect(html).toContain('>Retail 99</text>');
    expect(html).toContain('>Farm 88</text>');
    expect(html).toContain('<td>No data</td>');
    expect(html).not.toContain('Source:');
  });

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
