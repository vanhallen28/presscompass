import { describe, expect, it } from 'vitest';
import { SIGN_IN_MESSAGES, signInErrorMessage } from '@/modules/auth/messages';
import { loginUrl, safeNextPath } from '@/modules/auth/paths';

describe('safeNextPath', () => {
  it('keeps Newsroom paths', () => {
    expect(safeNextPath('/newsroom/articles?status=draft')).toBe('/newsroom/articles?status=draft');
    expect(safeNextPath(encodeURIComponent('/newsroom/media'))).toBe('/newsroom/media');
    expect(safeNextPath('/newsroom')).toBe('/newsroom');
  });

  it('falls back to the Newsroom home for anything else', () => {
    for (const raw of [null, undefined, '', 'https://evil.example', '//evil.example', '/\\evil', '/business/story', '/newsroomx', '/newsroom/login', '%E0%A4%A']) {
      expect(safeNextPath(raw)).toBe('/newsroom');
    }
  });
});

describe('loginUrl', () => {
  it('adds the destination only when it is not the Newsroom home', () => {
    expect(loginUrl()).toBe('/newsroom/login');
    expect(loginUrl('/newsroom')).toBe('/newsroom/login');
    expect(loginUrl('/newsroom/articles')).toBe('/newsroom/login?next=%2Fnewsroom%2Farticles');
  });
});

describe('signInErrorMessage', () => {
  it('maps Supabase Auth errors to actionable messages', () => {
    expect(signInErrorMessage({ code: 'invalid_credentials', status: 400 })).toBe(SIGN_IN_MESSAGES.invalidCredentials);
    expect(signInErrorMessage({ status: 400, message: 'Invalid login credentials' })).toBe(SIGN_IN_MESSAGES.invalidCredentials);
    expect(signInErrorMessage({ status: 429 })).toBe(SIGN_IN_MESSAGES.rateLimited);
    expect(signInErrorMessage({ name: 'AuthRetryableFetchError', status: 0, message: 'fetch failed' })).toBe(SIGN_IN_MESSAGES.unreachable);
    expect(signInErrorMessage({ name: 'EnvError', message: 'missing' })).toBe(SIGN_IN_MESSAGES.notConfigured);
    expect(signInErrorMessage({ status: 500, message: 'boom' })).toBe(SIGN_IN_MESSAGES.unknown);
  });
});
