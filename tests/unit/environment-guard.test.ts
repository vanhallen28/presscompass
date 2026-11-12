import { describe, expect, it } from 'vitest';
import { PROJECT_MARKER, checkProjectMarker } from '@/lib/environment-guard';

describe('checkProjectMarker', () => {
  it('accepts the PressCompass project', () => {
    expect(() => checkProjectMarker(PROJECT_MARKER)).not.toThrow();
  });

  it('refuses a project without the marker (wrong keys or migrations not applied)', () => {
    expect(() => checkProjectMarker(null)).toThrow(/no PressCompass marker/);
    expect(() => checkProjectMarker(undefined)).toThrow(/npm run db:push/);
  });

  it('refuses keys that belong to another project', () => {
    expect(() => checkProjectMarker('point-lat')).toThrow(/belong to "point-lat", not PressCompass/);
  });
});
