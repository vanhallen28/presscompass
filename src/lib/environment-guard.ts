// PressCompass runs on one Supabase project (production, Vercel Preview and the owner's computer share it).
// The migrations write `app_meta.project = "presscompass"`; a deployment whose keys point at any other
// Supabase project (or one without the migrations) refuses to start.

export const PROJECT_MARKER = 'presscompass';

export function checkProjectMarker(stored: unknown): void {
  if (stored === PROJECT_MARKER) return;
  if (stored === null || stored === undefined) {
    throw new Error(
      'This Supabase project has no PressCompass marker. Check that NEXT_PUBLIC_SUPABASE_URL and the keys belong to ' +
        'the presscompass project, and that the migrations have been applied (npm run db:push).',
    );
  }
  throw new Error(`These Supabase keys belong to "${String(stored)}", not PressCompass. Check the Supabase keys in the environment.`);
}

/** Called from instrumentation.ts when a server instance starts on Vercel. */
export async function assertProject(): Promise<void> {
  const { createAdminClient } = await import('@/lib/supabase/clients');
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('app_meta').select('value').eq('key', 'project').maybeSingle();
  if (error) {
    throw new Error(`Could not read app_meta from Supabase: ${error.message}. Are these PressCompass keys, and have the migrations been applied?`);
  }
  checkProjectMarker(data?.value ?? null);
}
