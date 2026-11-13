import { describe, expect, it } from 'vitest';
import { checkCronAuth, cronAuthResponse } from '@/lib/cron-auth';

const SECRET = 'a'.repeat(40);

describe('checkCronAuth', () => {
  it('accepts only the exact bearer secret', () => {
    expect(checkCronAuth(`Bearer ${SECRET}`, SECRET)).toBe('ok');
    expect(checkCronAuth(`Bearer ${SECRET}x`, SECRET)).toBe('denied');
    expect(checkCronAuth(SECRET, SECRET)).toBe('denied');
    expect(checkCronAuth(null, SECRET)).toBe('denied');
  });

  it('refuses everything until a long enough secret is set', async () => {
    expect(checkCronAuth('Bearer short', 'short')).toBe('not-configured');
    expect(checkCronAuth('Bearer ', undefined)).toBe('not-configured');
    const response = cronAuthResponse('not-configured');
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: 'CRON_SECRET is not set (at least 32 characters).' });
    expect(cronAuthResponse('denied').status).toBe(401);
  });
});
