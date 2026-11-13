'use client';

import { useId, useMemo, useRef, useState, useTransition } from 'react';
import { Button, ButtonLink } from '@/components/ds/Button';
import { ConfirmButton } from '@/components/newsroom/ConfirmButton';
import { BodyEditor, type BodyEditorHandle } from '@/components/newsroom/editor/BodyEditor';
import { type MediaLookup, MediaLookupContext } from '@/components/newsroom/editor/media-context';
import { TextArea, TextField } from '@/components/newsroom/Field';
import forms from '@/components/newsroom/forms.module.css';
import { Notice, PageHeader } from '@/components/newsroom/ui';
import type { Doc } from '@/lib/doc/schema';
import { slugify } from '@/lib/slug';
import { formatWib } from '@/lib/time';
import type { MediaItem } from '@/modules/media/types';
import { deletePage, type PageSaveResult, savePage } from '@/modules/pages/actions';
import type { PageRow } from '@/modules/pages/queries';
import { PAGE_LIMITS, type PageErrors, type PageIntent } from '@/modules/pages/validate';

/** Editor for a static page: title, address, description and the same block editor as articles. */
export function PageEditor({ page, media, notice }: { page: PageRow & { body: Doc }; media: MediaItem[]; notice: string | null }) {
  const uid = useId();
  const body = useRef<BodyEditorHandle>(null);
  const [title, setTitle] = useState(page.title);
  const [slug, setSlug] = useState(page.slug);
  const [slugTouched, setSlugTouched] = useState(Boolean(page.title) || !page.slug.startsWith('new-page-'));
  const [description, setDescription] = useState(page.description);
  const [status, setStatus] = useState(page.status);
  const [savedAt, setSavedAt] = useState(page.updatedAt);
  const [errors, setErrors] = useState<PageErrors>({});
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(notice ? { tone: 'error', text: notice } : null);
  const [pending, startTransition] = useTransition();
  const [known, setKnown] = useState(() => new Map(media.map((item) => [item.id, item])));
  const lookup = useMemo<MediaLookup>(
    () => ({ get: (id) => known.get(id), remember: (item) => setKnown((current) => new Map(current).set(item.id, item)) }),
    [known],
  );

  const save = (intent: PageIntent) =>
    startTransition(async () => {
      const result: PageSaveResult = await savePage({ id: page.id, title, slug, description, body: body.current?.getJSON(), intent });
      if (result.ok) {
        setErrors({});
        setStatus(result.status);
        setSavedAt(result.updatedAt);
        setMessage({ tone: 'success', text: result.message });
      } else {
        setErrors(result.errors);
        setMessage({ tone: 'error', text: result.message });
      }
    });

  const published = status === 'published';

  return (
    <MediaLookupContext value={lookup}>
      <PageHeader
        title={title || 'Untitled page'}
        back={{ href: '/newsroom/pages', label: 'Pages' }}
        actions={
          published ? (
            <ButtonLink href={`/${slug}`} variant="secondary" icon="external" target="_blank">
              View page
            </ButtonLink>
          ) : undefined
        }
      />
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <div className={forms.form} style={{ maxWidth: 760 }}>
        <p className={forms.hint}>
          {published ? 'Published' : 'Draft'} · last saved {formatWib(savedAt, 'datetime')} WIB
        </p>
        <TextField
          id={`${uid}-title`}
          label="Title"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (!slugTouched) setSlug(slugify(event.target.value) || page.slug);
          }}
          error={errors.title}
          maxLength={PAGE_LIMITS.title}
          placeholder="Privacy policy"
        />
        <TextField
          id={`${uid}-slug`}
          label="Address"
          mono
          value={slug}
          onChange={(event) => {
            setSlug(event.target.value);
            setSlugTouched(true);
          }}
          onBlur={() => setSlug((current) => slugify(current) || current)}
          error={errors.slug}
          hint={`presscompass.site/${slug || '…'}`}
        />
        <TextArea
          id={`${uid}-description`}
          label="Description"
          optional
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          error={errors.description}
          maxLength={PAGE_LIMITS.description}
          hint="Shown in search results and when the page is shared."
        />
        <div className={forms.field}>
          <span className={forms.label} id={`${uid}-body-label`}>
            Page text
          </span>
          <BodyEditor
            ref={body}
            initial={page.body}
            articleId={page.id}
            editable
            invalid={Boolean(errors.body)}
            describedBy={errors.body ? `${uid}-body-error` : undefined}
            onChange={() => {}}
          />
          {errors.body && (
            <p id={`${uid}-body-error`} className={forms.error}>
              {errors.body}
            </p>
          )}
        </div>
        <div className={forms.actions}>
          {published ? (
            <>
              <Button type="button" variant="primary" onClick={() => save('save')} disabled={pending}>
                {pending ? 'Saving…' : 'Update'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => save('unpublish')} disabled={pending}>
                Unpublish
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="primary" onClick={() => save('publish')} disabled={pending}>
                {pending ? 'Saving…' : 'Publish'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => save('save')} disabled={pending}>
                Save draft
              </Button>
            </>
          )}
        </div>
      </div>
      {!published && (
        <section className={forms.danger}>
          <h2 className={forms.dangerTitle}>Delete page</h2>
          <form action={deletePage}>
            <input type="hidden" name="id" value={page.id} />
            <ConfirmButton
              icon="trash"
              title="Delete this page?"
              body="The page is removed. This cannot be undone."
              confirmLabel="Delete page"
              danger
            >
              Delete page
            </ConfirmButton>
          </form>
        </section>
      )}
    </MediaLookupContext>
  );
}
