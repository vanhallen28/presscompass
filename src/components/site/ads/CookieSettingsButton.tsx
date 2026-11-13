'use client';

import styles from './ads.module.css';

/** Footer button that opens the cookie banner again, so readers can change or withdraw their choice. */
export function CookieSettingsButton() {
  return (
    <button
      type="button"
      className={styles.settings}
      onClick={() => {
        document.documentElement.setAttribute('data-consent-open', '');
        document.querySelector<HTMLButtonElement>('[data-consent-banner] button')?.focus();
      }}
    >
      Cookie settings
    </button>
  );
}
