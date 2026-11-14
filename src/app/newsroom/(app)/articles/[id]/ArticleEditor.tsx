'use client';

import Link from 'next/link';
import { type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useEffectEvent, useId, useMemo, useRef, useState } from 'react';
import { Button, ButtonLink } from '@/components/ds/Button';
import { ConfirmButton } from '@/components/newsroom/ConfirmButton';
import { BodyEditor, type BodyEditorHandle } from '@/components/newsroom/editor/BodyEditor';
import { CloudImage } from '@/components/media/CloudImage';
import { ImagePickerDialog } from '@/components/media/ImagePickerDialog';
import { type MediaLookup, MediaLookupContext } from '@/components/newsroom/editor/media-context';
import { CheckboxField, SelectField, TextArea, TextField } from '@/components/newsroom/Field';
import forms from '@/components/newsroom/forms.module.css';
import { Panel } from '@/components/newsroom/Panel';
import { isSeoField, ScoreBadge, SeoPanel } from '@/components/newsroom/seo/SeoPanel';
import { StatusBadge } from '@/components/newsroom/StatusBadge';
import { Notice, ui } from '@/components/newsroom/ui';
import { slugify } from '@/lib/slug';
import { type Doc, UUID } from '@/lib/doc/schema';
import { sanitizeDoc } from '@/lib/doc/sanitize';
import { bodyMediaIds, readingMinutes, wordCount } from '@/lib/doc/text';
import { formatWib, toWibInput } from '@/lib/time';
import { deleteArticle, findArticles, saveArticle } from '@/modules/editor/actions';
import { seoLookup, type SeoLookup } from '@/modules/seo/actions';
import { analyseArticle } from '@/modules/seo/analysis';
import type { ArticleSeo } from '@/modules/seo/article';
import { ARTICLE_TYPES, type FieldErrors, MAX, type Source, TYPE_LABELS } from '@/modules/editor/input';
import type { EditableArticle } from '@/modules/editor/queries';
import type { MediaItem } from '@/modules/media/types';
import { MIN_WORDS, UNTITLED_SLUG } from '@/modules/editor/rules';
import { type ArticleStatus, canAutosave, CONFIRMATIONS, type Intent, intentLabel, statusActions } from '@/modules/editor/status';
import styles from './editor-page.module.css';

type Option = { id: string; name: string };
type Related = { id: string; title: string };
type Found = Awaited<ReturnType<typeof findArticles>>;

const AUTOSAVE_MS = 10_000;

/** What the SEO tab needs from the site settings. */
export type SeoContext = { origin: string; siteHost: string; siteName: string; titleTemplate: string; indexing: boolean };

const DONE: Partial<Record<Intent, string>> = {
  save: 'Draft saved.',
  review: 'Sent for review.',
  draft: 'Moved back to draft.',
  publish: 'Published.',
  unschedule: 'Schedule cancelled. The article is a draft again.',
  unpublish: 'Unpublished. Readers no longer see it.',
  archive: 'Archived. Restore it to draft to edit it again.',
  restore: 'Restored to draft.',
};

const ANCHORS: Record<string, string> = {
  authorIds: 'authors',
  sectionId: 'section',
  scheduledAt: 'schedule',
  body: 'body-label',
  sources: 'sources-title',
  leadImage: 'lead-title',
  leadCaption: 'lead-caption',
  images: 'body-label',
  seoTitle: 'seo-title',
  seoDescription: 'seo-description',
  keyphrase: 'seo-keyphrase',
  canonical: 'seo-canonical',
};

const FIELD_LABELS: Record<string, string> = {
  title: 'Headline',
  slug: 'Address',
  sectionId: 'Section',
  authorIds: 'Authors',
  standfirst: 'Standfirst',
  body: 'Article text',
  scheduledAt: 'Publish time',
  sources: 'Sources',
  kicker: 'Label',
  leadImage: 'Lead image',
  leadCaption: 'Lead image caption',
  images: 'Images',
  status: 'Status',
  seoTitle: 'SEO title',
  seoDescription: 'Meta description',
  keyphrase: 'Keyphrase',
  canonical: 'Canonical address',
};

export function ArticleEditor({
  article,
  sections,
  authors,
  tags,
  media,
  notice,
  seoContext,
}: {
  article: EditableArticle;
  seoContext: SeoContext;
  /** Media items the article uses (lead image and images in the text). */
  media: MediaItem[];
  sections: (Option & { slug: string })[];
  authors: (Option & { role: string })[];
  tags: Option[];
  notice?: { tone: 'success' | 'error'; text: string } | null;
}) {
  const uid = useId();
  const id = (field: string) => `${uid}-${field}`;
  const body = useRef<BodyEditorHandle>(null);

  const [title, setTitle] = useState(article.title);
  const [slug, setSlug] = useState(article.slug);
  const [slugTouched, setSlugTouched] = useState(
    article.published_at !== null || !(UNTITLED_SLUG.test(article.slug) || article.slug === slugify(article.title)),
  );
  const [sectionId, setSectionId] = useState(article.section_id ?? '');
  const [type, setType] = useState(article.type);
  const [kicker, setKicker] = useState(article.kicker_label);
  const [standfirst, setStandfirst] = useState(article.standfirst);
  const [isBreaking, setIsBreaking] = useState(article.is_breaking);
  const [authorIds, setAuthorIds] = useState(article.authorIds);
  const [tagIds, setTagIds] = useState(article.tagIds);
  const [related, setRelated] = useState<Related[]>(article.related.map(({ id: rid, title: t }) => ({ id: rid, title: t })));
  const [sources, setSources] = useState<Source[]>(article.sources);
  const [known, setKnown] = useState(() => new Map(media.map((item) => [item.id, item])));
  const [leadMediaId, setLeadMediaId] = useState(article.lead_media_id);
  const [leadCaption, setLeadCaption] = useState(article.lead_caption);
  const [pickingLead, setPickingLead] = useState(false);
  const lookup = useMemo<MediaLookup>(
    () => ({ get: (mediaId) => known.get(mediaId), remember: (item) => setKnown((current) => new Map(current).set(item.id, item)) }),
    [known],
  );
  const leadMedia = leadMediaId ? known.get(leadMediaId) : undefined;
  const [words, setWords] = useState(article.word_count);
  const [seo, setSeo] = useState<ArticleSeo>(article.seo);
  const socialMedia = seo.ogMediaId ? known.get(seo.ogMediaId) : undefined;
  const [pickingSocial, setPickingSocial] = useState(false);
  const [tab, setTab] = useState<'article' | 'seo'>('article');
  // The body as the analysis last saw it: refreshed a moment after typing stops.
  const [doc, setDoc] = useState<Doc>(article.body);
  const docTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [seoFound, setSeoFound] = useState<SeoLookup | null>(null);

  const [version, setVersion] = useState(article.version);
  const [status, setStatus] = useState<ArticleStatus>(article.status);
  const [publishedAt, setPublishedAt] = useState(article.published_at);
  const [scheduledAt, setScheduledAt] = useState(article.scheduled_at);
  const [savedAt, setSavedAt] = useState(article.updated_at);
  const [scheduleInput, setScheduleInput] = useState(article.scheduled_at ? toWibInput(new Date(article.scheduled_at)) : '');
  const [scheduling, setScheduling] = useState(false);
  const [majorUpdate, setMajorUpdate] = useState(false);

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState<Intent | null>(null);
  const [autosaveFailed, setAutosaveFailed] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState(notice ?? null);
  const [conflict, setConflict] = useState(false);
  const changes = useRef(0);

  const readOnly = status === 'archived';
  const section = sections.find((s) => s.id === sectionId);
  const actions = statusActions(status);

  const touch = useCallback(() => {
    changes.current += 1;
    setDirty(true);
  }, []);

  function change<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      touch();
    };
  }

  const save = useCallback(
    async (intent: Intent) => {
      if (saving || conflict) return;
      const startedAt = changes.current;
      setSaving(intent);
      const sendSchedule = intent === 'schedule' || (intent === 'update' && status === 'scheduled');
      try {
        const result = await saveArticle(
          {
            id: article.id,
            version,
            title,
            slug,
            slugAuto: !slugTouched,
            sectionId: sectionId || null,
            type,
            kicker,
            standfirst,
            body: body.current?.getJSON(),
            isBreaking,
            authorIds,
            tagIds,
            relatedIds: related.map((r) => r.id),
            sources,
            scheduledAt: sendSchedule ? scheduleInput || null : null,
            majorUpdate: intent === 'update' && majorUpdate,
            leadMediaId,
            leadCaption,
            seo,
          },
          intent,
        );
        if (result.ok) {
          setVersion(result.version);
          setStatus(result.status);
          setPublishedAt(result.publishedAt);
          setScheduledAt(result.scheduledAt);
          setSavedAt(result.savedAt);
          if (result.slug !== slug) setSlug(result.slug);
          setErrors({});
          setAutosaveFailed(false);
          if (changes.current === startedAt) setDirty(false);
          if (intent !== 'autosave') {
            setScheduling(false);
            setMajorUpdate(false);
            const text =
              intent === 'schedule' && result.scheduledAt
                ? `Scheduled for ${formatWib(result.scheduledAt)} WIB.`
                : intent === 'update'
                  ? result.status === 'published'
                    ? 'Update published.'
                    : 'Changes saved.'
                  : DONE[intent];
            setMessage(text ? { tone: 'success', text } : null);
          }
        } else if (result.conflict) {
          setConflict(true);
        } else {
          setErrors(result.errors ?? {});
          if (intent === 'autosave') setAutosaveFailed(true);
          else if (result.message) setMessage({ tone: 'error', text: result.message });
          else setMessage(null);
        }
      } catch {
        if (intent === 'autosave') setAutosaveFailed(true);
        else setMessage({ tone: 'error', text: 'The server could not be reached. Your changes are still here. Try again.' });
      } finally {
        setSaving(null);
      }
    },
    [
      saving,
      conflict,
      status,
      article.id,
      version,
      title,
      slug,
      slugTouched,
      sectionId,
      type,
      kicker,
      standfirst,
      isBreaking,
      authorIds,
      tagIds,
      related,
      sources,
      scheduleInput,
      majorUpdate,
      leadMediaId,
      leadCaption,
      seo,
    ],
  );

  // Autosave every 10 seconds while there are changes (drafts and articles in review only).
  const autosaveTick = useEffectEvent(() => {
    if (dirty && !saving && !conflict && canAutosave(status)) void save('autosave');
  });
  useEffect(() => {
    const timer = setInterval(() => autosaveTick(), AUTOSAVE_MS);
    return () => clearInterval(timer);
  }, []);

  // Warn before leaving with unsaved changes, and save with Ctrl+S or Cmd+S.
  const onBeforeUnload = useEffectEvent((event: BeforeUnloadEvent) => {
    if (dirty) event.preventDefault();
  });
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      if (status === 'draft' || status === 'review') void save('save');
      else if (status !== 'archived') void save('update');
    }
  });
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => onBeforeUnload(event);
    const keydown = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('keydown', keydown);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('keydown', keydown);
    };
  }, []);

  const analysis = useMemo(
    () =>
      analyseArticle({
        title,
        seoTitle: seo.title,
        description: seo.description,
        standfirst,
        slug,
        keyphrase: seo.keyphrase,
        related: seo.related,
        body: doc,
        noindex: seo.noindex,
        canonical: seo.canonical,
        lead: leadMedia ? { alt: leadMedia.alt, width: leadMedia.width } : null,
        imageAlts: bodyMediaIds(doc).map((mediaId) => known.get(mediaId)?.alt ?? ''),
        sources: sources.filter((source) => source.title && source.url).length,
        siteHost: seoContext.siteHost,
        titleTemplate: seoContext.titleTemplate,
        usage: seoFound ? { keyphrase: seoFound.keyphrase.length, title: seoFound.title.length } : null,
      }),
    [title, seo, standfirst, slug, doc, leadMedia, known, sources, seoContext, seoFound],
  );

  // Other articles with the same keyphrase or title, and link suggestions: asked a moment after the inputs settle.
  const linkedKey = useMemo(
    () => [...new Set([...readMoreIds(doc), ...related.map((r) => r.id)])].join(','),
    [doc, related],
  );
  const tagKey = tagIds.join(',');
  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      seoLookup({
        articleId: article.id,
        keyphrase: seo.keyphrase,
        title: seo.title || title,
        sectionId: sectionId || null,
        tagIds: tagKey ? tagKey.split(',') : [],
        linkedIds: linkedKey ? linkedKey.split(',') : [],
      })
        .then((result) => current && setSeoFound(result))
        .catch(() => undefined);
    }, 700);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [article.id, seo.keyphrase, seo.title, title, sectionId, tagKey, linkedKey]);

  function jumpTo(field: string) {
    setTab(isSeoField(field) ? 'seo' : 'article');
    requestAnimationFrame(() => {
      const target = document.getElementById(id(ANCHORS[field] ?? field));
      target?.scrollIntoView({ block: 'center' });
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) target.focus();
    });
  }

  function run(intent: Intent) {
    if (intent === 'schedule' && !scheduling) {
      setScheduling(true);
      if (!scheduleInput) setScheduleInput(nextHourInput());
      return;
    }
    void save(intent);
  }

  const problems = Object.entries(errors).filter(([, text]) => text);
  const errorFor = (field: string) => errors[field];
  const minutes = readingMinutes(words);
  const saveState = conflict
    ? 'Not saved'
    : saving
      ? 'Saving…'
      : autosaveFailed
        ? 'Not saved: fix the fields marked in red'
        : dirty
          ? canAutosave(status)
            ? 'Unsaved changes'
            : 'Unsaved changes: press Update to publish them'
          : `Saved ${formatWib(savedAt, 'short')}`;

  const actionButton = (intent: Intent, variant: 'primary' | 'secondary' | 'quiet', fullWidth = true) => {
    const label = intent === 'schedule' && scheduling ? 'Confirm schedule' : intentLabel(intent, status);
    const confirm = CONFIRMATIONS[intent];
    const busy = saving === intent;
    if (confirm) {
      return (
        <ConfirmButton
          key={intent}
          variant={variant}
          fullWidth={fullWidth}
          size={fullWidth ? undefined : 'sm'}
          disabled={Boolean(saving) || conflict}
          title={confirm.title}
          body={confirm.body}
          confirmLabel={confirm.confirm}
          danger={intent === 'archive' || intent === 'unpublish'}
          onConfirm={() => run(intent)}
        >
          {busy ? 'Working…' : label}
        </ConfirmButton>
      );
    }
    return (
      <Button key={intent} variant={variant} fullWidth={fullWidth} size={fullWidth ? undefined : 'sm'} disabled={Boolean(saving) || conflict} onClick={() => run(intent)}>
        {busy ? (intent === 'save' ? 'Saving…' : 'Working…') : label}
      </Button>
    );
  };

  // The top bar carries Save draft and the next step, as WordPress does; the Status card the other actions.
  const canSaveDraft = actions.others.includes('save');
  const others = scheduling ? [] : actions.others.filter((intent) => intent !== 'save');
  const availableAuthors = authors.filter((a) => !authorIds.includes(a.id));
  const availableTags = tags.filter((t) => !tagIds.includes(t.id));

  const errorPanel = (...fields: string[]) => fields.some((field) => Boolean(errorFor(field)));
  const tabKeys = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      const next = tab === 'article' ? 'seo' : 'article';
      setTab(next);
      document.getElementById(id(`tab-${next}`))?.focus();
    }
  };

  return (
    <MediaLookupContext value={lookup}>
    <div className={styles.page}>
      <h1 className={ui.srOnly}>Edit article</h1>
      <div className={styles.top}>
        <Link href="/newsroom/articles" className={styles.back}>
          ← Articles
        </Link>
        <StatusBadge status={status} />
        <p className={styles.saveState} role="status" aria-live="polite">
          {saveState}
        </p>
        <div className={styles.topLinks}>
          <span className={styles.topScores}>
            <ScoreBadge label="SEO" assessment={analysis.seo} onClick={() => setTab('seo')} />
            <ScoreBadge label="Readability" assessment={analysis.readability} onClick={() => setTab('seo')} />
          </span>
          <ButtonLink href={`/newsroom/articles/${article.id}/history`} size="sm" variant="quiet" icon="history">
            History
          </ButtonLink>
          <ButtonLink href={`/newsroom/preview/${article.id}`} size="sm" variant="quiet" icon="eye" target="_blank">
            Preview
          </ButtonLink>
          {canSaveDraft && actionButton('save', 'secondary', false)}
          {actionButton(actions.primary, 'primary', false)}
        </div>
      </div>

      {conflict && (
        <Notice tone="error">
          <span>This article changed in another window. Reload to see the latest version. Changes made here since your last save will be lost.</span>
          <span>
            <Button size="sm" variant="primary" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </span>
        </Notice>
      )}
      {message && !conflict && <Notice tone={message.tone}>{message.text}</Notice>}
      {readOnly && <Notice tone="info">Archived articles are read-only. Restore it to draft to edit it.</Notice>}
      {problems.length > 0 && (
        <div className={styles.problems} role="alert">
          <p>{problems.length === 1 ? 'One thing needs attention:' : `${problems.length} things need attention:`}</p>
          <ul>
            {problems.map(([field, text]) => (
              <li key={field}>
                <a
                  href={`#${id(ANCHORS[field] ?? field)}`}
                  onClick={(event) => {
                    event.preventDefault();
                    jumpTo(field);
                  }}
                >
                  {FIELD_LABELS[field] ?? field}
                </a>
                : {text}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.grid}>
        <div className={styles.main}>
          <div className={styles.headlineField}>
            <label htmlFor={id('title')} className={styles.fieldLabel}>
              Headline
            </label>
            <textarea
              id={id('title')}
              className={styles.headline}
              rows={1}
              value={title}
              placeholder="Write the headline"
              maxLength={MAX.title + 20}
              disabled={readOnly}
              aria-invalid={errorFor('title') ? true : undefined}
              aria-describedby={errorFor('title') ? id('title-error') : undefined}
              onChange={(event) => {
                const value = event.target.value.replace(/\n/g, ' ');
                setTitle(value);
                if (!slugTouched) setSlug(slugify(value) || slug);
                touch();
              }}
            />
            {errorFor('title') && (
              <p id={id('title-error')} className={forms.error}>
                {errorFor('title')}
              </p>
            )}
          </div>
          <div className={styles.headlineField}>
            <label htmlFor={id('standfirst')} className={styles.fieldLabel}>
              Standfirst
            </label>
            <textarea
              id={id('standfirst')}
              className={styles.standfirst}
              rows={2}
              value={standfirst}
              placeholder="One or two sentences that tell the reader why this matters"
              maxLength={MAX.standfirst + 20}
              disabled={readOnly}
              aria-invalid={errorFor('standfirst') ? true : undefined}
              aria-describedby={errorFor('standfirst') ? id('standfirst-error') : undefined}
              onChange={(event) => change(setStandfirst)(event.target.value)}
            />
            {errorFor('standfirst') && (
              <p id={id('standfirst-error')} className={forms.error}>
                {errorFor('standfirst')}
              </p>
            )}
          </div>
          <div className={styles.headlineField}>
            <span className={styles.fieldLabel} id={id('body-label')}>
              Article text
            </span>
            <BodyEditor
              ref={body}
              initial={article.body}
              articleId={article.id}
              editable={!readOnly}
              invalid={Boolean(errorFor('body'))}
              describedBy={errorFor('body') ? id('body-error') : undefined}
              onChange={(text) => {
                setWords(wordCount(text));
                touch();
                if (docTimer.current) clearTimeout(docTimer.current);
                docTimer.current = setTimeout(() => setDoc(sanitizeDoc(body.current?.getJSON())), 400);
              }}
            />
            {errorFor('body') && (
              <p id={id('body-error')} className={forms.error}>
                {errorFor('body')}
              </p>
            )}
            <div className={styles.belowBody}>
              <p className={styles.wordCount}>
                {words} {words === 1 ? 'word' : 'words'}
                {minutes > 0 && ` · ${minutes} min read`}
                {words < MIN_WORDS && ` · ${MIN_WORDS} needed to publish`}
              </p>
              {!readOnly && <p className={styles.wordCount}>Type / in an empty line to add a block</p>}
            </div>
          </div>
        </div>

        <aside className={styles.panel} aria-label="Article settings">
          <div className={styles.tabs} role="tablist" aria-label="Settings">
            <button
              type="button"
              role="tab"
              id={id('tab-article')}
              className={styles.tab}
              aria-selected={tab === 'article'}
              aria-controls={id('panel-article')}
              tabIndex={tab === 'article' ? 0 : -1}
              onClick={() => setTab('article')}
              onKeyDown={tabKeys}
            >
              Article
            </button>
            <button
              type="button"
              role="tab"
              id={id('tab-seo')}
              className={styles.tab}
              aria-selected={tab === 'seo'}
              aria-controls={id('panel-seo')}
              tabIndex={tab === 'seo' ? 0 : -1}
              onClick={() => setTab('seo')}
              onKeyDown={tabKeys}
            >
              SEO
              <span className={styles.tabScore} data-rating={analysis.seo.rating}>
                {analysis.seo.score}
              </span>
            </button>
          </div>

          <div role="tabpanel" id={id('panel-article')} aria-labelledby={id('tab-article')} hidden={tab !== 'article'} className={styles.tabPanel}>
          <section className={styles.card} aria-label="Status">
            <div className={styles.statusHead}>
              <StatusBadge status={status} />
              <span className={styles.when}>
                {status === 'scheduled' && scheduledAt
                  ? `Publishes ${formatWib(scheduledAt)} WIB`
                  : publishedAt
                    ? `First published ${formatWib(publishedAt)} WIB`
                    : 'Not published yet'}
              </span>
            </div>
            {(scheduling || status === 'scheduled') && (
              <TextField
                id={id('schedule')}
                label="Publish time (WIB)"
                type="datetime-local"
                value={scheduleInput}
                onChange={(event) => change(setScheduleInput)(event.target.value)}
                error={errorFor('scheduledAt')}
              />
            )}
            {status === 'published' && (
              <CheckboxField
                id={id('major')}
                label="Major update"
                hint="Marks the article as updated and tells search engines. Use it for new facts, not for typo fixes."
                checked={majorUpdate}
                onChange={(event) => setMajorUpdate(event.target.checked)}
              />
            )}
            {(scheduling || others.length > 0) && (
              <div className={styles.actions}>
                {scheduling && actionButton('schedule', 'primary')}
                {scheduling && (
                  <Button variant="quiet" fullWidth onClick={() => setScheduling(false)}>
                    Cancel
                  </Button>
                )}
                {others.map((intent) => actionButton(intent, 'secondary'))}
              </div>
            )}
          </section>
          <Panel title="Lead image" titleId={id('lead-title')} forceOpen={errorPanel('leadImage', 'leadCaption')}>
            {errorFor('leadImage') && <p className={forms.error}>{errorFor('leadImage')}</p>}
            {leadMediaId && !leadMedia && <p className={forms.hint}>The chosen image is no longer in the media library.</p>}
            {leadMedia && (
              <figure className={styles.lead}>
                <CloudImage image={leadMedia} alt="" preset="hero" sizes="300px" className={styles.leadImage} />
                <figcaption className={leadMedia.alt ? styles.leadAlt : styles.leadAltMissing}>
                  {leadMedia.alt ? `Alt text: ${leadMedia.alt}` : 'No alt text yet. Needed before publishing.'}
                </figcaption>
              </figure>
            )}
            {!readOnly && (
              <div className={styles.rowButtons}>
                <Button size="sm" icon="image" onClick={() => setPickingLead(true)}>
                  {leadMediaId ? 'Change image' : 'Choose image'}
                </Button>
                {leadMediaId && (
                  <Button
                    size="sm"
                    variant="quiet"
                    onClick={() => {
                      setLeadMediaId(null);
                      touch();
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>
            )}
            {leadMediaId && (
              <TextArea
                id={id('lead-caption')}
                label="Caption"
                optional
                rows={2}
                value={leadCaption}
                disabled={readOnly}
                maxLength={MAX.leadCaption}
                error={errorFor('leadCaption')}
                hint="Shown under the lead image. Credit comes from the media library."
                onChange={(event) => change(setLeadCaption)(event.target.value)}
              />
            )}
          </Panel>

          <Panel title="Details" forceOpen={errorPanel('slug', 'sectionId', 'kicker')}>
            <TextField
              id={id('slug')}
              label="Address"
              mono
              value={slug}
              disabled={readOnly}
              error={errorFor('slug')}
              hint={`presscompass.site/${section?.slug ?? 'section'}/${slug}${publishedAt ? ' · Changing it adds a redirect from the old address.' : ''}`}
              onChange={(event) => {
                setSlug(event.target.value);
                setSlugTouched(true);
                touch();
              }}
              onBlur={() => setSlug((current) => slugify(current) || current)}
            />
            <SelectField
              id={id('section')}
              label="Section"
              value={sectionId}
              disabled={readOnly}
              error={errorFor('sectionId')}
              onChange={(event) => change(setSectionId)(event.target.value)}
            >
              <option value="">Choose a section</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectField>
            {sections.length === 0 && (
              <p className={forms.hint}>
                No sections yet. <Link href="/newsroom/sections/new">Create one</Link> first.
              </p>
            )}
            <SelectField id={id('type')} label="Type" value={type} disabled={readOnly} onChange={(event) => change(setType)(event.target.value as typeof type)}>
              {ARTICLE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </SelectField>
            <TextField
              id={id('kicker')}
              label="Label"
              optional
              value={kicker}
              disabled={readOnly}
              maxLength={MAX.kicker}
              error={errorFor('kicker')}
              hint="Shown above the headline instead of the section name, for example Exclusive."
              onChange={(event) => change(setKicker)(event.target.value)}
            />
            <CheckboxField
              id={id('breaking')}
              label="Breaking news"
              hint="Highlights the article in the Latest strip."
              checked={isBreaking}
              disabled={readOnly}
              onChange={(event) => change(setIsBreaking)(event.target.checked)}
            />
          </Panel>

          <Panel title="Byline" titleId={id('authors-title')} forceOpen={errorPanel('authorIds')}>
            {errorFor('authorIds') && <p className={forms.error}>{errorFor('authorIds')}</p>}
            {authorIds.length > 0 && (
              <ol className={styles.chosenList}>
                {authorIds.map((authorId, index) => {
                  const author = authors.find((a) => a.id === authorId);
                  return (
                    <li key={authorId}>
                      <span>
                        {author?.name ?? 'Removed author'}
                        {author?.role && <small>{author.role}</small>}
                      </span>
                      {!readOnly && (
                        <span className={styles.rowButtons}>
                          <Button
                            size="sm"
                            variant="quiet"
                            icon="arrow-up"
                            aria-label={`Move ${author?.name} up`}
                            disabled={index === 0}
                            onClick={() => change(setAuthorIds)(move(authorIds, index, -1))}
                          />
                          <Button size="sm" variant="quiet" icon="x" aria-label={`Remove ${author?.name}`} onClick={() => change(setAuthorIds)(authorIds.filter((a) => a !== authorId))} />
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
            {!readOnly && (
              <SelectField
                id={id('authors')}
                label="Add an author"
                value=""
                onChange={(event) => event.target.value && change(setAuthorIds)([...authorIds, event.target.value])}
                hint={authors.length === 0 ? undefined : authorIds.length > 1 ? 'Bylines appear in this order.' : undefined}
              >
                <option value="">{availableAuthors.length ? 'Choose…' : 'Everyone is on the byline'}</option>
                {availableAuthors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </SelectField>
            )}
            {authors.length === 0 && (
              <p className={forms.hint}>
                No authors yet. <Link href="/newsroom/authors/new">Add one</Link> first.
              </p>
            )}
          </Panel>

          <Panel title="Tags" titleId={id('tags-title')}>
            {tagIds.length > 0 && (
              <ul className={styles.chips}>
                {tagIds.map((tagId) => {
                  const tag = tags.find((t) => t.id === tagId);
                  return (
                    <li key={tagId} className={styles.chip}>
                      {tag?.name ?? 'Removed tag'}
                      {!readOnly && (
                        <button type="button" aria-label={`Remove tag ${tag?.name}`} onClick={() => change(setTagIds)(tagIds.filter((t) => t !== tagId))}>
                          ×
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {!readOnly && (
              <SelectField id={id('tags')} label="Add a tag" value="" onChange={(event) => event.target.value && change(setTagIds)([...tagIds, event.target.value])}>
                <option value="">{availableTags.length ? 'Choose…' : 'No more tags'}</option>
                {availableTags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </SelectField>
            )}
            <p className={forms.hint}>
              <Link href="/newsroom/tags/new" target="_blank">
                New tag
              </Link>{' '}
              opens in a new tab. Reload this page after creating it.
            </p>
          </Panel>

          <RelatedPicker articleId={article.id} related={related} readOnly={readOnly} onChange={change(setRelated)} uid={uid} />

          <Panel title="Sources" titleId={id('sources-title')} forceOpen={errorPanel('sources')}>
            {errorFor('sources') && <p className={forms.error}>{errorFor('sources')}</p>}
            {sources.map((source, index) => (
              <fieldset key={index} className={styles.source}>
                <legend className={styles.sourceLegend}>Source {index + 1}</legend>
                <TextField id={id(`source-title-${index}`)} label="Title" value={source.title} disabled={readOnly} onChange={(e) => change(setSources)(edit(sources, index, 'title', e.target.value))} />
                <TextField id={id(`source-url-${index}`)} label="Link" type="url" mono value={source.url} disabled={readOnly} placeholder="https://" onChange={(e) => change(setSources)(edit(sources, index, 'url', e.target.value))} />
                <div className={forms.row}>
                  <TextField id={id(`source-publisher-${index}`)} label="Publisher" optional value={source.publisher} disabled={readOnly} onChange={(e) => change(setSources)(edit(sources, index, 'publisher', e.target.value))} />
                  <TextField id={id(`source-accessed-${index}`)} label="Accessed" optional type="date" value={source.accessed} disabled={readOnly} onChange={(e) => change(setSources)(edit(sources, index, 'accessed', e.target.value))} />
                </div>
                {!readOnly && (
                  <Button size="sm" variant="quiet" icon="trash" onClick={() => change(setSources)(sources.filter((_, i) => i !== index))}>
                    Remove source
                  </Button>
                )}
              </fieldset>
            ))}
            {!readOnly && sources.length < MAX.sources && (
              <Button size="sm" icon="plus" onClick={() => change(setSources)([...sources, { title: '', url: '', publisher: '', accessed: toWibInput(new Date()).slice(0, 10) }])}>
                Add source
              </Button>
            )}
          </Panel>

          {status !== 'published' && (
            <section className={styles.card} aria-label="Delete">
              <form action={deleteArticle}>
                <input type="hidden" name="id" value={article.id} />
                <ConfirmButton
                  variant="quiet"
                  size="sm"
                  icon="trash"
                  title="Delete this article?"
                  body="The article and its history are removed for good. This cannot be undone."
                  confirmLabel="Delete article"
                  danger
                >
                  Delete article
                </ConfirmButton>
              </form>
            </section>
          )}
          </div>

          <div role="tabpanel" id={id('panel-seo')} aria-labelledby={id('tab-seo')} hidden={tab !== 'seo'} className={styles.tabPanel}>
            <SeoPanel
              uid={uid}
              analysis={analysis}
              seo={seo}
              onChange={change(setSeo)}
              headline={title}
              standfirst={standfirst}
              kicker={kicker}
              slug={slug}
              section={section ? { name: section.name, slug: section.slug } : null}
              publishedAt={publishedAt}
              origin={seoContext.origin}
              siteName={seoContext.siteName}
              indexing={seoContext.indexing}
              lead={leadMedia}
              social={socialMedia}
              onPickSocial={() => setPickingSocial(true)}
              lookup={seoFound}
              readOnly={readOnly}
              errors={errors}
            />
          </div>
        </aside>
      </div>
    </div>
    {pickingLead && (
      <ImagePickerDialog
        title="Lead image"
        initial={leadMedia ?? null}
        caption={null}
        submitLabel="Use as lead image"
        onClose={() => setPickingLead(false)}
        onSave={({ media: picked }) => {
          lookup.remember(picked);
          setLeadMediaId(picked.id);
          if (!leadCaption && picked.caption) setLeadCaption(picked.caption);
          setPickingLead(false);
          touch();
        }}
      />
    )}
    {pickingSocial && (
      <ImagePickerDialog
        title="Social image"
        initial={socialMedia ?? null}
        caption={null}
        submitLabel="Use for social cards"
        onClose={() => setPickingSocial(false)}
        onSave={({ media: picked }) => {
          lookup.remember(picked);
          change(setSeo)({ ...seo, ogMediaId: picked.id });
          setPickingSocial(false);
        }}
      />
    )}
    </MediaLookupContext>
  );
}

function RelatedPicker({
  articleId,
  related,
  readOnly,
  onChange,
  uid,
}: {
  articleId: string;
  related: Related[];
  readOnly: boolean;
  onChange: (value: Related[]) => void;
  uid: string;
}) {
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Found | null>(null);
  const [searching, setSearching] = useState(false);

  async function search() {
    setSearching(true);
    try {
      setFound((await findArticles(query, articleId)).filter((a) => !related.some((r) => r.id === a.id)));
    } finally {
      setSearching(false);
    }
  }

  return (
    <Panel title="Related articles" titleId={`${uid}-related-title`}>
      <p className={forms.hint}>Your picks appear first under the article. The rest fill in from the same section and tags.</p>
      {related.length > 0 && (
        <ol className={styles.chosenList}>
          {related.map((item) => (
            <li key={item.id}>
              <span>{item.title || 'Untitled'}</span>
              {!readOnly && <Button size="sm" variant="quiet" icon="x" aria-label={`Remove ${item.title || 'Untitled'}`} onClick={() => onChange(related.filter((r) => r.id !== item.id))} />}
            </li>
          ))}
        </ol>
      )}
      {!readOnly && related.length < MAX.related && (
        <>
          <div className={styles.searchRow}>
            <TextField
              id={`${uid}-related-query`}
              label="Find an article"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void search();
                }
              }}
            />
            <Button size="sm" onClick={() => void search()} disabled={searching}>
              {searching ? 'Searching…' : 'Search'}
            </Button>
          </div>
          {found && (
            <ul className={styles.results} aria-label="Search results">
              {found.length === 0 && <li className={forms.hint}>No articles match.</li>}
              {found.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={styles.result}
                    onClick={() => {
                      onChange([...related, { id: item.id, title: item.title }]);
                      setFound((current) => current?.filter((f) => f.id !== item.id) ?? null);
                    }}
                  >
                    <span>{item.title || 'Untitled'}</span>
                    <small>Add · {item.section?.name ?? 'No section'}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Panel>
  );
}

/** Articles linked by Read more cards in the body. */
function readMoreIds(doc: Doc): string[] {
  return doc.content.flatMap((block) => (block.type === 'readMore' && UUID.test(block.attrs.articleId) ? [block.attrs.articleId] : []));
}

function move<T>(list: T[], index: number, by: number): T[] {
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(index + by, 0, item);
  return next;
}

function edit(sources: Source[], index: number, key: keyof Source, value: string): Source[] {
  return sources.map((source, i) => (i === index ? { ...source, [key]: value } : source));
}

/** The next full hour in WIB, as a starting point for the schedule field. */
function nextHourInput(): string {
  return `${toWibInput(new Date(Date.now() + 60 * 60 * 1000)).slice(0, 14)}00`;
}
