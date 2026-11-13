'use client';

import { useSyncExternalStore } from 'react';
import styles from './site.module.css';
import { THEME_KEY as KEY } from './theme';

// Auto (follow the device), Light or Dark. The choice is kept in localStorage and applied before the
// first paint by THEME_SCRIPT (./theme.ts) in the root layout, so the page never flashes the wrong theme.

type Theme = 'auto' | 'light' | 'dark';
const EVENT = 'pc-theme-change';
const OPTIONS: { value: Theme; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

function read(): Theme {
  const value = document.documentElement.getAttribute('data-theme');
  return value === 'light' || value === 'dark' ? value : 'auto';
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

function choose(theme: Theme) {
  if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
  try {
    if (theme === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // Storage can be blocked (private windows); the choice then lasts until the page is closed.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function ThemeSwitch() {
  const theme = useSyncExternalStore(subscribe, read, () => 'auto' as Theme);
  return (
    <div className={styles.theme} role="group" aria-label="Theme">
      {OPTIONS.map((option) => (
        <button key={option.value} type="button" aria-pressed={theme === option.value} onClick={() => choose(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}
