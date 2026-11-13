import type { Block, Doc, Inline, ListItem } from './schema';

const WORD = /[\p{L}\p{N}]+(?:['’.\-][\p{L}\p{N}]+)*/gu;
const WORDS_PER_MINUTE = 230;

function inlineText(nodes: Inline[] | undefined): string {
  return (nodes ?? [])
    .map((node) => (node.type === 'text' ? node.text : ' '))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function collect(blocks: (Block | ListItem)[], lines: string[]): void {
  for (const block of blocks) {
    switch (block.type) {
      case 'paragraph':
      case 'heading':
        lines.push(inlineText(block.content));
        break;
      case 'bulletList':
      case 'orderedList':
      case 'listItem':
      case 'blockquote':
        collect(block.content as (Block | ListItem)[], lines);
        break;
      case 'table':
        for (const row of block.content) for (const cell of row.content) collect(cell.content, lines);
        break;
      case 'pullQuote':
      case 'editorNote':
        lines.push(block.attrs.text);
        break;
      case 'keyFigures':
        lines.push(block.attrs.title, ...block.attrs.items.map((item) => `${item.value} ${item.label}`.trim()));
        break;
      case 'image':
        lines.push(block.attrs.caption);
        break;
      case 'chart':
        lines.push(block.attrs.title, block.attrs.subtitle);
        break;
      default:
        break;
    }
  }
}

/** Plain text of the body, one line per block, for search and word counts. */
export function docText(doc: Doc): string {
  const lines: string[] = [];
  collect(doc.content, lines);
  return lines.filter(Boolean).join('\n');
}

export function wordCount(text: string): number {
  return text.match(WORD)?.length ?? 0;
}

export function readingMinutes(words: number): number {
  return words > 0 ? Math.ceil(words / WORDS_PER_MINUTE) : 0;
}

/** Media ids of the images in the text, in order, each once. */
export function bodyMediaIds(doc: Doc): string[] {
  const ids: string[] = [];
  for (const block of doc.content) if (block.type === 'image' && !ids.includes(block.attrs.mediaId)) ids.push(block.attrs.mediaId);
  return ids;
}
