import { createAdminClient } from '@/lib/supabase/clients';

// POST /api/not-found {path, referrer}: counts one 404 in not_found_log (log_not_found() checks and trims).
// Always answers 204, so the beacon never shows an error to readers.

export async function POST(request: Request) {
  try {
    const text = await request.text();
    if (text.length <= 2000) {
      const data = JSON.parse(text) as { path?: unknown; referrer?: unknown };
      if (typeof data.path === 'string' && data.path.startsWith('/')) {
        const referrer = typeof data.referrer === 'string' ? data.referrer : '';
        // Only other sites' pages are worth keeping as the source; our own addresses say little.
        const external = /^https?:\/\//i.test(referrer) && new URL(referrer).host !== new URL(request.url).host ? referrer : '';
        await createAdminClient().rpc('log_not_found', { p_path: decodeURIComponent(data.path).slice(0, 300), p_referrer: external.slice(0, 500) });
      }
    }
  } catch {
    // Malformed bodies and database hiccups are ignored.
  }
  return new Response(null, { status: 204 });
}
