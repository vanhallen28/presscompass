import 'server-only';
import { createSessionClient } from '@/lib/supabase/clients';
import { cloudinaryConfig } from './cloudinary';
import { MEDIA_COLUMNS, type MediaItem, type MediaRow, type MediaUse, toMediaItem } from './types';

// Reads for the media library, the image picker and articles that show images (Newsroom session).

export const MEDIA_PAGE_SIZE = 24;

function check<T>({ data, error }: { data: unknown; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

/** Whether uploads can work: the three Cloudinary keys are set. */
export function uploadsReady(): boolean {
  return cloudinaryConfig() !== null;
}

export async function listMedia({ q = '', page = 1, limit = MEDIA_PAGE_SIZE }: { q?: string; page?: number; limit?: number } = {}) {
  const supabase = await createSessionClient();
  const result = check<{ total: number; rows: MediaRow[] }>(
    await supabase.rpc('newsroom_media', { p_query: q || null, p_limit: limit, p_offset: Math.max(0, page - 1) * limit }),
  );
  return { total: Number(result.total), items: result.rows.map(toMediaItem) };
}

export async function getMedia(id: string): Promise<MediaItem | null> {
  const supabase = await createSessionClient();
  const row = check<MediaRow | null>(await supabase.from('media').select(MEDIA_COLUMNS).eq('id', id).maybeSingle());
  return row ? toMediaItem(row) : null;
}

export async function mediaUsage(id: string): Promise<MediaUse[]> {
  const supabase = await createSessionClient();
  return check(await supabase.rpc('media_usage', { p_id: id }));
}

/** Media by id, for articles and previews that show several images. */
export async function mediaByIds(ids: (string | null | undefined)[]): Promise<Map<string, MediaItem>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!unique.length) return new Map();
  const supabase = await createSessionClient();
  const rows = check<MediaRow[]>(await supabase.from('media').select(MEDIA_COLUMNS).in('id', unique));
  return new Map(rows.map((row) => [row.id, toMediaItem(row)]));
}
