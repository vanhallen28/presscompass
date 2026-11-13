'use client';

import { CONSENT_EVENT, type ConsentState, readConsent } from './consent';

// Browser helpers for the ad runtime: consent state, loading a script once, and running pasted HTML code.

type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
    adsbygoogle?: unknown[];
    googletag?: { cmd: (() => void)[] | { push: (fn: () => void) => void } } & Record<string, unknown>;
    fbq?: ((...args: unknown[]) => void) & {
      queue?: unknown[];
      callMethod?: (...args: unknown[]) => void;
      loaded?: boolean;
      version?: string;
      push?: unknown;
    };
    _fbq?: unknown;
  }
}

export function consentState(required: boolean): ConsentState {
  const attr = document.documentElement.getAttribute('data-consent') as ConsentState | null;
  if (attr) return attr;
  // Arrived by client-side navigation from a page without the early script (the Newsroom).
  const state = readConsent(document.cookie, required);
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || ((...args: unknown[]) => window.dataLayer!.push(args));
  document.documentElement.setAttribute('data-consent', state);
  return state;
}

/** Calls `fn` once consent is "all" (now or later). Returns a cleanup function. */
export function whenConsented(required: boolean, fn: () => void): () => void {
  if (consentState(required) === 'all') {
    fn();
    return () => {};
  }
  const listener = () => {
    if (consentState(required) === 'all') {
      window.removeEventListener(CONSENT_EVENT, listener);
      fn();
    }
  };
  window.addEventListener(CONSENT_EVENT, listener);
  return () => window.removeEventListener(CONSENT_EVENT, listener);
}

const loaded = new Set<string>();

export function loadScript(src: string, attrs: Record<string, string> = {}): void {
  if (loaded.has(src)) return;
  loaded.add(src);
  const script = document.createElement('script');
  script.async = true;
  script.src = src;
  for (const [name, value] of Object.entries(attrs)) script.setAttribute(name, value);
  document.head.appendChild(script);
}

/** Inserts pasted HTML into `target` so that its scripts run (innerHTML alone never runs them). */
export function injectCode(target: HTMLElement, html: string): void {
  // Scripts in a contextual fragment run when the fragment is inserted, also when nested in other elements.
  target.appendChild(document.createRange().createContextualFragment(html));
}
