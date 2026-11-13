import { checkCronAuth, cronAuthResponse } from '@/lib/cron-auth';
import { createAdminClient } from '@/lib/supabase/clients';
import { TAGS } from '@/modules/site/cache';
import { expireTags } from '@/modules/site/invalidate';

// Scheduled work, called by Vercel Cron once a day and by Supabase Cron every 5 minutes (docs/ops/setup.md,
// step F). Publishes scheduled articles that are due, then refreshes the site. Safe to call twice.

export async function GET(request: Request) {
  const auth = checkCronAuth(request.headers.get('authorization'), process.env.CRON_SECRET);
  if (auth !== 'ok') return cronAuthResponse(auth);

  const { data, error } = await createAdminClient().rpc('publish_due_articles');
  if (error) return Response.json({ ok: false, error: `Scheduled articles could not be published: ${error.message}` }, { status: 500 });
  const published = Number(data ?? 0);
  if (published > 0) expireTags([TAGS.articles]);
  return Response.json({ ok: true, published });
}
