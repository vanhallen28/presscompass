import 'server-only';
import { revalidateTag } from 'next/cache';
import { TAGS } from './cache';

// Drops cached site pages after the Newsroom changes what readers see.
//
// From Server Actions the tags expire after one second instead of at once: an immediate expiry (updateTag,
// or expire: 0) makes Next.js re-render the current Newsroom page in the action's response, which remounts
// the article editor mid-session. With one second, the first reader request after it waits for fresh data.

const FROM_NEWSROOM = { expire: 1 };

/** Articles were published, unpublished, archived or edited while published. */
export function refreshArticles(ids: string[]) {
  revalidateTag(TAGS.articles, FROM_NEWSROOM);
  for (const id of ids) revalidateTag(TAGS.article(id), FROM_NEWSROOM);
}

/** Something used across the site changed: sections, tags, authors, image details. */
export function refreshSite() {
  revalidateTag(TAGS.site, FROM_NEWSROOM);
}

/** For route handlers (cron, /api/revalidate): expire at once. */
export function expireTags(tags: string[]) {
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
}
