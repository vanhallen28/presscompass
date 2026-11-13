'use client';

/**
 * An inline script that runs while the browser parses the server HTML (before the first paint). If React ever
 * renders it in the browser (a client-side re-render of the root, as on not-found pages in `next dev`), it
 * becomes a `text/plain` data block: React never runs scripts it creates, and would warn about a real one.
 * Pattern from the Next.js guide "How to prevent flash before hydration".
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
