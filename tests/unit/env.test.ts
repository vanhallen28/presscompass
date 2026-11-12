import { describe, expect, it } from 'vitest';
import { EnvError, deployEnv, publicEnv, secretKey, siteUrl } from '@/lib/env';

const URL_OK = 'https://abcdefghijklmnopqrst.supabase.co';

describe('publicEnv', () => {
  it('returns the origin and publishable key', () => {
    expect(
      publicEnv({ NEXT_PUBLIC_SUPABASE_URL: `${URL_OK}/`, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ' sb_publishable_abc ' }),
    ).toEqual({ supabaseUrl: URL_OK, publishableKey: 'sb_publishable_abc' });
  });

  it('allows plain http only for localhost', () => {
    expect(publicEnv({ NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' }).supabaseUrl).toBe(
      'http://127.0.0.1:54321',
    );
    expect(() => publicEnv({ NEXT_PUBLIC_SUPABASE_URL: 'http://example.com', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' })).toThrow(
      /must start with https/,
    );
  });

  it('explains missing and invalid values', () => {
    expect(() => publicEnv({})).toThrow(EnvError);
    expect(() => publicEnv({})).toThrow(/NEXT_PUBLIC_SUPABASE_URL is missing/);
    expect(() => publicEnv({ NEXT_PUBLIC_SUPABASE_URL: 'not a url', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' })).toThrow(/not a valid URL/);
    expect(() => publicEnv({ NEXT_PUBLIC_SUPABASE_URL: URL_OK })).toThrow(/PUBLISHABLE_KEY is missing/);
  });

  it('rejects legacy anon keys and other key types', () => {
    expect(() => publicEnv({ NEXT_PUBLIC_SUPABASE_URL: URL_OK, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'eyJhbGciOi.legacy' })).toThrow(/legacy anon key/);
    expect(() => publicEnv({ NEXT_PUBLIC_SUPABASE_URL: URL_OK, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_oops' })).toThrow(
      /must start with sb_publishable_/,
    );
  });
});

describe('secretKey', () => {
  it('accepts sb_secret_ keys only', () => {
    expect(secretKey({ SUPABASE_SECRET_KEY: 'sb_secret_abc' })).toBe('sb_secret_abc');
    expect(() => secretKey({})).toThrow(/SUPABASE_SECRET_KEY is missing/);
    expect(() => secretKey({ SUPABASE_SECRET_KEY: 'eyJservice' })).toThrow(/legacy service_role key/);
    expect(() => secretKey({ SUPABASE_SECRET_KEY: 'sb_publishable_x' })).toThrow(/must start with sb_secret_/);
  });
});

describe('deployEnv and siteUrl', () => {
  it('maps Vercel Production to production and everything else to preview', () => {
    expect(deployEnv({ VERCEL_ENV: 'production' })).toBe('production');
    expect(deployEnv({ VERCEL_ENV: 'preview' })).toBe('preview');
    expect(deployEnv({})).toBe('preview');
  });

  it('prefers the explicit site URL, then the Vercel production domain', () => {
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: 'https://presscompass.site/' })).toBe('https://presscompass.site');
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'presscompass.site' })).toBe('https://presscompass.site');
    expect(siteUrl({})).toBe('http://localhost:3000');
  });
});
