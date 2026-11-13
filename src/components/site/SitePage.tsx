import type { ReactNode } from 'react';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

/**
 * Header, main and footer of a public page. `page` is a key unique to this page (used for element ids,
 * see SiteHeader); `active` marks a section in the navigation, `current` when this page is that section.
 */
export function SitePage({ page, active, current, children }: { page: string; active?: string; current?: boolean; children: ReactNode }) {
  return (
    <>
      <SiteHeader page={page} active={active} current={current} />
      <main id={`main-${page}`} tabIndex={-1}>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
