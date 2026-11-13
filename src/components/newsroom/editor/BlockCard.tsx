'use client';

import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { createContext, useContext, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { Icon, type IconName } from '@/components/ds/Icon';
import { CloudImage } from '@/components/media/CloudImage';
import { ImagePickerDialog } from '@/components/media/ImagePickerDialog';
import { BlockDialog } from './BlockDialog';
import styles from './editor.module.css';
import type { SpecialKind } from './extensions';
import { MediaLookupContext } from './media-context';
import type { MediaItem } from '@/modules/media/types';

// How a special block looks inside the editor: a labelled card with a short preview, Edit and Remove.

export const ArticleIdContext = createContext('');

const META: Record<SpecialKind, { label: string; icon: IconName }> = {
  pullQuote: { label: 'Pull quote', icon: 'quote' },
  editorNote: { label: "Editor's note", icon: 'info' },
  keyFigures: { label: 'Key figures', icon: 'chart' },
  youtube: { label: 'YouTube video', icon: 'video' },
  readMore: { label: 'Read more', icon: 'link' },
  image: { label: 'Image', icon: 'image' },
  chart: { label: 'Chart', icon: 'trend' },
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
    case 'image':
      return String(attrs.caption || '');
    case 'chart':
      return `${attrs.title} · ${attrs.kind === 'line' ? 'line' : 'bar'} chart, ${(attrs.labels as string[]).length} rows`;
  }
}

export function BlockCard({ node, updateAttributes, deleteNode, selected, editor }: ReactNodeViewProps) {
  const kind = node.type.name as SpecialKind;
  const articleId = useContext(ArticleIdContext);
  const lookup = useContext(MediaLookupContext);
  const [editing, setEditing] = useState(false);
  const meta = META[kind];
  const editable = editor.isEditable;

  return (
    <NodeViewWrapper className={styles.card} data-selected={selected || undefined} contentEditable={false} data-drag-handle="">
      <p className={styles.cardLabel}>
        <Icon name={meta.icon} size={16} />
        {meta.label}
      </p>
      {kind === 'image' ? (
        <ImagePreview media={lookup.get(String(node.attrs.mediaId))} caption={String(node.attrs.caption ?? '')} />
      ) : (
        <p className={styles.cardText}>{summary(kind, node.attrs)}</p>
      )}
      {editable && (
        <div className={styles.cardActions}>
          <Button size="sm" variant="secondary" icon="edit" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button size="sm" variant="quiet" icon="trash" onClick={() => deleteNode()} aria-label={`Remove ${meta.label.toLowerCase()}`} />
        </div>
      )}
      {editing && kind === 'image' && (
        <ImagePickerDialog
          title="Image"
          initial={lookup.get(String(node.attrs.mediaId)) ?? null}
          caption={String(node.attrs.caption ?? '')}
          submitLabel="Save"
          onClose={() => setEditing(false)}
          onSave={({ media, caption }) => {
            lookup.remember(media);
            updateAttributes({ mediaId: media.id, caption });
            setEditing(false);
          }}
        />
      )}
      {editing && kind !== 'image' && (
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

function ImagePreview({ media, caption }: { media: MediaItem | undefined; caption: string }) {
  if (!media) return <p className={styles.cardText}>This image is no longer in the media library. Choose another or remove the block.</p>;
  return (
    <div className={styles.imageCard}>
      <CloudImage image={media} alt="" preset="card" sizes="160px" className={styles.imageThumb} />
      <div>
        <p className={styles.cardText}>{caption || <span className={styles.muted}>No caption</span>}</p>
        <p className={media.alt ? styles.altOk : styles.altMissing}>{media.alt ? `Alt text: ${media.alt}` : 'No alt text yet. Needed before publishing.'}</p>
      </div>
    </div>
  );
}
