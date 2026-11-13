'use client';

import { useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ds/Button';
import styles from './site.module.css';

// Share (the device's share sheet, where there is one) and Copy link, next to the byline.

const noop = () => () => {};

export function ShareButtons({ title }: { title: string }) {
  const canShare = useSyncExternalStore(noop, () => typeof navigator.share === 'function', () => false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={styles.actions}>
      <span className={styles.copied} role="status">
        {copied ? 'Link copied' : ''}
      </span>
      {canShare && (
        <Button variant="quiet" icon="external" aria-label="Share" onClick={() => void navigator.share({ title, url: window.location.href }).catch(() => {})} />
      )}
      <Button variant="quiet" icon="link" aria-label="Copy link" onClick={() => void copy()} />
    </div>
  );
}
