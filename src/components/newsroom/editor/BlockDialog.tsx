'use client';

import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ds/Button';
import { LIMITS } from '@/lib/doc/schema';
import { youtubeId } from '@/lib/doc/youtube';
import { toWibInput } from '@/lib/time';
import { findArticles } from '@/modules/editor/actions';
import { STATUS_LABELS } from '@/modules/editor/status';
import { SelectField, TextArea, TextField } from '../Field';
import forms from '../forms.module.css';
import ui from '../ui.module.css';
import styles from './editor.module.css';
import type { SpecialKind } from './extensions';

// One dialog for every special block (and for links), rendered in a portal outside the editor so
// typing in it never reaches the document. Each kind checks its own fields before saving.

export type DialogKind = SpecialKind | 'link';
type Attrs = Record<string, unknown>;

const TITLES: Record<DialogKind, string> = {
  pullQuote: 'Pull quote',
  editorNote: "Editor's note",
  keyFigures: 'Key figures',
  youtube: 'YouTube video',
  readMore: 'Read more',
  link: 'Link',
};

const SAFE_HREF = /^(https?:\/\/\S+|mailto:\S+|\/(?!\/)\S*|#\S*)$/i;

type Found = Awaited<ReturnType<typeof findArticles>>;

export function BlockDialog({
  kind,
  mode = 'edit',
  initial,
  articleId,
  onSave,
  onRemove,
  onClose,
}: {
  kind: DialogKind;
  mode?: 'insert' | 'edit';
  initial: Attrs;
  articleId: string;
  onSave: (attrs: Attrs) => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const [values, setValues] = useState<Attrs>(() => ({
    ...initial,
    ...(kind === 'editorNote' && !initial.date ? { date: toWibInput(new Date()).slice(0, 10) } : {}),
    ...(kind === 'keyFigures' ? { items: padFigures(initial.items) } : {}),
    ...(kind === 'youtube' ? { link: initial.videoId ?? '' } : {}),
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Found | null>(null);
  const [searching, setSearching] = useState(false);

  // Open as a modal on mount. No close() on cleanup: in development React runs effects twice, and a
  // close event from the first cleanup would dismiss the dialog straight away.
  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  const set = (key: string, value: unknown) => setValues((current) => ({ ...current, [key]: value }));
  const text = (key: string) => String(values[key] ?? '');

  function submit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    const problems: Record<string, string> = {};
    let attrs: Attrs = {};
    if (kind === 'pullQuote') {
      if (!text('text').trim()) problems.text = 'Write the quote.';
      attrs = { text: text('text').trim(), attribution: text('attribution').trim() };
    } else if (kind === 'editorNote') {
      if (!text('text').trim()) problems.text = 'Write what changed and why.';
      attrs = { kind: values.kind === 'correction' ? 'correction' : 'update', date: text('date'), text: text('text').trim() };
    } else if (kind === 'keyFigures') {
      const items = (values.items as { value: string; label: string }[])
        .map((item) => ({ value: item.value.trim(), label: item.label.trim() }))
        .filter((item) => item.value || item.label);
      if (items.length < 2) problems.items = 'Add at least two figures, each with a value and a label.';
      else if (items.some((item) => !item.value || !item.label)) problems.items = 'Each figure needs a value and a label.';
      attrs = { title: text('title').trim(), items, source: text('source').trim() };
    } else if (kind === 'youtube') {
      const videoId = youtubeId(text('link'));
      if (!videoId) problems.link = 'Paste a YouTube link, for example https://www.youtube.com/watch?v=…';
      if (!text('title').trim()) problems.title = 'Describe the video in a few words. Screen readers announce it.';
      attrs = { videoId, title: text('title').trim() };
    } else if (kind === 'readMore') {
      if (!values.articleId) problems.article = 'Choose an article.';
      attrs = { articleId: values.articleId, title: values.title };
    } else if (kind === 'link') {
      const href = text('href').trim();
      if (!SAFE_HREF.test(href)) problems.href = 'Use a full address starting with https://, or a site address starting with /.';
      attrs = { href };
    }
    setErrors(problems);
    if (Object.keys(problems).length) return;
    onSave(attrs);
  }

  async function search() {
    setSearching(true);
    try {
      setFound(await findArticles(query, articleId));
    } finally {
      setSearching(false);
    }
  }

  return createPortal(
    <dialog ref={dialog} className={`${ui.dialog} ${styles.blockDialog}`} aria-labelledby={`${uid}-heading`} onCancel={onClose} onClose={onClose}>
      <form className={forms.form} onSubmit={submit} noValidate>
        <h2 id={`${uid}-heading`} className={ui.dialogTitle}>
          {TITLES[kind]}
        </h2>

        {kind === 'pullQuote' && (
          <>
            <TextArea id={`${uid}-text`} label="Quote" rows={3} value={text('text')} onChange={(e) => set('text', e.target.value)} error={errors.text} maxLength={LIMITS.pullQuoteText} />
            <TextField
              id={`${uid}-attribution`}
              label="Who said it"
              optional
              value={text('attribution')}
              onChange={(e) => set('attribution', e.target.value)}
              placeholder="Sri Mulyani, finance minister"
              maxLength={LIMITS.attribution}
            />
          </>
        )}

        {kind === 'editorNote' && (
          <>
            <div className={forms.row}>
              <SelectField id={`${uid}-kind`} label="Type" value={text('kind') || 'update'} onChange={(e) => set('kind', e.target.value)}>
                <option value="update">Update</option>
                <option value="correction">Correction</option>
              </SelectField>
              <TextField id={`${uid}-date`} label="Date" type="date" value={text('date')} onChange={(e) => set('date', e.target.value)} />
            </div>
            <TextArea id={`${uid}-text`} label="Note" rows={3} value={text('text')} onChange={(e) => set('text', e.target.value)} error={errors.text} maxLength={LIMITS.noteText} hint="Say what changed. Corrections name the earlier mistake." />
          </>
        )}

        {kind === 'keyFigures' && (
          <>
            <TextField id={`${uid}-title`} label="Heading" optional value={text('title')} onChange={(e) => set('title', e.target.value)} placeholder="The harvest in numbers" maxLength={LIMITS.figuresTitle} />
            <fieldset className={forms.fieldset}>
              <legend className={forms.label}>Figures (two to four)</legend>
              {errors.items && <p className={forms.error}>{errors.items}</p>}
              {(values.items as { value: string; label: string }[]).map((item, index) => (
                <div className={styles.figureRow} key={index}>
                  <TextField
                    id={`${uid}-value-${index}`}
                    label={`Figure ${index + 1}`}
                    value={item.value}
                    onChange={(e) => set('items', updateItem(values.items, index, 'value', e.target.value))}
                    placeholder={index === 0 ? '31.5m' : undefined}
                    maxLength={LIMITS.figureValue}
                    mono
                  />
                  <TextField
                    id={`${uid}-label-${index}`}
                    label={`Label ${index + 1}`}
                    value={item.label}
                    onChange={(e) => set('items', updateItem(values.items, index, 'label', e.target.value))}
                    placeholder={index === 0 ? 'tonnes of rice this season' : undefined}
                    maxLength={LIMITS.figureLabel}
                  />
                </div>
              ))}
            </fieldset>
            <TextField id={`${uid}-source`} label="Source" optional value={text('source')} onChange={(e) => set('source', e.target.value)} placeholder="Statistics Indonesia (BPS)" maxLength={LIMITS.figuresSource} />
          </>
        )}

        {kind === 'youtube' && (
          <>
            <TextField id={`${uid}-link`} label="YouTube link" value={text('link')} onChange={(e) => set('link', e.target.value)} error={errors.link} placeholder="https://www.youtube.com/watch?v=…" mono />
            <TextField
              id={`${uid}-title`}
              label="What the video shows"
              value={text('title')}
              onChange={(e) => set('title', e.target.value)}
              error={errors.title}
              maxLength={LIMITS.videoTitle}
              hint="The player loads only when a reader presses play."
            />
          </>
        )}

        {kind === 'readMore' && (
          <>
            {Boolean(values.articleId) && (
              <p className={styles.chosen}>
                Linked: <b>{text('title') || 'Untitled'}</b>
              </p>
            )}
            <div className={styles.searchRow}>
              <TextField
                id={`${uid}-query`}
                label="Find an article"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void search();
                  }
                }}
                error={errors.article}
              />
              <Button onClick={() => void search()} disabled={searching}>
                {searching ? 'Searching…' : 'Search'}
              </Button>
            </div>
            {found && (
              <ul className={styles.results} aria-label="Search results">
                {found.length === 0 && <li className={forms.hint}>No articles match.</li>}
                {found.map((article) => (
                  <li key={article.id}>
                    <button
                      type="button"
                      className={styles.result}
                      aria-pressed={values.articleId === article.id}
                      onClick={() => setValues((current) => ({ ...current, articleId: article.id, title: article.title || 'Untitled' }))}
                    >
                      <span>{article.title || 'Untitled'}</span>
                      <small>
                        {article.section?.name ?? 'No section'} · {STATUS_LABELS[article.status]}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {kind === 'link' && (
          <TextField id={`${uid}-href`} label="Address" value={text('href')} onChange={(e) => set('href', e.target.value)} error={errors.href} placeholder="https://" mono />
        )}

        <div className={ui.dialogActions}>
          {onRemove && (
            <Button type="button" variant="quiet" onClick={onRemove} className={styles.remove}>
              {kind === 'link' ? 'Remove link' : 'Remove block'}
            </Button>
          )}
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {mode === 'insert' ? 'Insert' : 'Save'}
          </Button>
        </div>
      </form>
    </dialog>,
    document.body,
  );
}

function padFigures(items: unknown) {
  const list = Array.isArray(items) ? (items as { value: string; label: string }[]).map((item) => ({ value: item.value ?? '', label: item.label ?? '' })) : [];
  while (list.length < LIMITS.figuresMax) list.push({ value: '', label: '' });
  return list;
}

function updateItem(items: unknown, index: number, key: 'value' | 'label', value: string) {
  return (items as { value: string; label: string }[]).map((item, i) => (i === index ? { ...item, [key]: value } : item));
}
