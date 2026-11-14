'use client';

import { type ReactNode, useState } from 'react';
import styles from './panel.module.css';

// A sidebar card that folds away, like the panels of the WordPress editor. A panel holding a field with an
// error opens by itself, so the message is never hidden.

export function Panel({
  title,
  titleId,
  children,
  defaultOpen = true,
  forceOpen = false,
  badge,
}: {
  title: string;
  /** Id for the heading, so links and aria-labelledby can point at it. */
  titleId?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  badge?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  // Opening because of an error happens while rendering, not in an effect, so there is no closed frame.
  const [forced, setForced] = useState(forceOpen);
  if (forceOpen !== forced) {
    setForced(forceOpen);
    if (forceOpen) setOpen(true);
  }
  return (
    <details className={styles.panel} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className={styles.summary}>
        <h2 className={styles.title} id={titleId}>
          {title}
        </h2>
        {badge}
        <span className={styles.chevron} aria-hidden="true" />
      </summary>
      <div className={styles.content}>{children}</div>
    </details>
  );
}
