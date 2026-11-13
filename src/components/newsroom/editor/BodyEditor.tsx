'use client';

import { NodeSelection } from '@tiptap/pm/state';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { type Ref, useContext, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { Icon, type IconName } from '@/components/ds/Icon';
import type { Doc } from '@/lib/doc/schema';
import { ImagePickerDialog } from '@/components/media/ImagePickerDialog';
import { ArticleIdContext, BlockCard } from './BlockCard';
import { BlockDialog, type DialogKind } from './BlockDialog';
import styles from './editor.module.css';
import { editorExtensions, SPECIAL_DEFAULTS, type SpecialKind } from './extensions';
import { MediaLookupContext } from './media-context';

export type BodyEditorHandle = { getJSON: () => unknown; getText: () => string; focus: () => void };

type Tool = { label: string; icon?: IconName; text?: string; active?: boolean; disabled?: boolean; run: () => void };

/** The article body: Tiptap with the PressCompass blocks and a formatting toolbar. */
export function BodyEditor({
  ref,
  initial,
  articleId,
  editable,
  invalid,
  describedBy,
  onChange,
}: {
  ref: Ref<BodyEditorHandle>;
  initial: Doc;
  articleId: string;
  editable: boolean;
  invalid?: boolean;
  describedBy?: string;
  onChange: (text: string) => void;
}) {
  const extensions = useMemo(() => editorExtensions(BlockCard), []);
  const [dialog, setDialog] = useState<{ kind: DialogKind; attrs: Record<string, unknown>; mode: 'insert' | 'edit' } | null>(null);
  const [picking, setPicking] = useState(false);
  const lookup = useContext(MediaLookupContext);

  const editor = useEditor({
    extensions,
    // ProseMirror needs at least one block; a new article is stored with an empty content list.
    content: initial.content.length ? initial : { type: 'doc', content: [{ type: 'paragraph' }] },
    editable,
    immediatelyRender: false,
    editorProps: { attributes: textboxAttributes(invalid, describedBy) },
    onUpdate: ({ editor: current }) => onChange(current.getText()),
  });

  useEffect(() => {
    editor?.setOptions({ editorProps: { attributes: textboxAttributes(invalid, describedBy) } });
  }, [editor, invalid, describedBy]);

  useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable);
  }, [editor, editable]);

  useImperativeHandle(ref, () => ({
    // ProseMirror keeps attributes in null-prototype objects, which Server Action arguments drop.
    // A JSON round trip turns the document into plain objects.
    getJSON: () => JSON.parse(JSON.stringify(editor?.getJSON() ?? initial)),
    getText: () => editor?.getText() ?? '',
    focus: () => editor?.commands.focus(),
  }));

  // The store's editor stays null until the first transaction, so fall back to the instance itself.
  const state = useEditorState({
    editor,
    selector: ({ editor: fromStore }) => {
      const e = fromStore ?? editor;
      return e
        ? {
            h2: e.isActive('heading', { level: 2 }),
            h3: e.isActive('heading', { level: 3 }),
            bold: e.isActive('bold'),
            italic: e.isActive('italic'),
            link: e.isActive('link'),
            bullet: e.isActive('bulletList'),
            ordered: e.isActive('orderedList'),
            quote: e.isActive('blockquote'),
            table: e.isActive('table'),
            canUndo: e.can().undo(),
            canRedo: e.can().redo(),
          }
        : null;
    },
  });

  if (!editor || !state) return <div className={styles.bodyLoading} aria-hidden="true" />;

  const chain = () => editor.chain().focus();
  const insert = (kind: SpecialKind) => setDialog({ kind, attrs: { ...SPECIAL_DEFAULTS[kind] }, mode: 'insert' });
  // Insert after a selected block instead of replacing it, and leave a paragraph to keep writing in.
  const insertBlock = (type: string, attrs: Record<string, unknown>) => {
    const { selection } = editor.state;
    const content = [{ type, attrs }, { type: 'paragraph' }];
    if (selection instanceof NodeSelection) chain().insertContentAt(selection.to, content).run();
    else chain().insertContent(content).run();
  };

  const groups: Tool[][] = [
    [
      { label: 'H2 heading', text: 'H2', active: state.h2, run: () => chain().toggleHeading({ level: 2 }).run() },
      { label: 'H3 subheading', text: 'H3', active: state.h3, run: () => chain().toggleHeading({ level: 3 }).run() },
    ],
    [
      { label: 'Bold', icon: 'bold', active: state.bold, run: () => chain().toggleBold().run() },
      { label: 'Italic', icon: 'italic', active: state.italic, run: () => chain().toggleItalic().run() },
      {
        label: 'Link',
        icon: 'link',
        active: state.link,
        run: () => setDialog({ kind: 'link', attrs: { href: editor.getAttributes('link').href ?? '' }, mode: state.link ? 'edit' : 'insert' }),
      },
    ],
    [
      { label: 'Bulleted list', icon: 'list', active: state.bullet, run: () => chain().toggleBulletList().run() },
      { label: 'Numbered list', icon: 'list-ordered', active: state.ordered, run: () => chain().toggleOrderedList().run() },
      { label: 'Quote', icon: 'quote', active: state.quote, run: () => chain().toggleBlockquote().run() },
      { label: 'Divider', icon: 'minus', run: () => chain().setHorizontalRule().run() },
      { label: 'Table', icon: 'table', active: state.table, run: () => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    ],
    [
      { label: 'Image', icon: 'image', run: () => setPicking(true) },
      { label: 'Pull quote', text: 'Pull quote', run: () => insert('pullQuote') },
      { label: 'Key figures', text: 'Figures', run: () => insert('keyFigures') },
      { label: "Editor's note", text: 'Note', run: () => insert('editorNote') },
      { label: 'YouTube video', icon: 'video', run: () => insert('youtube') },
      { label: 'Read more card', text: 'Read more', run: () => insert('readMore') },
    ],
    [
      { label: 'Undo', icon: 'undo', disabled: !state.canUndo, run: () => chain().undo().run() },
      { label: 'Redo', icon: 'redo', disabled: !state.canRedo, run: () => chain().redo().run() },
    ],
  ];

  const tableTools: Tool[] = [
    { label: 'Add row', text: 'Add row', run: () => chain().addRowAfter().run() },
    { label: 'Add column', text: 'Add column', run: () => chain().addColumnAfter().run() },
    { label: 'Delete row', text: 'Delete row', run: () => chain().deleteRow().run() },
    { label: 'Delete column', text: 'Delete column', run: () => chain().deleteColumn().run() },
    { label: 'Delete table', text: 'Delete table', run: () => chain().deleteTable().run() },
  ];

  const button = (tool: Tool) => (
    <button
      key={tool.label}
      type="button"
      className={styles.tool}
      aria-label={tool.label}
      title={tool.label}
      aria-pressed={tool.active === undefined ? undefined : tool.active}
      disabled={tool.disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={tool.run}
    >
      {tool.icon ? <Icon name={tool.icon} size={18} /> : tool.text}
    </button>
  );

  return (
    <ArticleIdContext value={articleId}>
      <div className={styles.body} data-invalid={invalid || undefined}>
        {editable && (
          <div className={styles.toolbar} role="toolbar" aria-label="Formatting">
            {groups.map((group, index) => (
              <div key={index} className={styles.toolGroup}>
                {group.map(button)}
              </div>
            ))}
            {state.table && (
              <div className={`${styles.toolGroup} ${styles.tableTools}`} role="group" aria-label="Table">
                {tableTools.map(button)}
              </div>
            )}
          </div>
        )}
        <EditorContent editor={editor} />
      </div>
      {dialog && (
        <BlockDialog
          kind={dialog.kind}
          mode={dialog.mode}
          initial={dialog.attrs}
          articleId={articleId}
          onClose={() => setDialog(null)}
          onRemove={dialog.kind === 'link' && dialog.mode === 'edit' ? () => {
            chain().extendMarkRange('link').unsetLink().run();
            setDialog(null);
          } : undefined}
          onSave={(attrs) => {
            if (dialog.kind === 'link') {
              const href = String(attrs.href);
              if (editor.state.selection.empty && !state.link) chain().insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run();
              else chain().extendMarkRange('link').setLink({ href }).run();
            } else {
              insertBlock(dialog.kind, attrs);
            }
            setDialog(null);
          }}
        />
      )}
      {picking && (
        <ImagePickerDialog
          title="Insert an image"
          initial={null}
          caption=""
          submitLabel="Insert"
          onClose={() => setPicking(false)}
          onSave={({ media, caption }) => {
            lookup.remember(media);
            insertBlock('image', { mediaId: media.id, caption });
            setPicking(false);
          }}
        />
      )}
    </ArticleIdContext>
  );
}

function textboxAttributes(invalid?: boolean, describedBy?: string): Record<string, string> {
  return {
    class: styles.prose,
    role: 'textbox',
    'aria-multiline': 'true',
    'aria-label': 'Article text',
    ...(invalid ? { 'aria-invalid': 'true' } : {}),
    ...(describedBy ? { 'aria-describedby': describedBy } : {}),
  };
}
