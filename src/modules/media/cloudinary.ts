import { createHash, randomBytes } from 'node:crypto';
import { slugify } from '@/lib/slug';

// Cloudinary over plain HTTP: signed direct uploads from the browser, reading an uploaded image back
// through the Admin API, and deleting it. No SDK. Server only: this module handles the API secret.

export type CloudinaryConfig = { cloudName: string; apiKey: string; apiSecret: string; apiUrl: string };

export const FOLDER = 'presscompass/images';
export const ALLOWED_FORMATS = 'jpg,png,webp,avif,gif';
/** Incoming transformation: images are stored at most 2560 px wide, at automatic quality. */
export const INCOMING = 'c_limit,w_2560,q_auto';

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

/** Reads the Cloudinary keys from the environment, or null when uploads are not set up. */
export function cloudinaryConfig(env: Record<string, string | undefined> = process.env): CloudinaryConfig | null {
  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = env.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret, apiUrl: env.CLOUDINARY_API_URL?.trim() || 'https://api.cloudinary.com' };
}

/**
 * The Cloudinary signature: parameters sorted by name, `name=value` joined with `&`, the API secret
 * appended, SHA-1 hex. Empty values are left out. https://cloudinary.com/documentation/authentication_signatures
 */
export function signParams(params: Record<string, string>, apiSecret: string): string {
  const serialized = Object.keys(params)
    .filter((key) => params[key] !== '' && params[key] !== undefined)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return createHash('sha1').update(serialized + apiSecret).digest('hex');
}

const suffix8 = () => randomBytes(4).toString('hex');

/** `presscompass/images/<name-from-file>-<8 hex>`. The suffix keeps uploads from overwriting each other. */
export function publicIdFor(fileName: string, suffix: () => string = suffix8): string {
  const base = slugify(fileName.replace(/\.[^.]*$/, ''), 60) || 'image';
  return `${FOLDER}/${base}-${suffix()}`;
}

export type UploadPlan = { publicId: string; uploadUrl: string; fields: Record<string, string> };

/** Everything the browser needs to upload one file straight to Cloudinary. */
export function uploadPlan(config: CloudinaryConfig, input: { fileName: string; now: number; suffix?: () => string }): UploadPlan {
  const publicId = publicIdFor(input.fileName, input.suffix);
  const signed = {
    allowed_formats: ALLOWED_FORMATS,
    overwrite: 'false',
    public_id: publicId,
    timestamp: String(input.now),
    transformation: INCOMING,
  };
  return {
    publicId,
    uploadUrl: `${config.apiUrl}/v1_1/${config.cloudName}/image/upload`,
    fields: { ...signed, api_key: config.apiKey, signature: signParams(signed, config.apiSecret) },
  };
}

export type CloudinaryResource = { publicId: string; format: string; width: number; height: number; bytes: number };

const pathOf = (publicId: string) => publicId.split('/').map(encodeURIComponent).join('/');

/** Reads an uploaded image (Admin API). Null when Cloudinary does not have it. */
export async function fetchResource(config: CloudinaryConfig, publicId: string, fetcher: Fetcher = fetch): Promise<CloudinaryResource | null> {
  const response = await fetcher(`${config.apiUrl}/v1_1/${config.cloudName}/resources/image/upload/${pathOf(publicId)}`, {
    headers: { authorization: `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64')}` },
    cache: 'no-store',
  });
  if (response.status === 404) return null;
  const body = (await response.json()) as Record<string, unknown> & { error?: { message?: string } };
  if (!response.ok) throw new Error(`Cloudinary: ${body.error?.message ?? response.statusText}`);
  return {
    publicId: String(body.public_id),
    format: String(body.format),
    width: Number(body.width),
    height: Number(body.height),
    bytes: Number(body.bytes),
  };
}

/** Deletes an image and clears its CDN copies. True when Cloudinary removed it or never had it. */
export async function destroyAsset(config: CloudinaryConfig, publicId: string, now: number, fetcher: Fetcher = fetch): Promise<boolean> {
  const signed = { invalidate: 'true', public_id: publicId, timestamp: String(now) };
  const body = new URLSearchParams({ ...signed, api_key: config.apiKey, signature: signParams(signed, config.apiSecret) });
  const response = await fetcher(`${config.apiUrl}/v1_1/${config.cloudName}/image/destroy`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!response.ok) return false;
  const result = (await response.json()) as { result?: string };
  return result.result === 'ok' || result.result === 'not found';
}
