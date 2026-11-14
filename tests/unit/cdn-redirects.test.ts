import { describe, expect, it } from 'vitest';
import { cdnConfig, cdnHash, cdnPayload, pushCdnRedirects } from '@/modules/seo/cdn-redirects';

const CONFIG = { token: 'tok', projectId: 'prj_1', teamId: 'team_1', api: 'https://api.example' };
const ROWS = [{ source: '/old', destination: '/business/new' }];

type Call = { url: string; method?: string; body: Record<string, unknown>; auth: string | null };

function fakeFetch(responses: { status: number; body: unknown }[]) {
  const calls: Call[] = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    calls.push({ url, method: init.method, body: JSON.parse(String(init.body)), auth: new Headers(init.headers).get('authorization') });
    const next = responses.shift() ?? { status: 500, body: {} };
    return new Response(JSON.stringify(next.body), { status: next.status, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { fetcher, calls };
}

describe('Vercel bulk redirects', () => {
  it('needs a token, a project and a team', () => {
    expect(cdnConfig({})).toBeNull();
    expect(cdnConfig({ VERCEL_REDIRECTS_TOKEN: 't', VERCEL_REDIRECTS_TEAM_ID: 'team' })).toBeNull();
    expect(cdnConfig({ VERCEL_REDIRECTS_TOKEN: ' t ', VERCEL_PROJECT_ID: 'prj', VERCEL_REDIRECTS_TEAM_ID: 'team' })).toEqual({
      token: 't',
      projectId: 'prj',
      teamId: 'team',
      api: 'https://api.vercel.com',
    });
  });

  it('sends permanent redirects that keep the query string, and fingerprints the list', async () => {
    expect(cdnPayload(ROWS)).toEqual([
      { source: '/old', destination: '/business/new', statusCode: 308, caseSensitive: false, preserveQueryParams: true },
    ]);
    expect(await cdnHash(ROWS)).toBe(await cdnHash([{ source: '/old', destination: '/business/new' }]));
    expect(await cdnHash(ROWS)).not.toBe(await cdnHash([]));
  });

  it('replaces every redirect, then promotes the new version', async () => {
    const { fetcher, calls } = fakeFetch([
      { status: 200, body: { alias: null, version: { id: 'icfg_1', createdBy: 'x', key: 'k', lastModified: 1 } } },
      { status: 200, body: { version: { id: 'icfg_1', isLive: true } } },
    ]);
    expect(await pushCdnRedirects(CONFIG, ROWS, fetcher)).toEqual({ ok: true, versionId: 'icfg_1' });
    expect(calls[0]).toMatchObject({ url: 'https://api.example/v1/bulk-redirects?teamId=team_1', method: 'PUT', auth: 'Bearer tok' });
    expect(calls[0].body).toMatchObject({ projectId: 'prj_1', teamId: 'team_1', overwrite: true, redirects: cdnPayload(ROWS) });
    expect(calls[1]).toMatchObject({
      url: 'https://api.example/v1/bulk-redirects/versions?projectId=prj_1&teamId=team_1',
      method: 'POST',
      body: { id: 'icfg_1', action: 'promote' },
    });
  });

  it('reports what Vercel refused', async () => {
    const forbidden = fakeFetch([{ status: 403, body: { error: { message: 'Not authorized' } } }]);
    expect(await pushCdnRedirects(CONFIG, ROWS, forbidden.fetcher)).toEqual({ ok: false, error: 'Vercel answered 403: Not authorized' });
    expect(forbidden.calls).toHaveLength(1);
    const noVersion = fakeFetch([{ status: 200, body: {} }]);
    expect(await pushCdnRedirects(CONFIG, ROWS, noVersion.fetcher)).toEqual({ ok: false, error: 'Vercel did not return a version to publish.' });
  });
});
