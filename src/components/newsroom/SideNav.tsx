'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/ds/Icon';

const GROUPS: { label?: string; links: { href: string; label: string; icon: IconName; exact?: boolean }[] }[] = [
  { links: [{ href: '/newsroom', label: 'Dashboard', icon: 'grid' }] },
  {
    label: 'Content',
    links: [
      { href: '/newsroom/articles', label: 'Articles', icon: 'file' },
      { href: '/newsroom/sections', label: 'Sections', icon: 'folder' },
      { href: '/newsroom/tags', label: 'Tags', icon: 'tag' },
      { href: '/newsroom/authors', label: 'Authors', icon: 'users' },
      { href: '/newsroom/media', label: 'Media', icon: 'image' },
      { href: '/newsroom/pages', label: 'Pages', icon: 'file' },
    ],
  },
  {
    label: 'Site',
    links: [{ href: '/newsroom/ads', label: 'Ads', icon: 'chart' }],
  },
  {
    label: 'SEO',
    links: [
      { href: '/newsroom/seo', label: 'SEO settings', icon: 'search', exact: true },
      { href: '/newsroom/seo/redirects', label: 'Redirects', icon: 'arrow-right' },
      { href: '/newsroom/seo/not-found', label: '404 log', icon: 'alert' },
    ],
  },
];

function isCurrent(pathname: string, href: string, exact = false) {
  return href === '/newsroom' || exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function SideNav({ className, groupClassName, labelClassName }: { className: string; groupClassName: string; labelClassName: string }) {
  const pathname = usePathname();
  return (
    <nav className={className} aria-label="Newsroom sections">
      {GROUPS.map((group, index) => (
        <div key={group.label ?? index} className={groupClassName} role="group" aria-label={group.label}>
          {group.label && (
            <p className={labelClassName} aria-hidden="true">
              {group.label}
            </p>
          )}
          {group.links.map((link) => (
            <Link key={link.href} href={link.href} aria-current={isCurrent(pathname, link.href, link.exact) ? 'page' : undefined}>
              <Icon name={link.icon} />
              {link.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
