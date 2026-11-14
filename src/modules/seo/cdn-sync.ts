import 'server-only';
import { deployEnv } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/clients';
import { type CdnRedirect, type CdnState, cdnConfig, cdnHash, pushCdnRedirects } from './cdn-redirects';

// Copies the redirects table to Vercel's CDN when it changed. Runs after a redirect is saved or an article is
// saved, and from the cron job every 5 minutes (which also catches redirects made by renaming sections, tags
// and authors). Only on Vercel Production with the token set: elsewhere the site keeps redirecting by itself.
// Never throws.

export type SyncResult = { status: 'skipped' | 'unchanged' | 'synced' | 'failed'; count?: number; error?: string };

export async function syncCdnRedirects(): Promise<SyncResult> {
  const config = cdnConfig();
  if (deployEnv() !== 'production' || !config) return { status: 'skipped' };
  try {
    const supabase = createAdminClient();
    const [{ data: rows, error }, { data: meta }] = await Promise.all([
      supabase.rpc('cdn_redirects'),
      supabase.from('app_meta').select('value').eq('key', 'cdn_redirects').maybeSingle<{ value: CdnState }>(),
    ]);
    if (error) return { status: 'failed', error: error.message };
    const list = (rows ?? []) as CdnRedirect[];
    const hash = await cdnHash(list);
    if (meta?.value?.hash === hash && !meta.value.error) return { status: 'unchanged', count: list.length };
    const pushed = await pushCdnRedirects(config, list);
    const state: CdnState = {
      hash: pushed.ok ? hash : (meta?.value?.hash ?? ''),
      count: pushed.ok ? list.length : (meta?.value?.count ?? 0),
      syncedAt: pushed.ok ? new Date().toISOString() : (meta?.value?.syncedAt ?? ''),
      error: pushed.ok ? '' : pushed.error,
    };
    await supabase.from('app_meta').upsert({ key: 'cdn_redirects', value: state });
    return pushed.ok ? { status: 'synced', count: list.length } : { status: 'failed', error: pushed.error };
  } catch (error) {
    return { status: 'failed', error: (error as Error).message };
  }
}

/** For the Newsroom Redirects page: is the CDN copy on, and when did it last change. */
export function cdnConfigured(): { production: boolean; configured: boolean } {
  return { production: deployEnv() === 'production', configured: cdnConfig() !== null };
}
