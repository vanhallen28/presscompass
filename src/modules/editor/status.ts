import { formatWib } from '@/lib/time';

// The article status flow: draft → review → published or scheduled → archived.
// Each status offers one next step (the primary button) and a few secondary actions.

export const STATUSES = ['draft', 'review', 'scheduled', 'published', 'archived'] as const;
export type ArticleStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<ArticleStatus, string> = {
  draft: 'Draft',
  review: 'In review',
  scheduled: 'Scheduled',
  published: 'Published',
  archived: 'Archived',
};

export type Intent =
  | 'autosave'
  | 'save'
  | 'review'
  | 'draft'
  | 'publish'
  | 'schedule'
  | 'update'
  | 'unschedule'
  | 'unpublish'
  | 'archive'
  | 'restore';

const ACTIONS: Record<ArticleStatus, { primary: Intent; others: Intent[] }> = {
  draft: { primary: 'review', others: ['save', 'publish', 'schedule', 'archive'] },
  review: { primary: 'publish', others: ['save', 'schedule', 'draft', 'archive'] },
  scheduled: { primary: 'update', others: ['publish', 'unschedule', 'archive'] },
  published: { primary: 'update', others: ['unpublish', 'archive'] },
  archived: { primary: 'restore', others: [] },
};

export function statusActions(status: ArticleStatus): { primary: Intent; others: Intent[] } {
  return { primary: ACTIONS[status].primary, others: [...ACTIONS[status].others] };
}

export function canAutosave(status: ArticleStatus): boolean {
  return status === 'draft' || status === 'review';
}

export function intentLabel(intent: Intent, status: ArticleStatus): string {
  switch (intent) {
    case 'autosave':
    case 'save':
      return 'Save draft';
    case 'review':
      return 'Send for review';
    case 'draft':
      return 'Back to draft';
    case 'publish':
      return status === 'review' ? 'Publish' : 'Publish now';
    case 'schedule':
      return 'Schedule';
    case 'update':
      return status === 'scheduled' ? 'Save changes' : 'Update';
    case 'unschedule':
      return 'Cancel schedule';
    case 'unpublish':
      return 'Unpublish';
    case 'archive':
      return 'Archive';
    case 'restore':
      return 'Restore to draft';
  }
}

/** Actions that take an article off the site or out of the flow ask for confirmation first. */
export const CONFIRMATIONS: Partial<Record<Intent, { title: string; body: string; confirm: string }>> = {
  unpublish: {
    title: 'Unpublish this article?',
    body: 'Readers will no longer see it. It goes back to Draft and keeps its history.',
    confirm: 'Unpublish',
  },
  archive: {
    title: 'Archive this article?',
    body: 'Archived articles are hidden from readers and read-only. You can restore it to Draft later.',
    confirm: 'Archive',
  },
};

export type Timing = { status: ArticleStatus; published_at: string | null; scheduled_at: string | null };

export type TransitionResult =
  | {
      ok: true;
      status: ArticleStatus;
      published_at: string | null;
      scheduled_at: string | null;
      major_update_at?: string;
      note: string;
      throttle: boolean;
      needsRules: boolean;
    }
  | { ok: false; error: string; field?: 'scheduledAt' };

const ARTICLE_NOUN: Record<ArticleStatus, string> = {
  draft: 'a draft',
  review: 'an article in review',
  scheduled: 'a scheduled article',
  published: 'a published article',
  archived: 'an archived article',
};

function scheduleProblem(at: Date | null | undefined, now: Date): string | null {
  if (!at) return 'Choose a date and time to publish.';
  if (at.getTime() < now.getTime() + 60_000) return 'Choose a time at least a minute from now.';
  return null;
}

export function transition(
  current: Timing,
  intent: Intent,
  options: { now: Date; scheduledAt?: Date | null; majorUpdate?: boolean },
): TransitionResult {
  const { now } = options;
  const allowed = intent === 'autosave' ? canAutosave(current.status) : intent === statusActions(current.status).primary || statusActions(current.status).others.includes(intent);
  if (!allowed) return { ok: false, error: `This action is not available for ${ARTICLE_NOUN[current.status]}.` };

  const same = { status: current.status, published_at: current.published_at, scheduled_at: current.scheduled_at };
  const done = (changes: Partial<typeof same>, note: string, extra: { throttle?: boolean; needsRules?: boolean } = {}): TransitionResult => ({
    ok: true,
    ...same,
    ...changes,
    note,
    throttle: extra.throttle ?? false,
    needsRules: extra.needsRules ?? false,
  });

  switch (intent) {
    case 'autosave':
      return done({}, 'Autosaved', { throttle: true });
    case 'save':
      return done({}, 'Saved draft');
    case 'review':
      return done({ status: 'review' }, 'Sent for review');
    case 'draft':
      return done({ status: 'draft' }, 'Moved back to draft');
    case 'publish':
      return done({ status: 'published', published_at: current.published_at ?? now.toISOString(), scheduled_at: null }, 'Published', { needsRules: true });
    case 'schedule': {
      const problem = scheduleProblem(options.scheduledAt, now);
      if (problem) return { ok: false, field: 'scheduledAt', error: problem };
      const at = options.scheduledAt as Date;
      return done({ status: 'scheduled', scheduled_at: at.toISOString() }, `Scheduled for ${formatWib(at)} WIB`, { needsRules: true });
    }
    case 'update': {
      if (current.status === 'scheduled') {
        if (!options.scheduledAt) return done({}, 'Saved changes', { needsRules: true });
        const problem = scheduleProblem(options.scheduledAt, now);
        if (problem) return { ok: false, field: 'scheduledAt', error: problem };
        const at = options.scheduledAt.toISOString();
        return done({ scheduled_at: at }, at === current.scheduled_at ? 'Saved changes' : `Rescheduled for ${formatWib(at)} WIB`, { needsRules: true });
      }
      if (options.majorUpdate) {
        const result = done({}, 'Major update', { needsRules: true });
        return result.ok ? { ...result, major_update_at: now.toISOString() } : result;
      }
      return done({}, 'Updated', { needsRules: true });
    }
    case 'unschedule':
      return done({ status: 'draft', scheduled_at: null }, 'Schedule cancelled');
    case 'unpublish':
      return done({ status: 'draft' }, 'Unpublished');
    case 'archive':
      return done({ status: 'archived', scheduled_at: null }, 'Archived');
    case 'restore':
      return done({ status: 'draft' }, 'Restored to draft');
  }
}
