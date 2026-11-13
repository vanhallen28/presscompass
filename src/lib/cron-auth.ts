import { createHash, timingSafeEqual } from 'node:crypto';

// Checks `Authorization: Bearer <CRON_SECRET>` on system endpoints (Vercel Cron and Supabase Cron send it).

export const CRON_SECRET_MIN = 32;

export type CronAuth = 'ok' | 'not-configured' | 'denied';

export function checkCronAuth(header: string | null, secret: string | undefined): CronAuth {
  const expected = secret?.trim() ?? '';
  if (expected.length < CRON_SECRET_MIN) return 'not-configured';
  const given = /^Bearer (.+)$/.exec(header ?? '')?.[1] ?? '';
  // Compare digests so the comparison takes the same time whatever the length.
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(given), digest(expected)) ? 'ok' : 'denied';
}

export function cronAuthResponse(result: Exclude<CronAuth, 'ok'>): Response {
  return result === 'not-configured'
    ? Response.json({ ok: false, error: `CRON_SECRET is not set (at least ${CRON_SECRET_MIN} characters).` }, { status: 503 })
    : Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
}
