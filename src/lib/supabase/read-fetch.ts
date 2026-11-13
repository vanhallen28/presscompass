// Fetch for the site's Supabase reads (all read-only, so safe to repeat).
//
// - `cache: 'no-store'`: the site caches whole reads with 'use cache' and tags (src/modules/site/queries.ts).
//   Next.js would otherwise also keep the raw responses in its fetch cache, untagged, so a dropped tag would
//   re-run the read and get the old response back.
// - A stalled connection is abandoned and tried once more. Without this, one request that never answers holds
//   the whole page; in `next dev` it surfaces after 10 seconds as a misleading "A "use cache" function is
//   awaiting a promise created outside it" error.

/** Time allowed for each attempt; the second gets longer. Together under the 10 seconds `next dev` waits. */
export const READ_ATTEMPTS_MS = [3_000, 5_500] as const;

export function retryingFetch(attempts: readonly number[], base: typeof fetch = (...args) => fetch(...args)): typeof fetch {
  return async (input, init) => {
    let lastError: unknown;
    for (const ms of attempts) {
      const timeout = AbortSignal.timeout(ms);
      try {
        return await base(input, { ...init, cache: 'no-store', signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout });
      } catch (error) {
        if (init?.signal?.aborted) throw error;
        lastError = error;
      }
    }
    const seconds = attempts.reduce((sum, ms) => sum + ms, 0) / 1000;
    throw new Error(
      `Supabase did not answer within ${seconds} seconds (${attempts.length} attempts). Check the internet connection and that the Supabase project is active.`,
      { cause: lastError },
    );
  };
}

export const readFetch = retryingFetch(READ_ATTEMPTS_MS);
