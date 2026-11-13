'use client';

import { prepareUpload, registerUpload } from '@/modules/media/actions';
import type { MediaItem } from '@/modules/media/types';
import { checkFile } from '@/modules/media/validate';

// Uploads one file: check it, get signed fields from the server, send it straight to Cloudinary
// (XMLHttpRequest, for progress), then let the server record it. Throws an Error with a message
// the Newsroom can show as is.

function send(url: string, form: FormData, onProgress: (share: number) => void): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', url);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () => {
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(request.responseText);
      } catch {
        body = {};
      }
      resolve({ status: request.status, body });
    };
    request.onerror = () => reject(new Error('The upload was interrupted. Check your connection and try again.'));
    request.send(form);
  });
}

export async function uploadImage(file: File, onProgress: (share: number) => void = () => {}): Promise<MediaItem> {
  const problem = checkFile(file);
  if (problem) throw new Error(problem);
  const prepared = await prepareUpload({ name: file.name, type: file.type, size: file.size });
  if (!prepared.ok) throw new Error(prepared.error);

  const form = new FormData();
  for (const [key, value] of Object.entries(prepared.plan.fields)) form.append(key, value);
  form.append('file', file);
  const sent = await send(prepared.plan.uploadUrl, form, onProgress);
  if (sent.status < 200 || sent.status >= 300) {
    const message = (sent.body.error as { message?: string } | undefined)?.message;
    throw new Error(`Cloudinary refused the file${message ? `: ${message}` : '.'}`);
  }

  const recorded = await registerUpload({ publicId: prepared.plan.publicId, originalName: file.name });
  if (!recorded.ok) throw new Error(recorded.error ?? 'The image could not be saved.');
  return recorded.media;
}
