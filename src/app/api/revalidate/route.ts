import { checkCronAuth, cronAuthResponse } from '@/lib/cron-auth';
import { expireTags } from '@/modules/site/invalidate';

// Drops cached site pages by tag (src/modules/site/cache.ts). For data written outside the Newsroom:
// end-to-end tests that seed the database directly, and as a manual fix. Protected by CRON_SECRET.

const TAG = /^(site|articles|taxonomy|article:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

export async function POST(request: Request) {
  const auth = checkCronAuth(request.headers.get('authorization'), process.env.CRON_SECRET);
  if (auth !== 'ok') return cronAuthResponse(auth);
  const body = (await request.json().catch(() => null)) as { tags?: unknown } | null;
  const tags = Array.isArray(body?.tags) ? body.tags : [];
  if (!tags.length || tags.length > 20 || !tags.every((tag): tag is string => typeof tag === 'string' && TAG.test(tag))) {
    return Response.json({ ok: false, error: 'Send {"tags": [...]} with site, articles, taxonomy or article:<id>.' }, { status: 400 });
  }
  expireTags(tags);
  return Response.json({ ok: true, tags });
}
