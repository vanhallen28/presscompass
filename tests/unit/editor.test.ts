import { describe, expect, it } from 'vitest';
import { parseArticleInput } from '@/modules/editor/input';
import { publishProblems } from '@/modules/editor/rules';
import { prepareSave } from '@/modules/editor/save';
import { intentLabel, statusActions, transition } from '@/modules/editor/status';

const NOW = new Date('2026-11-13T03:00:00Z');
const ID = '0b8a6f5e-58a8-4d5c-9b8e-0a5b8a1c2d3e';
const SECTION = '1c9e7a2b-3d4f-4a5b-8c6d-7e8f9a0b1c2d';
const AUTHOR = '2d0f8b3c-4e5a-4b6c-9d7e-8f9a0b1c2d3e';
const longBody = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'word '.repeat(160).trim() }] }] };

const raw = (over: Record<string, unknown> = {}) => ({
  id: ID,
  version: 3,
  title: 'Rice prices climb',
  slug: 'rice-prices-climb',
  slugAuto: true,
  sectionId: SECTION,
  type: 'news',
  kicker: '',
  standfirst: 'Why it matters for households.',
  body: longBody,
  isBreaking: false,
  authorIds: [AUTHOR],
  tagIds: [],
  relatedIds: [],
  sources: [],
  scheduledAt: null,
  majorUpdate: false,
  ...over,
});

describe('status actions', () => {
  it('offers one next step per status, with the rest as secondary actions', () => {
    expect(statusActions('draft')).toEqual({ primary: 'review', others: ['save', 'publish', 'schedule', 'archive'] });
    expect(statusActions('review')).toEqual({ primary: 'publish', others: ['save', 'schedule', 'draft', 'archive'] });
    expect(statusActions('scheduled')).toEqual({ primary: 'update', others: ['publish', 'unschedule', 'archive'] });
    expect(statusActions('published')).toEqual({ primary: 'update', others: ['unpublish', 'archive'] });
    expect(statusActions('archived')).toEqual({ primary: 'restore', others: [] });
  });

  it('labels actions in plain words', () => {
    expect(intentLabel('publish', 'review')).toBe('Publish');
    expect(intentLabel('publish', 'draft')).toBe('Publish now');
    expect(intentLabel('update', 'published')).toBe('Update');
    expect(intentLabel('update', 'scheduled')).toBe('Save changes');
    expect(intentLabel('unschedule', 'scheduled')).toBe('Cancel schedule');
  });
});

describe('transition', () => {
  const draft = { status: 'draft' as const, published_at: null, scheduled_at: null };

  it('publishes now, keeping the first publication time when there is one', () => {
    expect(transition(draft, 'publish', { now: NOW })).toMatchObject({
      ok: true,
      status: 'published',
      published_at: NOW.toISOString(),
      scheduled_at: null,
      note: 'Published',
      needsRules: true,
    });
    const before = { status: 'draft' as const, published_at: '2026-10-01T00:00:00.000Z', scheduled_at: null };
    expect(transition(before, 'publish', { now: NOW })).toMatchObject({ published_at: '2026-10-01T00:00:00.000Z' });
  });

  it('schedules only for a time at least a minute ahead', () => {
    const at = new Date('2026-11-14T02:00:00Z');
    expect(transition(draft, 'schedule', { now: NOW, scheduledAt: at })).toMatchObject({
      ok: true,
      status: 'scheduled',
      scheduled_at: at.toISOString(),
      note: 'Scheduled for 14 Nov 2026, 09:00 WIB',
    });
    expect(transition(draft, 'schedule', { now: NOW })).toEqual({ ok: false, field: 'scheduledAt', error: 'Choose a date and time to publish.' });
    expect(transition(draft, 'schedule', { now: NOW, scheduledAt: new Date(NOW.getTime() + 30_000) })).toEqual({
      ok: false,
      field: 'scheduledAt',
      error: 'Choose a time at least a minute from now.',
    });
  });

  it('marks a major update on a published article', () => {
    const live = { status: 'published' as const, published_at: '2026-11-01T00:00:00.000Z', scheduled_at: null };
    expect(transition(live, 'update', { now: NOW })).toMatchObject({ ok: true, status: 'published', note: 'Updated' });
    expect(transition(live, 'update', { now: NOW }).ok && 'major_update_at' in transition(live, 'update', { now: NOW })).toBe(false);
    expect(transition(live, 'update', { now: NOW, majorUpdate: true })).toMatchObject({ major_update_at: NOW.toISOString(), note: 'Major update' });
  });

  it('autosaves drafts with a throttled revision and refuses actions a status does not offer', () => {
    expect(transition(draft, 'autosave', { now: NOW })).toMatchObject({ ok: true, status: 'draft', note: 'Autosaved', throttle: true, needsRules: false });
    const live = { status: 'published' as const, published_at: '2026-11-01T00:00:00.000Z', scheduled_at: null };
    expect(transition(live, 'autosave', { now: NOW })).toEqual({ ok: false, error: 'This action is not available for a published article.' });
    expect(transition({ ...draft, status: 'archived' }, 'publish', { now: NOW })).toEqual({ ok: false, error: 'This action is not available for an archived article.' });
  });

  it('cancels a schedule, unpublishes and archives', () => {
    const scheduled = { status: 'scheduled' as const, published_at: null, scheduled_at: '2026-11-20T00:00:00.000Z' };
    expect(transition(scheduled, 'unschedule', { now: NOW })).toMatchObject({ status: 'draft', scheduled_at: null, note: 'Schedule cancelled' });
    expect(transition(scheduled, 'archive', { now: NOW })).toMatchObject({ status: 'archived', scheduled_at: null });
    const live = { status: 'published' as const, published_at: '2026-11-01T00:00:00.000Z', scheduled_at: null };
    expect(transition(live, 'unpublish', { now: NOW })).toMatchObject({ status: 'draft', published_at: '2026-11-01T00:00:00.000Z', note: 'Unpublished' });
  });
});

describe('publish rules', () => {
  const ready = { title: 'Rice prices climb', slug: 'rice-prices-climb', sectionId: SECTION, authorIds: [AUTHOR], standfirst: 'Why.', wordCount: 150 };

  it('passes a complete article', () => {
    expect(publishProblems(ready)).toEqual({});
  });

  it('names every missing piece next to its field', () => {
    expect(
      publishProblems({ title: ' ', slug: 'untitled-0a1b2c3d', sectionId: null, authorIds: [], standfirst: '', wordCount: 149 }),
    ).toEqual({
      title: 'Add a headline before publishing.',
      slug: 'Set the address before publishing. It fills in from the headline.',
      sectionId: 'Choose a section.',
      authorIds: 'Add at least one author.',
      standfirst: 'Add a standfirst: one or two sentences under the headline.',
      body: 'The article needs at least 150 words. It has 149.',
    });
  });
});

describe('parseArticleInput', () => {
  it('accepts a well-formed article and trims the text fields', () => {
    const result = parseArticleInput(raw({ title: '  Rice prices climb  ', sources: [{ title: 'BPS', url: 'https://bps.go.id', publisher: '', accessed: '' }, { title: '', url: '', publisher: '', accessed: '' }] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.title).toBe('Rice prices climb');
    expect(result.value.sources).toEqual([{ title: 'BPS', url: 'https://bps.go.id', publisher: '', accessed: '' }]);
    expect(result.errors).toEqual({});
  });

  it('reports field problems without rejecting the whole save', () => {
    const result = parseArticleInput(
      raw({ slug: 'Rice Prices', title: 'x'.repeat(201), sources: [{ title: '', url: 'ftp://x', publisher: '', accessed: 'soon' }] }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.errors).toEqual({
      title: 'Keep the headline under 200 characters.',
      slug: 'Use lowercase letters, numbers and single hyphens.',
      sources: 'Each source needs a title and a link that starts with https:// or http://. Dates use YYYY-MM-DD.',
    });
  });

  it('refuses input that is not an article', () => {
    expect(parseArticleInput(null)).toEqual({ ok: false, error: 'The editor sent something unexpected. Reload the page and try again.' });
    expect(parseArticleInput(raw({ id: 'nope' })).ok).toBe(false);
    expect(parseArticleInput(raw({ authorIds: ['nope'] })).ok).toBe(false);
    expect(parseArticleInput(raw({ type: 'gossip' })).ok).toBe(false);
  });
});

describe('prepareSave', () => {
  const current = { status: 'draft' as const, published_at: null, scheduled_at: null };
  const parsed = (over: Record<string, unknown> = {}) => {
    const result = parseArticleInput(raw(over));
    if (!result.ok) throw new Error(result.error);
    return result;
  };

  it('builds the fields, relations and revision note for a publish', () => {
    const plan = prepareSave({ input: parsed(), current, intent: 'publish', now: NOW });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.fields).toMatchObject({
      title: 'Rice prices climb',
      slug: 'rice-prices-climb',
      slug_auto: true,
      section_id: SECTION,
      status: 'published',
      published_at: NOW.toISOString(),
      word_count: 160,
      reading_minutes: 1,
    });
    expect(plan.fields.body_text).toBe('word '.repeat(160).trim());
    expect(plan).toMatchObject({ authors: [AUTHOR], tags: [], related: [], revision: 'Published', throttle: false });
  });

  it('checks the publish rules only for steps that put an article in front of readers', () => {
    const thin = parsed({ standfirst: '', body: { type: 'doc', content: [] } });
    expect(prepareSave({ input: thin, current, intent: 'save', now: NOW }).ok).toBe(true);
    expect(prepareSave({ input: thin, current, intent: 'publish', now: NOW })).toEqual({
      ok: false,
      errors: { standfirst: 'Add a standfirst: one or two sentences under the headline.', body: 'The article needs at least 150 words. It has 0.' },
    });
  });

  it('blocks any save while a field is malformed, and reads the schedule in WIB', () => {
    expect(prepareSave({ input: parsed({ slug: 'Bad Slug' }), current, intent: 'autosave', now: NOW })).toEqual({
      ok: false,
      errors: { slug: 'Use lowercase letters, numbers and single hyphens.' },
    });
    const plan = prepareSave({ input: parsed({ scheduledAt: '2026-11-14T09:00' }), current, intent: 'schedule', now: NOW });
    expect(plan.ok && plan.fields.scheduled_at).toBe('2026-11-14T02:00:00.000Z');
  });
});
