import { describe, expect, it } from 'vitest';
import { retryingFetch } from '@/lib/supabase/read-fetch';

/** A fetch that never answers until its signal aborts. */
const hang = (_input: RequestInfo | URL, init?: RequestInit) =>
  new Promise<Response>((_resolve, reject) => {
    if (init?.signal?.aborted) reject(init.signal.reason);
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
  });

describe('retryingFetch', () => {
  it('gives up on a stalled request and tries once more', async () => {
    const calls: RequestInit[] = [];
    const base = (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(init ?? {});
      return calls.length === 1 ? hang(input, init) : Promise.resolve(new Response('ok'));
    };
    const response = await retryingFetch([30, 60], base)('https://example.supabase.co/rest/v1/rpc/site_home', { method: 'POST', body: '{}' });
    expect(await response.text()).toBe('ok');
    expect(calls).toHaveLength(2);
    expect(calls.every((init) => init.cache === 'no-store' && init.body === '{}')).toBe(true);
  });

  it('explains what happened when Supabase never answers', async () => {
    await expect(retryingFetch([20, 30], hang)('https://example.supabase.co')).rejects.toThrow(
      'Supabase did not answer within 0.05 seconds (2 attempts). Check the internet connection and that the Supabase project is active.',
    );
  });

  it('does not repeat a request the caller cancelled', async () => {
    const controller = new AbortController();
    let calls = 0;
    const base = (input: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      controller.abort(new Error('cancelled'));
      return hang(input, init);
    };
    await expect(retryingFetch([1000, 1000], base)('https://example.supabase.co', { signal: controller.signal })).rejects.toThrow('cancelled');
    expect(calls).toBe(1);
  });
});
