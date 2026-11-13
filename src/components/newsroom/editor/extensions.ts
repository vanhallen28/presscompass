import { Node } from '@tiptap/core';
import { Blockquote } from '@tiptap/extension-blockquote';
import { ListItem } from '@tiptap/extension-list';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import { type ReactNodeViewProps, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { ComponentType } from 'react';

// The editor schema matches src/lib/doc/schema.ts exactly, so what you see is what is saved.
// Special blocks are atoms edited through a dialog (BlockCard + BlockDialog).

export const SPECIAL_DEFAULTS = {
  pullQuote: { text: '', attribution: '' },
  editorNote: { kind: 'update', date: '', text: '' },
  keyFigures: { title: '', items: [], source: '' },
  youtube: { videoId: '', title: '' },
  readMore: { articleId: '', title: '' },
  image: { mediaId: '', caption: '' },
  chart: { kind: 'bar', title: '', subtitle: '', source: '', axis: '', labels: [], series: [] },
} as const;

export type SpecialKind = keyof typeof SPECIAL_DEFAULTS;

function special(name: SpecialKind, view: ComponentType<ReactNodeViewProps>) {
  const defaults = SPECIAL_DEFAULTS[name] as Record<string, unknown>;
  return Node.create({
    name,
    group: 'block',
    atom: true,
    selectable: true,
    draggable: true,
    addAttributes() {
      return Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, { default: value, rendered: false }]));
    },
    parseHTML() {
      return [
        {
          tag: `div[data-block="${name}"]`,
          getAttrs: (element) => {
            try {
              return JSON.parse((element as HTMLElement).getAttribute('data-attrs') ?? '{}');
            } catch {
              return false;
            }
          },
        },
      ];
    },
    renderHTML({ node }) {
      return ['div', { 'data-block': name, 'data-attrs': JSON.stringify(node.attrs) }];
    },
    addNodeView() {
      return ReactNodeViewRenderer(view);
    },
  });
}

export function editorExtensions(view: ComponentType<ReactNodeViewProps>) {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      blockquote: false,
      listItem: false,
      code: false,
      codeBlock: false,
      strike: false,
      underline: false,
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        protocols: ['http', 'https', 'mailto'],
        HTMLAttributes: { rel: 'noopener', target: null },
      },
    }),
    Blockquote.extend({ content: 'paragraph+' }),
    ListItem.extend({ content: 'paragraph (paragraph | bulletList | orderedList)*' }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader.extend({ content: 'paragraph+' }),
    TableCell.extend({ content: 'paragraph+' }),
    Placeholder.configure({ placeholder: 'Start writing. Use H2 for section headings.' }),
    ...(Object.keys(SPECIAL_DEFAULTS) as SpecialKind[]).map((name) => special(name, view)),
  ];
}
