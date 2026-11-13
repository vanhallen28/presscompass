// Checks for files before upload (in the browser and on the server) and for media details.

export const MAX_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'] as const;
export const MEDIA_LIMITS = { alt: 300, caption: 300, credit: 120 } as const;

/** A message when the file cannot be uploaded, or null. */
export function checkFile(file: { type: string; size: number }): string | null {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) return 'Use a JPEG, PNG, WebP, AVIF or GIF image.';
  if (file.size <= 0) return 'The file is empty.';
  if (file.size > MAX_BYTES) return 'The file is larger than 10 MB. Make it smaller and try again.';
  return null;
}

export type MediaDetails = { alt: string; caption: string; credit: string };

export function parseMediaDetails(input: Record<string, unknown>): { values: MediaDetails; errors: Partial<Record<keyof MediaDetails, string>> } {
  const read = (key: keyof MediaDetails) => (typeof input[key] === 'string' ? (input[key] as string).trim() : '');
  const values = { alt: read('alt'), caption: read('caption'), credit: read('credit') };
  const errors: Partial<Record<keyof MediaDetails, string>> = {};
  if (values.alt.length > MEDIA_LIMITS.alt) errors.alt = `Keep the alt text under ${MEDIA_LIMITS.alt} characters.`;
  if (values.caption.length > MEDIA_LIMITS.caption) errors.caption = `Keep the caption under ${MEDIA_LIMITS.caption} characters.`;
  if (values.credit.length > MEDIA_LIMITS.credit) errors.credit = `Keep the credit under ${MEDIA_LIMITS.credit} characters.`;
  return { values, errors };
}
