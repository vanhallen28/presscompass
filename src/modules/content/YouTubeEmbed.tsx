'use client';

import { useState } from 'react';
import styles from './article.module.css';

/** Loads the YouTube player only after a click, so no request reaches YouTube until the reader asks. */
export function YouTubeEmbed({ videoId, title }: { videoId: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  const label = title || 'YouTube video';
  return (
    <figure className={styles.video}>
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
          title={label}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button type="button" className={styles.videoButton} onClick={() => setPlaying(true)}>
          <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
            <circle cx="28" cy="28" r="27" fill="currentColor" opacity="0.92" />
            <path d="M23 18l15 10-15 10z" fill="var(--paper)" />
          </svg>
          <span>Play video: {label}</span>
          <small>Plays from YouTube</small>
        </button>
      )}
    </figure>
  );
}
