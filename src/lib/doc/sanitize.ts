import {
  type Block,
  type Doc,
  EMPTY_DOC,
  type Inline,
  type KeyFigure,
  LIMITS,
  type ListItem,
  type Mark,
  type Paragraph,
  type TableCell,
  type TableRow,
  UUID,
  YOUTUBE_ID,
} from './schema';
import { cleanChart } from './chart';

// Rebuilds an editor document from scratch, keeping only the nodes, marks and attributes in
// schema.ts. Blocks that are not allowed where they appear become paragraphs, so text is not lost;
// empty or invalid special blocks are dropped. Runs on every save, whatever the browser sent.

type Raw = Record<string, unknown>;
type Context = 'doc' | 'quote' | 'item' | 'cell';

const TEXT_MAX = 20_000;
const SAFE_HREF = /^(https?:\/\/|mailto:|\/(?!\/)|#)/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SPECIAL = new Set(['pullQuote', 'editorNote', 'keyFigures', 'youtube', 'readMore', 'image', 'chart']);

const isObject = (value: unknown): value is Raw => typeof value === 'object' && value !== null && !Array.isArray(value);
const kids = (node: Raw): Raw[] => (Array.isArray(node.content) ? node.content.filter(isObject) : []);
const attrs = (node: Raw): Raw => (isObject(node.attrs) ? node.attrs : {});
const text = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max).trim() : '');
const int = (value: unknown, min: number, max: number, fallback: number) =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max ? (value as number) : fallback;
const isInlineNode = (node: Raw) => node.type === 'text' || node.type === 'hardBreak';

function cleanMarks(raw: unknown): Mark[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const marks: Mark[] = [];
  const seen = new Set<string>();
  for (const mark of raw) {
    if (!isObject(mark) || typeof mark.type !== 'string' || seen.has(mark.type)) continue;
    if (mark.type === 'bold' || mark.type === 'italic') {
      marks.push({ type: mark.type });
      seen.add(mark.type);
    } else if (mark.type === 'link') {
      const href = typeof attrs(mark).href === 'string' ? (attrs(mark).href as string).trim() : '';
      if (href.length <= 2000 && SAFE_HREF.test(href)) {
        marks.push({ type: 'link', attrs: { href } });
        seen.add('link');
      }
    }
  }
  return marks.length ? marks : undefined;
}

function cleanInline(nodes: Raw[]): Inline[] {
  const out: Inline[] = [];
  for (const node of nodes) {
    if (node.type === 'text' && typeof node.text === 'string' && node.text.length > 0) {
      const marks = cleanMarks(node.marks);
      out.push(marks ? { type: 'text', text: node.text.slice(0, TEXT_MAX), marks } : { type: 'text', text: node.text.slice(0, TEXT_MAX) });
    } else if (node.type === 'hardBreak') {
      out.push({ type: 'hardBreak' });
    } else {
      out.push(...cleanInline(kids(node)));
    }
  }
  return out;
}

function paragraph(nodes: Raw[]): Paragraph {
  const content = cleanInline(nodes);
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' };
}

function cleanItem(node: Raw): ListItem {
  const content = cleanBlocks(kids(node), 'item') as ListItem['content'];
  if (content[0]?.type !== 'paragraph') content.unshift({ type: 'paragraph' });
  return { type: 'listItem', content };
}

function cleanList(node: Raw): Block | null {
  const items = kids(node)
    .filter((child) => child.type === 'listItem')
    .map(cleanItem);
  if (!items.length) return null;
  if (node.type === 'orderedList') return { type: 'orderedList', attrs: { start: int(attrs(node).start, 1, 100_000, 1) }, content: items };
  return { type: 'bulletList', content: items };
}

function cleanTable(node: Raw): Block | null {
  const rows: TableRow[] = [];
  for (const row of kids(node).filter((child) => child.type === 'tableRow').slice(0, 100)) {
    const cells: TableCell[] = kids(row)
      .filter((cell) => cell.type === 'tableCell' || cell.type === 'tableHeader')
      .slice(0, 20)
      .map((cell) => {
        const content = cleanBlocks(kids(cell), 'cell') as Paragraph[];
        return {
          type: cell.type as TableCell['type'],
          attrs: { colspan: int(attrs(cell).colspan, 1, 20, 1), rowspan: int(attrs(cell).rowspan, 1, 100, 1) },
          content: content.length ? content : [{ type: 'paragraph' }],
        };
      });
    if (cells.length) rows.push({ type: 'tableRow', content: cells });
  }
  return rows.length ? { type: 'table', content: rows } : null;
}

function cleanSpecial(node: Raw): Block | null {
  const a = attrs(node);
  switch (node.type) {
    case 'pullQuote': {
      const quote = text(a.text, LIMITS.pullQuoteText);
      return quote ? { type: 'pullQuote', attrs: { text: quote, attribution: text(a.attribution, LIMITS.attribution) } } : null;
    }
    case 'editorNote': {
      const note = text(a.text, LIMITS.noteText);
      const date = typeof a.date === 'string' && DATE.test(a.date) ? a.date : '';
      return note ? { type: 'editorNote', attrs: { kind: a.kind === 'correction' ? 'correction' : 'update', date, text: note } } : null;
    }
    case 'keyFigures': {
      const items: KeyFigure[] = (Array.isArray(a.items) ? a.items.filter(isObject) : [])
        .map((item) => ({ value: text(item.value, LIMITS.figureValue), label: text(item.label, LIMITS.figureLabel) }))
        .filter((item) => item.value || item.label)
        .slice(0, LIMITS.figuresMax);
      if (!items.length) return null;
      return { type: 'keyFigures', attrs: { title: text(a.title, LIMITS.figuresTitle), items, source: text(a.source, LIMITS.figuresSource) } };
    }
    case 'youtube':
      return typeof a.videoId === 'string' && YOUTUBE_ID.test(a.videoId)
        ? { type: 'youtube', attrs: { videoId: a.videoId, title: text(a.title, LIMITS.videoTitle) } }
        : null;
    case 'readMore':
      return typeof a.articleId === 'string' && UUID.test(a.articleId)
        ? { type: 'readMore', attrs: { articleId: a.articleId.toLowerCase(), title: text(a.title, LIMITS.readMoreTitle) } }
        : null;
    case 'image':
      return typeof a.mediaId === 'string' && UUID.test(a.mediaId)
        ? { type: 'image', attrs: { mediaId: a.mediaId.toLowerCase(), caption: text(a.caption, LIMITS.imageCaption) } }
        : null;
    case 'chart': {
      const chart = cleanChart(a);
      return chart ? { type: 'chart', attrs: chart } : null;
    }
    default:
      return null;
  }
}

function cleanBlocks(nodes: Raw[], context: Context): Block[] {
  const out: Block[] = [];
  for (const node of nodes) {
    const type = node.type;
    const inDoc = context === 'doc';
    if (type === 'paragraph') {
      out.push(paragraph(kids(node)));
    } else if (type === 'heading' && inDoc) {
      const level = Number(attrs(node).level);
      const content = cleanInline(kids(node));
      out.push({ type: 'heading', attrs: { level: level <= 2 ? 2 : 3 }, ...(content.length ? { content } : {}) });
    } else if ((type === 'bulletList' || type === 'orderedList') && (inDoc || context === 'item')) {
      const list = cleanList(node);
      if (list) out.push(list);
    } else if (type === 'blockquote' && inDoc) {
      const content = cleanBlocks(kids(node), 'quote') as Paragraph[];
      if (content.length) out.push({ type: 'blockquote', content });
    } else if (type === 'horizontalRule' && inDoc) {
      out.push({ type: 'horizontalRule' });
    } else if (type === 'table' && inDoc) {
      const table = cleanTable(node);
      if (table) out.push(table);
    } else if (typeof type === 'string' && SPECIAL.has(type) && inDoc) {
      const block = cleanSpecial(node);
      if (block) out.push(block);
    } else {
      // Not allowed here: keep its text as a paragraph, or its blocks in this context.
      const children = kids(node);
      if (children.length && children.every(isInlineNode)) {
        const content = paragraph(children);
        if (content.content) out.push(content);
      } else if (children.length) {
        out.push(...cleanBlocks(children, context));
      }
    }
  }
  return out;
}

export function sanitizeDoc(input: unknown): Doc {
  if (!isObject(input) || input.type !== 'doc') return EMPTY_DOC;
  return { type: 'doc', content: cleanBlocks(kids(input), 'doc') };
}
