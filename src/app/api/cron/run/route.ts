import { checkCronAuth, cronAuthResponse } from '@/lib/cron-auth';
import { createAdminClient } from '@/lib/supabase/clients';
import { syncCdnRedirects } from '@/modules/seo/cdn-sync';
import { TAGS } from '@/modules/site/cache';
import { expireTags } from '@/modules/site/invalidate';

// Scheduled work, called by Vercel Cron every 5 minutes (Pro plan, vercel.json; docs/ops/setup.md, step F).
// Publishes scheduled articles that are due, refreshes the site, and copies changed redirects to Vercel's CDN.
// Safe to call twice (an older Supabase Cron job may still call it too).

export async function GET(request: Request) {
  const auth = checkCronAuth(request.headers.get('authorization'), process.env.CRON_SECRET);
  if (auth !== 'ok') return cronAuthResponse(auth);

  const { data, error } = await createAdminClient().rpc('publish_due_articles');
  if (error) return Response.json({ ok: false, error: `Scheduled articles could not be published: ${error.message}` }, { status: 500 });
  const published = Number(data ?? 0);
  if (published > 0) expireTags([TAGS.articles]);
  const redirects = await syncCdnRedirects();
  return Response.json({ ok: true, published, redirects: redirects.status });
}
