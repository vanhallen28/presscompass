'use client';

import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { createContext, useContext, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { Icon, type IconName } from '@/components/ds/Icon';
import { BlockDialog } from './BlockDialog';
import styles from './editor.module.css';
import type { SpecialKind } from './extensions';

// How a special block looks inside the editor: a labelled card with a short preview, Edit and Remove.

export const ArticleIdContext = createContext('');

const META: Record<SpecialKind, { label: string; icon: IconName }> = {
  pullQuote: { label: 'Pull quote', icon: 'quote' },
  editorNote: { label: "Editor's note", icon: 'info' },
  keyFigures: { label: 'Key figures', icon: 'chart' },
  youtube: { label: 'YouTube video', icon: 'video' },
  readMore: { label: 'Read more', icon: 'link' },
};

function summary(kind: SpecialKind, attrs: Record<string, unknown>) {
  switch (kind) {
    case 'pullQuote':
      return `“${attrs.text}”${attrs.attribution ? ` — ${attrs.attribution}` : ''}`;
    case 'editorNote':
      return `${attrs.kind === 'correction' ? 'Correction' : 'Update'}${attrs.date ? ` (${attrs.date})` : ''}: ${attrs.text}`;
    case 'keyFigures':
      return (attrs.items as { value: string; label: string }[]).map((item) => `${item.value} ${item.label}`).join(' · ');
    case 'youtube':
      return `${attrs.title} (youtube.com/watch?v=${attrs.videoId})`;
    case 'readMore':
      return String(attrs.title || 'Untitled');
  }
}

export function BlockCard({ node, updateAttributes, deleteNode, selected, editor }: ReactNodeViewProps) {
  const kind = node.type.name as SpecialKind;
  const articleId = useContext(ArticleIdContext);
  const [editing, setEditing] = useState(false);
  const meta = META[kind];
  const editable = editor.isEditable;

  return (
    <NodeViewWrapper className={styles.card} data-selected={selected || undefined} contentEditable={false} data-drag-handle="">
      <p className={styles.cardLabel}>
        <Icon name={meta.icon} size={16} />
        {meta.label}
      </p>
      <p className={styles.cardText}>{summary(kind, node.attrs)}</p>
      {editable && (
        <div className={styles.cardActions}>
          <Button size="sm" variant="secondary" icon="edit" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button size="sm" variant="quiet" icon="trash" onClick={() => deleteNode()} aria-label={`Remove ${meta.label.toLowerCase()}`} />
        </div>
      )}
      {editing && (
        <BlockDialog
          kind={kind}
          initial={node.attrs}
          articleId={articleId}
          onClose={() => setEditing(false)}
          onRemove={() => {
            setEditing(false);
            deleteNode();
          }}
          onSave={(attrs) => {
            updateAttributes(attrs);
            setEditing(false);
          }}
        />
      )}
    </NodeViewWrapper>
  );
}
