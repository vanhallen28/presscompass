import { describe, expect, it } from 'vitest';
import { youtubeId } from '@/lib/doc/youtube';

describe('youtubeId', () => {
  it('reads the common YouTube link shapes and bare IDs', () => {
    for (const link of [
      'dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s',
      'youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ?si=abc',
      'https://m.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      'https://www.youtube.com/live/dQw4w9WgXcQ',
    ]) {
      expect(youtubeId(link)).toBe('dQw4w9WgXcQ');
    }
  });

  it('refuses other sites and broken links', () => {
    expect(youtubeId('https://vimeo.com/12345678901')).toBeNull();
    expect(youtubeId('https://evil.example/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(youtubeId('https://www.youtube.com/watch?v=short')).toBeNull();
    expect(youtubeId('')).toBeNull();
  });
});
