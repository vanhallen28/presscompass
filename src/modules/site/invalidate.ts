import 'server-only';
import { revalidateTag, updateTag } from 'next/cache';
import { TAGS } from './cache';

// Drops cached site pages after the Newsroom changes what readers see. From Server Actions, updateTag makes
// the next request wait for fresh data (the editor sees the change straight away); route handlers (cron,
// /api/revalidate) cannot use it and expire the tags instead.

/** Articles were published, unpublished, archived or edited while published. */
export function refreshArticles(ids: string[]) {
  updateTag(TAGS.articles);
  for (const id of ids) updateTag(TAGS.article(id));
}

/** Something used across the site changed: sections, tags, authors, image details. */
export function refreshSite() {
  updateTag(TAGS.site);
}

/** For route handlers. */
export function expireTags(tags: string[]) {
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
}
