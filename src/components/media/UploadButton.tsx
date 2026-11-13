'use client';

import { useRouter } from 'next/navigation';
import { useId, useRef, useState } from 'react';
import { Icon } from '@/components/ds/Icon';
import { Notice } from '@/components/newsroom/ui';
import { ACCEPTED_TYPES } from '@/modules/media/validate';
import styles from './media.module.css';
import { uploadImage } from './upload';

/** Upload one or more images from the media library page. */
export function UploadButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const uid = useId();
  const [progress, setProgress] = useState<{ index: number; total: number; share: number } | null>(null);
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  async function upload(files: File[]) {
    setResult(null);
    const failures: { name: string; message: string }[] = [];
    let done = 0;
    for (const [index, file] of files.entries()) {
      setProgress({ index, total: files.length, share: 0 });
      try {
        await uploadImage(file, (share) => setProgress({ index, total: files.length, share }));
        done += 1;
      } catch (error) {
        failures.push({ name: file.name, message: (error as Error).message });
      }
    }
    setProgress(null);
    if (input.current) input.current.value = '';
    // One reason for every file (Cloudinary not connected, say) is said once, not per file.
    const shared = failures.length > 1 && !done && failures.every((failure) => failure.message === failures[0].message);
    setResult(
      failures.length
        ? {
            tone: 'error',
            text: shared ? failures[0].message : `${done ? `${done} uploaded. ` : ''}${failures.map((failure) => `${failure.name}: ${failure.message}`).join(' ')}`,
          }
        : { tone: 'success', text: done === 1 ? 'Image uploaded. Add its alt text before using it in a published article.' : `${done} images uploaded.` },
    );
    router.refresh();
  }

  return (
    <div className={styles.uploader}>
      <label htmlFor={`${uid}-file`} className={styles.uploadLabel} data-disabled={disabled || progress ? '' : undefined}>
        <Icon name="plus" size={18} />
        {progress ? `Uploading ${progress.index + 1} of ${progress.total}…` : 'Upload images'}
      </label>
      <input
        ref={input}
        id={`${uid}-file`}
        className={styles.fileInput}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        multiple
        disabled={disabled || Boolean(progress)}
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          if (files.length) void upload(files);
        }}
      />
      {progress && (
        <progress className={styles.progress} max={1} value={progress.share} aria-label="Upload progress">
          {Math.round(progress.share * 100)}%
        </progress>
      )}
      {result && <Notice tone={result.tone}>{result.text}</Notice>}
    </div>
  );
}
