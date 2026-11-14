import type { Metadata } from 'next';
import Link from 'next/link';
import { SeoSettingsForm } from '@/components/newsroom/seo/SeoSettingsForm';
import styles from '@/components/newsroom/ads/ads.module.css';
import { Notice, PageHeader } from '@/components/newsroom/ui';
import { deployEnv, siteUrl } from '@/lib/env';
import { requireStaff } from '@/modules/auth/staff';
import { getSeoSettingsForEdit } from '@/modules/seo/queries';

export const metadata: Metadata = { title: 'SEO settings' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

export default async function SeoSettingsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  await requireStaff();
  const [{ notice }, settings] = await Promise.all([searchParams, getSeoSettingsForEdit()]);
  const origin = siteUrl();
  return (
    <>
      <PageHeader
        title="SEO settings"
        description="How the site presents itself to Google and other search engines: indexing, titles, the publisher, the sitemaps and robots.txt."
      />
      {notice === 'updated' && <Notice tone="success">SEO settings saved. The site uses them from the next page view.</Notice>}
      <p className={styles.intro}>
        Search engines are{' '}
        <b className={settings.indexing ? styles.on : styles.off}>
          {settings.indexing ? 'allowed to index the site' : 'asked not to index the site'}
        </b>
        . Files for search engines: <Link href={`${origin}/sitemap.xml`}>sitemap.xml</Link>,{' '}
        <Link href={`${origin}/news-sitemap.xml`}>news-sitemap.xml</Link>, <Link href={`${origin}/feed.xml`}>feed.xml</Link>,{' '}
        <Link href={`${origin}/robots.txt`}>robots.txt</Link>.
      </p>
      <SeoSettingsForm initial={settings} production={deployEnv() === 'production'} />
    </>
  );
}
