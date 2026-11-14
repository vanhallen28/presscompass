// Checks shared by `npm run check` and `npm run content:starter`: the keys in .env, the Supabase project, and the
// Cloudinary account. Each check returns { ok, message, fix } so callers can print them or stop on the first problem.
import { createClient } from '@supabase/supabase-js';

const env = (name) => process.env[name]?.trim() ?? '';

export function readEnv() {
  return {
    supabaseUrl: env('NEXT_PUBLIC_SUPABASE_URL'),
    publishableKey: env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
    secretKey: env('SUPABASE_SECRET_KEY'),
    siteUrl: env('NEXT_PUBLIC_SITE_URL'),
    cronSecret: env('CRON_SECRET'),
    cloud: {
      name: env('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME'),
      key: env('CLOUDINARY_API_KEY'),
      secret: env('CLOUDINARY_API_SECRET'),
      api: env('CLOUDINARY_API_URL') || 'https://api.cloudinary.com',
    },
  };
}

const ok = (message) => ({ ok: true, message });
const bad = (message, fix) => ({ ok: false, message, fix });

/** The .env values themselves, without contacting anything. */
export function checkEnvValues(e) {
  const results = [];
  results.push(
    /^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(e.supabaseUrl) || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(e.supabaseUrl)
      ? ok(`Supabase URL: ${e.supabaseUrl}`)
      : bad(
          `NEXT_PUBLIC_SUPABASE_URL is ${e.supabaseUrl ? `"${e.supabaseUrl}"` : 'empty'}.`,
          'Copy the Project URL from Supabase (Project Settings, Data API), for example https://abcdefghijklmnopqrst.supabase.co, with no slash at the end.',
        ),
  );
  results.push(
    e.publishableKey.startsWith('sb_publishable_')
      ? ok('Supabase publishable key: present')
      : bad('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must start with sb_publishable_.', 'Copy it from Supabase (Project Settings, API Keys).'),
  );
  results.push(
    e.secretKey.startsWith('sb_secret_')
      ? ok('Supabase secret key: present')
      : bad('SUPABASE_SECRET_KEY must start with sb_secret_.', 'Copy it from Supabase (Project Settings, API Keys, Secret keys).'),
  );
  results.push(
    e.cloud.name && e.cloud.key && e.cloud.secret
      ? ok(`Cloudinary keys: present (cloud name ${e.cloud.name})`)
      : bad(
          'One of NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET is empty.',
          'Copy all three from Cloudinary (Settings, API Keys) into .env.',
        ),
  );
  results.push(
    e.cronSecret.length >= 32
      ? ok('CRON_SECRET: present')
      : bad(
          'CRON_SECRET is missing or shorter than 32 characters.',
          'Optional on your computer; required on Vercel for scheduled publishing (docs/ops/setup.md, step F).',
        ),
  );
  return results;
}

export function secretClient(e) {
  return createClient(e.supabaseUrl, e.secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

const withTimeout = (ms) => ({ signal: AbortSignal.timeout(ms) });

/** Reaches the project with the secret key and checks that the PressCompass migrations are applied. */
export async function checkSupabase(e) {
  const supabase = createClient(e.supabaseUrl, e.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, ...withTimeout(10_000) }) },
  });
  const { data, error } = await supabase.from('app_meta').select('value').eq('key', 'project').maybeSingle();
  if (error) {
    if (/abort|timeout/i.test(error.message)) {
      return bad(
        'Supabase did not answer within 10 seconds.',
        'Check the internet connection and, in the Supabase dashboard, that the project is active (not paused).',
      );
    }
    if (/fetch failed|ENOTFOUND|ECONNREFUSED|getaddrinfo/i.test(error.message)) {
      return bad(
        `Supabase could not be reached at ${e.supabaseUrl}.`,
        'Check the internet connection and that NEXT_PUBLIC_SUPABASE_URL is the Project URL of the presscompass project.',
      );
    }
    return bad(
      `Supabase did not accept the request: ${error.message}`,
      'Check that NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env come from the same project, then run npm run db:push.',
    );
  }
  if (data?.value !== 'presscompass')
    return bad('This Supabase project is not set up for PressCompass.', 'Run npm run db:link and npm run db:push for the right project.');
  // The function added by the newest migration (v0.6.1, redirects for Vercel): missing means npm run db:push has not run since.
  const newest = await supabase.rpc('cdn_redirects');
  if (newest.error) return bad('The newest database changes are missing (cdn_redirects, v0.6.1).', 'Run npm run db:link and npm run db:push.');
  return ok('Supabase project: reachable, migrations applied');
}

/** Checks the Cloudinary keys with a signed Admin API request (reads one resource; nothing is changed). */
export async function checkCloudinary(e, publicId = 'presscompass/images/__check__') {
  const { name, key, secret, api } = e.cloud;
  if (!name || !key || !secret) return bad('Cloudinary keys are missing from .env.', 'Copy them from Cloudinary (Settings, API Keys).');
  const auth = `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`;
  try {
    const response = await fetch(`${api}/v1_1/${name}/resources/image/upload/${publicId}`, {
      headers: { authorization: auth },
      ...withTimeout(10_000),
    });
    const body = await response.json().catch(() => ({}));
    const message = String(body.error?.message ?? '');
    if (response.ok || (response.status === 404 && /^Resource not found/i.test(message))) return ok('Cloudinary keys: accepted');
    if (/cloud_name/i.test(message))
      return bad(`Cloudinary does not know the cloud name "${name}".`, 'Copy the Cloud name exactly from Cloudinary (Settings, API Keys).');
    return bad(
      `Cloudinary refused the keys: ${message || response.statusText}.`,
      'Copy the API Key and API Secret again from Cloudinary (Settings, API Keys); they must belong to the same cloud name.',
    );
  } catch (error) {
    return bad(`Cloudinary could not be reached: ${error.message}`, 'Check the internet connection.');
  }
}

/** Article and page counts by status (secret key). */
export async function contentCounts(e) {
  const supabase = secretClient(e);
  const count = async (table, status) => {
    const { count: n } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('status', status);
    return n ?? 0;
  };
  const { count: staff } = await supabase.from('staff').select('user_id', { count: 'exact', head: true });
  return {
    published: await count('articles', 'published'),
    drafts: await count('articles', 'draft'),
    pagesPublished: await count('pages', 'published'),
    pagesDraft: await count('pages', 'draft'),
    staff: staff ?? 0,
  };
}

/** Asks a running site (npm run dev or the live site) to drop its cached pages. Never throws. */
export async function refreshRunningSite(e) {
  if (!e.siteUrl || e.cronSecret.length < 32) return { ok: false, message: 'skipped (NEXT_PUBLIC_SITE_URL or CRON_SECRET not set)' };
  try {
    const response = await fetch(`${e.siteUrl.replace(/\/$/, '')}/api/revalidate`, {
      method: 'POST',
      headers: { authorization: `Bearer ${e.cronSecret}`, 'content-type': 'application/json' },
      body: JSON.stringify({ tags: ['site'] }),
      ...withTimeout(5_000),
    });
    return response.ok ? { ok: true, message: `refreshed ${e.siteUrl}` } : { ok: false, message: `${e.siteUrl} answered ${response.status}` };
  } catch {
    return { ok: false, message: `${e.siteUrl} is not running` };
  }
}
