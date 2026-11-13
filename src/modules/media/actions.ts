'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { UUID } from '@/lib/doc/schema';
import { createSessionClient } from '@/lib/supabase/clients';
import { requireStaff } from '@/modules/auth/staff';
import { cloudinaryConfig, destroyAsset, FOLDER, fetchResource, type UploadPlan, uploadPlan } from './cloudinary';
import { listMedia, mediaUsage } from './queries';
import { MEDIA_COLUMNS, type MediaItem, type MediaRow, toMediaItem } from './types';
import { checkFile, type MediaDetails, parseMediaDetails } from './validate';

// Server Actions for media. Uploads go browser → Cloudinary directly; the server signs the request
// first and checks the result with the Admin API afterwards, so only real uploads are recorded.

const NOT_CONNECTED = 'Cloudinary is not connected yet. Add the three Cloudinary keys to .env on your computer and to Vercel, then try again.';

export type PrepareResult = { ok: true; plan: UploadPlan } | { ok: false; error: string };

export async function prepareUpload(file: { name: string; type: string; size: number }): Promise<PrepareResult> {
  await requireStaff();
  const config = cloudinaryConfig();
  if (!config) return { ok: false, error: NOT_CONNECTED };
  const problem = checkFile({ type: String(file?.type ?? ''), size: Number(file?.size ?? 0) });
  if (problem) return { ok: false, error: problem };
  return { ok: true, plan: uploadPlan(config, { fileName: String(file.name ?? 'image'), now: Math.floor(Date.now() / 1000) }) };
}

export type MediaResult = { ok: true; media: MediaItem } | { ok: false; error?: string; errors?: Partial<Record<keyof MediaDetails, string>> };

/** Records an upload after Cloudinary confirms it has the image. Sizes come from Cloudinary, not the browser. */
export async function registerUpload(input: { publicId: string; originalName: string } & Partial<MediaDetails>): Promise<MediaResult> {
  await requireStaff();
  const config = cloudinaryConfig();
  if (!config) return { ok: false, error: NOT_CONNECTED };
  const publicId = String(input?.publicId ?? '');
  if (!publicId.startsWith(`${FOLDER}/`) || publicId.includes('..')) return { ok: false, error: 'This upload cannot be recorded.' };
  const { values, errors } = parseMediaDetails(input as Record<string, unknown>);
  if (Object.keys(errors).length) return { ok: false, errors };

  let resource;
  try {
    resource = await fetchResource(config, publicId);
  } catch (error) {
    return { ok: false, error: `Cloudinary could not be reached. ${(error as Error).message}` };
  }
  if (!resource) return { ok: false, error: 'The file did not reach Cloudinary. Upload it again.' };

  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from('media')
    .upsert(
      {
        public_id: resource.publicId,
        format: resource.format,
        width: resource.width,
        height: resource.height,
        bytes: resource.bytes,
        original_name: String(input.originalName ?? '').slice(0, 200),
        ...values,
      },
      { onConflict: 'public_id' },
    )
    .select(MEDIA_COLUMNS)
    .single();
  if (error || !data) return { ok: false, error: `The image is on Cloudinary but could not be saved here. ${error?.message ?? ''}` };
  return { ok: true, media: toMediaItem(data as MediaRow) };
}

/** Saves alt text, caption and credit (used by the image picker). */
export async function saveMediaDetails(id: string, details: Partial<MediaDetails>): Promise<MediaResult> {
  await requireStaff();
  if (!UUID.test(String(id))) return { ok: false, error: 'Unknown image.' };
  const { values, errors } = parseMediaDetails(details as Record<string, unknown>);
  if (Object.keys(errors).length) return { ok: false, errors };
  const supabase = await createSessionClient();
  const { data, error } = await supabase.from('media').update(values).eq('id', id).select(MEDIA_COLUMNS).single();
  if (error || !data) return { ok: false, error: `The details could not be saved. ${error?.message ?? ''}` };
  return { ok: true, media: toMediaItem(data as MediaRow) };
}

export type MediaFormState = { errors: Partial<Record<keyof MediaDetails, string>>; values?: MediaDetails; message?: string; saved?: boolean };

/** The details form on a media page. */
export async function updateMedia(_prev: MediaFormState, form: FormData): Promise<MediaFormState> {
  const result = await saveMediaDetails(String(form.get('id') ?? ''), Object.fromEntries(form) as Partial<MediaDetails>);
  if (result.ok) {
    refresh();
    return { errors: {}, values: { alt: result.media.alt, caption: result.media.caption, credit: result.media.credit }, saved: true };
  }
  return { errors: result.errors ?? {}, values: parseMediaDetails(Object.fromEntries(form)).values, message: result.error };
}

/** Deletes an unused image: the record first, then the file on Cloudinary. */
export async function deleteMedia(form: FormData) {
  await requireStaff();
  const id = String(form.get('id') ?? '');
  if (!UUID.test(id)) redirect('/newsroom/media');
  if ((await mediaUsage(id)).length) redirect(`/newsroom/media/${id}?notice=in-use`);
  const supabase = await createSessionClient();
  const { data, error } = await supabase.from('media').delete().eq('id', id).select('public_id');
  const row = (data as { public_id: string }[] | null)?.[0];
  if (error || !row) redirect(`/newsroom/media/${id}?notice=delete-failed`);
  const config = cloudinaryConfig();
  if (config) {
    const removed = await destroyAsset(config, row.public_id, Math.floor(Date.now() / 1000)).catch(() => false);
    if (!removed) console.error(`Cloudinary did not delete ${row.public_id}. Remove it in the Cloudinary Media Library.`);
  }
  redirect('/newsroom/media?notice=deleted');
}

/** Pages of the library for the image picker. */
export async function searchMedia(query: string, page = 1): Promise<{ total: number; items: MediaItem[] }> {
  await requireStaff();
  return listMedia({ q: String(query ?? '').slice(0, 100), page: Math.max(1, Math.floor(Number(page) || 1)), limit: 12 });
}
