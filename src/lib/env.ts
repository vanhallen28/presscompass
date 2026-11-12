// Reads and validates the environment. Values come from the Supabase project's own API keys
// (Settings, API Keys): the Project URL, the publishable key and the secret key.

export class EnvError extends Error {
  name = 'EnvError';
}

type Source = Record<string, string | undefined>;

const LEGACY_JWT = /^eyJ/;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

export type PublicEnv = { supabaseUrl: string; publishableKey: string };

/** Project URL and publishable key. Safe for the browser; used for public reads and the Newsroom session. */
export function publicEnv(source: Source = process.env): PublicEnv {
  const rawUrl = source.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!rawUrl) throw new EnvError('NEXT_PUBLIC_SUPABASE_URL is missing. Copy the Project URL from Supabase.');
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new EnvError('NEXT_PUBLIC_SUPABASE_URL is not a valid URL.');
  }
  if (url.protocol !== 'https:' && !LOCAL_HOSTS.has(url.hostname)) {
    throw new EnvError('NEXT_PUBLIC_SUPABASE_URL must start with https://.');
  }
  if (!key) throw new EnvError('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing. Copy the publishable key from Supabase.');
  if (LEGACY_JWT.test(key)) {
    throw new EnvError('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is a legacy anon key. Use the publishable key (sb_publishable_...).');
  }
  if (!key.startsWith('sb_publishable_')) {
    throw new EnvError('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must start with sb_publishable_.');
  }
  return { supabaseUrl: url.origin, publishableKey: key };
}

/** Secret key. Server only: it bypasses Row Level Security. */
export function secretKey(source: Source = process.env): string {
  const key = source.SUPABASE_SECRET_KEY?.trim();
  if (!key) throw new EnvError('SUPABASE_SECRET_KEY is missing. Copy the secret key from Supabase.');
  if (LEGACY_JWT.test(key)) {
    throw new EnvError('SUPABASE_SECRET_KEY is a legacy service_role key. Use a secret key (sb_secret_...).');
  }
  if (!key.startsWith('sb_secret_')) throw new EnvError('SUPABASE_SECRET_KEY must start with sb_secret_.');
  return key;
}

export type DeployEnv = 'production' | 'preview';

/** Vercel Production is `production`; Preview deployments and the owner's computer share the preview project. */
export function deployEnv(source: Source = process.env): DeployEnv {
  return source.VERCEL_ENV === 'production' ? 'production' : 'preview';
}

/** Canonical site origin without a trailing slash. */
export function siteUrl(source: Source = process.env): string {
  const explicit = source.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  if (source.VERCEL_PROJECT_PRODUCTION_URL) return `https://${source.VERCEL_PROJECT_PRODUCTION_URL}`;
  return 'http://localhost:3000';
}
