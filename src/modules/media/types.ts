// A media library item as the Newsroom uses it (camelCase), and the conversion from a database row.

export type MediaItem = {
  id: string;
  publicId: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  alt: string;
  caption: string;
  credit: string;
  originalName: string;
  createdAt: string;
  uses?: number;
};

export type MediaRow = {
  id: string;
  public_id: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  alt: string;
  caption: string;
  credit: string;
  original_name: string;
  created_at: string;
  uses?: number;
};

export const MEDIA_COLUMNS = 'id,public_id,format,width,height,bytes,alt,caption,credit,original_name,created_at';

export function toMediaItem(row: MediaRow): MediaItem {
  return {
    id: row.id,
    publicId: row.public_id,
    format: row.format,
    width: row.width,
    height: row.height,
    bytes: row.bytes,
    alt: row.alt,
    caption: row.caption,
    credit: row.credit,
    originalName: row.original_name,
    createdAt: row.created_at,
    ...(row.uses !== undefined ? { uses: Number(row.uses) } : {}),
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type MediaUse = { kind: 'article' | 'author'; id: string; title: string; status: string | null; role: 'lead' | 'body' | 'photo' };
