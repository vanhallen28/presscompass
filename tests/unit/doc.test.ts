import { describe, expect, it } from 'vitest';
import { EMPTY_DOC } from '@/lib/doc/schema';
import { sanitizeDoc } from '@/lib/doc/sanitize';
import { docText, readingMinutes, wordCount } from '@/lib/doc/text';

const p = (text: string, marks?: unknown[]) => ({ type: 'paragraph', content: [{ type: 'text', text, ...(marks ? { marks } : {}) }] });

describe('sanitizeDoc', () => {
  it('keeps the blocks and marks the editor supports', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'What changed' }] },
        p('Prices rose ', [{ type: 'bold' }]),
        { type: 'bulletList', content: [{ type: 'listItem', content: [p('One')] }] },
        { type: 'orderedList', attrs: { start: 3 }, content: [{ type: 'listItem', content: [p('Three')] }] },
        { type: 'blockquote', content: [p('Quoted')] },
        { type: 'horizontalRule' },
        { type: 'pullQuote', attrs: { text: 'We are not done.', attribution: 'Sri Mulyani, finance minister' } },
        { type: 'editorNote', attrs: { kind: 'correction', date: '2026-11-13', text: 'An earlier version misstated the figure.' } },
        { type: 'keyFigures', attrs: { title: 'Harvest', items: [{ value: '31.5m', label: 'tonnes' }, { value: '−2.4%', label: 'on year' }], source: 'BPS' } },
        { type: 'youtube', attrs: { videoId: 'dQw4w9WgXcQ', title: 'Briefing' } },
        { type: 'readMore', attrs: { articleId: '0b8a6f5e-58a8-4d5c-9b8e-0a5b8a1c2d3e', title: 'Earlier story' } },
        {
          type: 'table',
          content: [
            { type: 'tableRow', content: [{ type: 'tableHeader', attrs: { colspan: 1, rowspan: 1 }, content: [p('Year')] }] },
            { type: 'tableRow', content: [{ type: 'tableCell', attrs: { colspan: 2, rowspan: 1 }, content: [p('2026')] }] },
          ],
        },
      ],
    };
    expect(sanitizeDoc(doc)).toEqual(doc);
  });

  it('drops unknown attributes, unsafe links and marks it does not know', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { class: 'x' },
          content: [
            { type: 'text', text: 'safe', marks: [{ type: 'link', attrs: { href: 'https://bps.go.id', target: '_blank', onclick: 'x' } }] },
            { type: 'text', text: ' bad', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }, { type: 'italic' }] },
            { type: 'text', text: ' struck', marks: [{ type: 'strike' }, { type: 'bold' }, { type: 'bold' }] },
            { type: 'hardBreak' },
          ],
        },
      ],
    };
    expect(sanitizeDoc(doc)).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'safe', marks: [{ type: 'link', attrs: { href: 'https://bps.go.id' } }] },
            { type: 'text', text: ' bad', marks: [{ type: 'italic' }] },
            { type: 'text', text: ' struck', marks: [{ type: 'bold' }] },
            { type: 'hardBreak' },
          ],
        },
      ],
    });
  });

  it('turns blocks it does not allow in a place into paragraphs instead of losing their text', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Too big' }] },
        { type: 'heading', attrs: { level: 5 }, content: [{ type: 'text', text: 'Too small' }] },
        { type: 'codeBlock', content: [{ type: 'text', text: 'let x = 1' }] },
        { type: 'blockquote', content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Inside' }] }] },
        { type: 'iframe', attrs: { src: 'https://evil.example' } },
      ],
    };
    expect(sanitizeDoc(doc)).toEqual({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Too big' }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Too small' }] },
        p('let x = 1'),
        { type: 'blockquote', content: [p('Inside')] },
      ],
    });
  });

  it('drops special blocks that are empty or invalid', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'pullQuote', attrs: { text: '   ', attribution: 'Nobody' } },
        { type: 'youtube', attrs: { videoId: 'too-short', title: 'x' } },
        { type: 'readMore', attrs: { articleId: 'nope', title: 'x' } },
        { type: 'keyFigures', attrs: { title: 'x', items: [], source: '' } },
        { type: 'editorNote', attrs: { kind: 'rumour', date: 'yesterday', text: 'Still kept as an update' } },
      ],
    };
    expect(sanitizeDoc(doc)).toEqual({
      type: 'doc',
      content: [{ type: 'editorNote', attrs: { kind: 'update', date: '', text: 'Still kept as an update' } }],
    });
  });

  it('returns an empty document for anything that is not a document', () => {
    expect(sanitizeDoc(null)).toEqual(EMPTY_DOC);
    expect(sanitizeDoc({ type: 'paragraph' })).toEqual(EMPTY_DOC);
    expect(sanitizeDoc('<p>hi</p>')).toEqual(EMPTY_DOC);
  });

  it('limits key figures to four and trims overlong text', () => {
    const items = Array.from({ length: 6 }, (_, i) => ({ value: String(i), label: 'x'.repeat(300) }));
    const clean = sanitizeDoc({ type: 'doc', content: [{ type: 'keyFigures', attrs: { title: '', items, source: '' } }] });
    const block = clean.content[0] as { attrs: { items: { label: string }[] } };
    expect(block.attrs.items).toHaveLength(4);
    expect(block.attrs.items[0].label).toHaveLength(120);
  });
});

describe('document text', () => {
  it('collects readable text for search and counting', () => {
    const doc = sanitizeDoc({
      type: 'doc',
      content: [
        p('Rice prices rose.'),
        { type: 'bulletList', content: [{ type: 'listItem', content: [p('Java')] }, { type: 'listItem', content: [p('Bali')] }] },
        { type: 'pullQuote', attrs: { text: 'Not done yet.', attribution: 'Minister' } },
        { type: 'youtube', attrs: { videoId: 'dQw4w9WgXcQ', title: 'Video title' } },
      ],
    });
    expect(docText(doc)).toBe('Rice prices rose.\nJava\nBali\nNot done yet.');
  });

  it('counts words, including numbers and contractions, and estimates reading time', () => {
    expect(wordCount('Indonesia’s GDP grew 5.1% in Q3, didn’t it?')).toBe(8);
    expect(wordCount('')).toBe(0);
    expect(readingMinutes(0)).toBe(0);
    expect(readingMinutes(1)).toBe(1);
    expect(readingMinutes(460)).toBe(2);
    expect(readingMinutes(461)).toBe(3);
  });
});
