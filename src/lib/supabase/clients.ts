import 'server-only';
import { cookies } from 'next/headers';
import { connection } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { publicEnv, secretKey } from '@/lib/env';

const NO_SESSION = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;

/**
 * Public reads for the site, with the publishable key and no session (`anon` role).
 * Row Level Security only returns published rows.
 */
export function createPublicClient() {
  const { supabaseUrl, publishableKey } = publicEnv();
  return createClient(supabaseUrl, publishableKey, { auth: NO_SESSION });
}

/**
 * The signed-in Newsroom user's client (`authenticated` role), with the session kept in cookies.
 * Writes are allowed only when `public.is_staff()` is true.
 */
export async function createSessionClient() {
  // Supabase Auth reads the clock (token expiry); under Cache Components that must happen at request time.
  await connection();
  const cookieStore = await cookies();
  const { supabaseUrl, publishableKey } = publicEnv();
  return createServerClient(supabaseUrl, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components cannot set cookies; src/proxy.ts refreshes the session on every Newsroom request.
        }
      },
    },
  });
}

/**
 * System work (cron, indexing, reader forms, logs) with the secret key.
 * Bypasses Row Level Security: never import from client components or pass its results to the browser unfiltered.
 */
export function createAdminClient() {
  const { supabaseUrl } = publicEnv();
  return createClient(supabaseUrl, secretKey(), { auth: NO_SESSION });
}
