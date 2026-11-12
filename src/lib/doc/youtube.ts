import { YOUTUBE_ID } from './schema';

/** The video ID from a YouTube link (watch, youtu.be, shorts, embed, live) or a bare ID; null otherwise. */
export function youtubeId(input: string): string | null {
  const value = input.trim();
  if (YOUTUBE_ID.test(value)) return value;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = url.pathname.split('/')[1] ?? null;
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else {
      const [, kind, candidate] = url.pathname.split('/');
      if (['shorts', 'embed', 'live', 'v'].includes(kind)) id = candidate ?? null;
    }
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}
