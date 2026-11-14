// Vercel bulk redirects (Pro plan): the redirects table is copied to Vercel's CDN, which answers old addresses
// with a real 308 and a Location header before any page runs. Pure: configuration, payload, the two REST calls
// (stage with overwrite, then promote). The sync that reads the database is in cdn-sync.ts.
//
// API (vercel.com/docs/rest-api, bulk redirects): PUT /v1/bulk-redirects {projectId, teamId, overwrite, redirects}
// returns the staged version; POST /v1/bulk-redirects/versions?projectId=&teamId= {id, action: 'promote'} makes it live.

export type CdnConfig = { token: string; projectId: string; teamId: string; api: string };
export type CdnRedirect = { source: string; destination: string };
export type CdnState = { hash: string; count: number; syncedAt: string; error: string };

type Env = Record<string, string | undefined>;

/** The Vercel token and IDs from the environment, or null when any is missing (the site then redirects by itself). */
export function cdnConfig(env: Env = process.env): CdnConfig | null {
  const token = env.VERCEL_REDIRECTS_TOKEN?.trim() ?? '';
  const projectId = (env.VERCEL_REDIRECTS_PROJECT_ID || env.VERCEL_PROJECT_ID || '').trim();
  const teamId = env.VERCEL_REDIRECTS_TEAM_ID?.trim() ?? '';
  if (!token || !projectId || !teamId) return null;
  return { token, projectId, teamId, api: (env.VERCEL_API_URL || 'https://api.vercel.com').replace(/\/$/, '') };
}

/** What Vercel stores for each redirect: permanent, any letter case, query strings carried over. */
export function cdnPayload(rows: CdnRedirect[]) {
  return rows.map((row) => ({ source: row.source, destination: row.destination, statusCode: 308, caseSensitive: false, preserveQueryParams: true }));
}

/** A short fingerprint of the list, to skip syncing when nothing changed. */
export async function cdnHash(rows: CdnRedirect[]): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(rows)));
  return Array.from(new Uint8Array(bytes).slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function call(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; error: string }> {
  try {
    const response = await fetcher(url, { ...init, signal: AbortSignal.timeout(15_000) });
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      const message = (body.error as { message?: string } | undefined)?.message ?? response.statusText;
      return { ok: false, error: `Vercel answered ${response.status}: ${message}` };
    }
    return { ok: true, body };
  } catch (error) {
    return { ok: false, error: `Vercel could not be reached: ${(error as Error).message}` };
  }
}

/** Replaces every bulk redirect of the project with `rows` and makes the new version live. */
export async function pushCdnRedirects(
  config: CdnConfig,
  rows: CdnRedirect[],
  fetcher: typeof fetch = fetch,
): Promise<{ ok: true; versionId: string } | { ok: false; error: string }> {
  const headers = { authorization: `Bearer ${config.token}`, 'content-type': 'application/json' };
  const ids = `projectId=${encodeURIComponent(config.projectId)}&teamId=${encodeURIComponent(config.teamId)}`;
  const staged = await call(fetcher, `${config.api}/v1/bulk-redirects?teamId=${encodeURIComponent(config.teamId)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      projectId: config.projectId,
      teamId: config.teamId,
      overwrite: true,
      name: `PressCompass ${new Date().toISOString()}`,
      redirects: cdnPayload(rows),
    }),
  });
  if (!staged.ok) return staged;
  const versionId = (staged.body.version as { id?: string } | undefined)?.id;
  if (!versionId) return { ok: false, error: 'Vercel did not return a version to publish.' };
  const promoted = await call(fetcher, `${config.api}/v1/bulk-redirects/versions?${ids}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ id: versionId, action: 'promote' }),
  });
  return promoted.ok ? { ok: true, versionId } : promoted;
}
