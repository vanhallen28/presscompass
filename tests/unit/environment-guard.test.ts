import { describe, expect, it } from 'vitest';
import { checkEnvironmentMarker } from '@/lib/environment-guard';

describe('checkEnvironmentMarker', () => {
  it('claims an unmarked project', () => {
    expect(checkEnvironmentMarker(null, 'production')).toBe('claim');
  });

  it('accepts the matching environment', () => {
    expect(checkEnvironmentMarker('preview', 'preview')).toBe('ok');
    expect(checkEnvironmentMarker('production', 'production')).toBe('ok');
  });

  it('refuses a project that belongs to the other environment', () => {
    expect(() => checkEnvironmentMarker('production', 'preview')).toThrow(/preview deployment is connected to the production Supabase project/);
    expect(() => checkEnvironmentMarker('preview', 'production')).toThrow(/Vercel Production environment/);
  });
});
