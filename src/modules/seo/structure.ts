import type { Block, Doc, Inline, ListItem, Paragraph } from '@/lib/doc/schema';
import { docText, wordCount } from '@/lib/doc/text';

// What the analysis needs to know about an article body: prose (for sentences), paragraphs, headings,
// words per section, links, and images. Works on the stored document shape (src/lib/doc/schema.ts).

export type BodyLink = { href: string; text: string };

export type BodyStructure = {
  /** Every text line of the body (docText), for keyphrase counts. */
  text: string;
  words: number;
  /** Lines of running prose: paragraphs, list items, quotes and editor's notes. Not headings, captions or tables. */
  prose: string[];
  /** Top-level paragraphs only, for paragraph length. */
  paragraphs: string[];
  headings: { level: 2 | 3; text: string }[];
  /** Words before the first heading, then under each heading. */
  sectionWords: number[];
  links: BodyLink[];
  readMore: number;
  imageIds: string[];
};

function inlineText(nodes: Inline[] | undefined): string {
  return (nodes ?? [])
    .map((node) => (node.type === 'text' ? node.text : ' '))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function inlineLinks(nodes: Inline[] | undefined, out: BodyLink[]): void {
  let current: BodyLink | null = null;
  for (const node of nodes ?? []) {
    const href = node.type === 'text' ? node.marks?.find((mark) => mark.type === 'link')?.attrs.href : undefined;
    if (node.type === 'text' && href) {
      if (current && current.href === href) current.text += node.text;
      else {
        current = { href, text: node.text };
        out.push(current);
      }
    } else current = null;
  }
  for (const link of out) link.text = link.text.replace(/\s+/g, ' ').trim();
}

function listParagraphs(items: ListItem[], out: Paragraph[]): void {
  for (const item of items) {
    for (const child of item.content) {
      if (child.type === 'paragraph') out.push(child);
      else listParagraphs(child.content, out);
    }
  }
}

export function bodyStructure(doc: Doc): BodyStructure {
  const prose: string[] = [];
  const paragraphs: string[] = [];
  const headings: BodyStructure['headings'] = [];
  const sectionWords: number[] = [0];
  const links: BodyLink[] = [];
  const imageIds: string[] = [];
  let readMore = 0;

  const addProse = (text: string) => {
    if (text) prose.push(text);
  };

  for (const block of doc.content as Block[]) {
    switch (block.type) {
      case 'heading':
        headings.push({ level: block.attrs.level, text: inlineText(block.content) });
        inlineLinks(block.content, links);
        sectionWords.push(0);
        continue;
      case 'paragraph': {
        const text = inlineText(block.content);
        addProse(text);
        if (text) paragraphs.push(text);
        inlineLinks(block.content, links);
        break;
      }
      case 'bulletList':
      case 'orderedList': {
        const items: Paragraph[] = [];
        listParagraphs(block.content, items);
        for (const item of items) {
          addProse(inlineText(item.content));
          inlineLinks(item.content, links);
        }
        break;
      }
      case 'blockquote':
        for (const p of block.content) {
          addProse(inlineText(p.content));
          inlineLinks(p.content, links);
        }
        break;
      case 'table':
        for (const row of block.content) for (const cell of row.content) for (const p of cell.content) inlineLinks(p.content, links);
        break;
      case 'editorNote':
        addProse(block.attrs.text);
        break;
      case 'readMore':
        readMore += 1;
        break;
      case 'image':
        if (!imageIds.includes(block.attrs.mediaId)) imageIds.push(block.attrs.mediaId);
        break;
      default:
        break;
    }
    sectionWords[sectionWords.length - 1] += wordCount(docText({ type: 'doc', content: [block] }));
  }

  const text = docText(doc);
  return { text, words: wordCount(text), prose, paragraphs, headings, sectionWords, links, readMore, imageIds };
}

/** The first `count` words of the running text, as one string. */
export function firstWords(prose: string[], count: number): string {
  return prose.join(' ').split(/\s+/).slice(0, count).join(' ');
}

/** Links to this site: relative addresses, or absolute ones on the site's own host (with or without www). */
export function isInternal(href: string, siteHost: string): boolean {
  if (href.startsWith('/') && !href.startsWith('//')) return true;
  try {
    const host = new URL(href).hostname.replace(/^www\./, '');
    return host === siteHost.replace(/^www\./, '');
  } catch {
    return false;
  }
}
