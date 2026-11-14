'use client';

import { useEffect } from 'react';

// Tells the 404 log which address had no page (the page itself stays static). Bots that run JavaScript are
// counted too; the log only keeps the address, the hit count and the referring page.
export function NotFoundBeacon() {
  useEffect(() => {
    const body = JSON.stringify({ path: window.location.pathname, referrer: document.referrer });
    if (!navigator.sendBeacon?.('/api/not-found', new Blob([body], { type: 'application/json' }))) {
      void fetch('/api/not-found', { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => undefined);
    }
  }, []);
  return null;
}
