import type { DeployEnv } from '@/lib/env';

export type MarkerDecision = 'claim' | 'ok';

/**
 * Each Supabase project is marked with the environment that first used it (`app_meta.environment`).
 * A Preview deployment pointed at the production project (or the reverse) must refuse to start.
 */
export function checkEnvironmentMarker(stored: string | null, current: DeployEnv): MarkerDecision {
  if (stored === null) return 'claim';
  if (stored === current) return 'ok';
  throw new Error(
    `This ${current} deployment is connected to the ${stored} Supabase project. ` +
      `Check NEXT_PUBLIC_SUPABASE_URL and the Supabase keys in the Vercel ${current === 'production' ? 'Production' : 'Preview'} environment.`,
  );
}

/** Called from instrumentation.ts when a server instance starts on Vercel. */
export async function assertEnvironment(): Promise<void> {
  const { deployEnv } = await import('@/lib/env');
  const { createAdminClient } = await import('@/lib/supabase/clients');
  const current = deployEnv();
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('app_meta').select('value').eq('key', 'environment').maybeSingle();
  if (error) throw new Error(`Could not read app_meta from Supabase: ${error.message}. Have the migrations been applied?`);
  const stored = typeof data?.value === 'string' ? data.value : null;
  if (checkEnvironmentMarker(stored, current) === 'claim') {
    const { error: insertError } = await supabase.from('app_meta').insert({ key: 'environment', value: current });
    if (insertError && insertError.code !== '23505') throw new Error(`Could not mark the Supabase project: ${insertError.message}`);
  }
}
