'use client';

import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { TextArea, TextField } from '@/components/newsroom/Field';
import forms from '@/components/newsroom/forms.module.css';
import ui from '@/components/newsroom/ui.module.css';
import { saveMediaDetails, searchMedia } from '@/modules/media/actions';
import type { MediaItem } from '@/modules/media/types';
import { ACCEPTED_TYPES, MEDIA_LIMITS } from '@/modules/media/validate';
import { CloudImage } from './CloudImage';
import styles from './media.module.css';
import { uploadImage } from './upload';

// Choose an image from the library or upload a new one, then confirm its alt text (stored on the
// image), credit, and the caption for this use. Rendered in a portal, outside the article editor.

export type PickedImage = { media: MediaItem; caption: string };

export function ImagePickerDialog({
  title,
  initial,
  caption,
  submitLabel,
  onSave,
  onClose,
}: {
  title: string;
  initial: MediaItem | null;
  /** The caption for this use; null hides the field (it is edited elsewhere). */
  caption: string | null;
  submitLabel: string;
  onSave: (picked: PickedImage) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MediaItem | null>(initial);
  const [alt, setAlt] = useState(initial?.alt ?? '');
  const [credit, setCredit] = useState(initial?.credit ?? '');
  const [captionValue, setCaptionValue] = useState(caption ?? '');
  const [uploading, setUploading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Open as a modal on mount. No close() on cleanup (React runs effects twice in development).
  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  const load = useCallback(async (q: string, nextPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await searchMedia(q, nextPage);
      setItems((current) => (nextPage === 1 ? result.items : [...current, ...result.items]));
      setTotal(result.total);
      setPage(nextPage);
    } catch {
      setError('The media library could not be loaded. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // First page of the library when the dialog opens.
  useEffect(() => {
    let active = true;
    searchMedia('', 1)
      .then((result) => {
        if (!active) return;
        setItems(result.items);
        setTotal(result.total);
      })
      .catch(() => active && setError('The media library could not be loaded. Try again.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  function choose(item: MediaItem) {
    setSelected(item);
    setAlt(item.alt);
    setCredit(item.credit);
    if (caption !== null && (!captionValue || captionValue === selected?.caption)) setCaptionValue(item.caption);
    setFieldErrors({});
  }

  async function upload(file: File) {
    setError(null);
    setUploading(0);
    try {
      const media = await uploadImage(file, setUploading);
      setItems((current) => [media, ...current.filter((item) => item.id !== media.id)]);
      setTotal((current) => current + 1);
      choose(media);
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setUploading(null);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!selected) {
      setError('Choose an image or upload one.');
      return;
    }
    let media = selected;
    if (alt.trim() !== selected.alt || credit.trim() !== selected.credit) {
      setSaving(true);
      const result = await saveMediaDetails(selected.id, { alt, credit, caption: selected.caption });
      setSaving(false);
      if (!result.ok) {
        setFieldErrors((result.errors as Record<string, string>) ?? {});
        if (result.error) setError(result.error);
        return;
      }
      media = result.media;
    }
    onSave({ media, caption: captionValue.trim() });
  }

  return createPortal(
    <dialog ref={dialog} className={`${ui.dialog} ${styles.picker}`} aria-labelledby={`${uid}-heading`} onCancel={onClose} onClose={onClose}>
      <form className={styles.pickerForm} onSubmit={submit} noValidate>
        <h2 id={`${uid}-heading`} className={ui.dialogTitle}>
          {title}
        </h2>

        <div className={styles.pickerBar}>
          <label htmlFor={`${uid}-file`} className={styles.uploadLabel} data-disabled={uploading !== null ? '' : undefined}>
            <Icon name="plus" size={18} />
            {uploading !== null ? `Uploading ${Math.round(uploading * 100)}%` : 'Upload an image'}
          </label>
          <input
            id={`${uid}-file`}
            className={styles.fileInput}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            disabled={uploading !== null}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void upload(file);
            }}
          />
          <div className={styles.pickerSearch}>
            <input
              type="search"
              aria-label="Search the media library"
              placeholder="Search alt text, captions, file names"
              className={styles.searchInput}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void load(query, 1);
                }
              }}
            />
            <Button size="sm" onClick={() => void load(query, 1)} disabled={loading}>
              Search
            </Button>
          </div>
        </div>

        {error && <p className={forms.error}>{error}</p>}

        <ul className={styles.pickerGrid} aria-label="Images">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={styles.pickerItem}
                aria-pressed={selected?.id === item.id}
                aria-label={`${item.alt || item.originalName || 'Image without alt text'}${item.alt ? '' : ' (no alt text)'}`}
                onClick={() => choose(item)}
              >
                <CloudImage image={item} alt="" preset="square" sizes="120px" className={styles.thumb} />
                {!item.alt && <span className={styles.noAlt}>No alt</span>}
              </button>
            </li>
          ))}
        </ul>
        {!loading && items.length === 0 && <p className={forms.hint}>{query ? 'No images match.' : 'The library is empty. Upload the first image.'}</p>}
        {items.length < total && (
          <Button size="sm" variant="quiet" onClick={() => void load(query, page + 1)} disabled={loading}>
            {loading ? 'Loading…' : 'Show more'}
          </Button>
        )}

        {selected && (
          <div className={styles.pickerDetails}>
            <CloudImage image={selected} alt="" preset="original" sizes="200px" className={styles.preview} />
            <div className={styles.pickerFields}>
              <TextArea
                id={`${uid}-alt`}
                label="Alt text"
                rows={2}
                value={alt}
                onChange={(event) => setAlt(event.target.value)}
                maxLength={MEDIA_LIMITS.alt}
                error={fieldErrors.alt}
                hint="Describe the image for readers who cannot see it. Needed before publishing. Saved with the image."
              />
              {caption !== null && (
                <TextArea
                  id={`${uid}-caption`}
                  label="Caption"
                  optional
                  rows={2}
                  value={captionValue}
                  onChange={(event) => setCaptionValue(event.target.value)}
                  maxLength={MEDIA_LIMITS.caption}
                  hint="Shown under the image in this article."
                />
              )}
              <TextField
                id={`${uid}-credit`}
                label="Credit"
                optional
                value={credit}
                onChange={(event) => setCredit(event.target.value)}
                maxLength={MEDIA_LIMITS.credit}
                error={fieldErrors.credit}
                placeholder="Rani Prameswari/PressCompass"
              />
            </div>
          </div>
        )}

        <div className={ui.dialogActions}>
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!selected || saving || uploading !== null}>
            {saving ? 'Saving…' : submitLabel}
          </Button>
        </div>
      </form>
    </dialog>,
    document.body,
  );
}
