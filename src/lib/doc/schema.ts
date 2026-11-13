import type { ChartAttrs } from './chart';

// The article body is stored as the editor's JSON document (Tiptap/ProseMirror) restricted to these nodes.
// src/lib/doc/sanitize.ts enforces this shape on every save; the site renders it with ArticleBody.

export type Mark = { type: 'bold' } | { type: 'italic' } | { type: 'link'; attrs: { href: string } };

export type TextNode = { type: 'text'; text: string; marks?: Mark[] };
export type HardBreak = { type: 'hardBreak' };
export type Inline = TextNode | HardBreak;

export type Paragraph = { type: 'paragraph'; content?: Inline[] };
export type Heading = { type: 'heading'; attrs: { level: 2 | 3 }; content?: Inline[] };
export type ListItem = { type: 'listItem'; content: (Paragraph | BulletList | OrderedList)[] };
export type BulletList = { type: 'bulletList'; content: ListItem[] };
export type OrderedList = { type: 'orderedList'; attrs: { start: number }; content: ListItem[] };
export type Blockquote = { type: 'blockquote'; content: Paragraph[] };
export type HorizontalRule = { type: 'horizontalRule' };
export type TableCell = { type: 'tableCell' | 'tableHeader'; attrs: { colspan: number; rowspan: number }; content: Paragraph[] };
export type TableRow = { type: 'tableRow'; content: TableCell[] };
export type Table = { type: 'table'; content: TableRow[] };

export type PullQuote = { type: 'pullQuote'; attrs: { text: string; attribution: string } };
export type EditorNote = { type: 'editorNote'; attrs: { kind: 'update' | 'correction'; date: string; text: string } };
export type KeyFigure = { value: string; label: string };
export type KeyFigures = { type: 'keyFigures'; attrs: { title: string; items: KeyFigure[]; source: string } };
export type YouTube = { type: 'youtube'; attrs: { videoId: string; title: string } };
export type ReadMore = { type: 'readMore'; attrs: { articleId: string; title: string } };
/** An image from the media library. Alt text and credit come from the media item; the caption is per use. */
export type ImageBlock = { type: 'image'; attrs: { mediaId: string; caption: string } };
/** A bar or line chart drawn by the site (src/lib/doc/chart.ts). */
export type ChartBlock = { type: 'chart'; attrs: ChartAttrs };

export type Block =
  | Paragraph
  | Heading
  | BulletList
  | OrderedList
  | Blockquote
  | HorizontalRule
  | Table
  | PullQuote
  | EditorNote
  | KeyFigures
  | YouTube
  | ReadMore
  | ImageBlock
  | ChartBlock;

export type Doc = { type: 'doc'; content: Block[] };

export const EMPTY_DOC: Doc = { type: 'doc', content: [] };

/** Character limits for the special blocks, shared by the editor dialogs and the sanitizer. */
export const LIMITS = {
  pullQuoteText: 500,
  attribution: 120,
  noteText: 1000,
  figuresTitle: 120,
  figureValue: 24,
  figureLabel: 120,
  figuresSource: 200,
  figuresMax: 4,
  videoTitle: 200,
  readMoreTitle: 200,
  imageCaption: 300,
} as const;

export const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
