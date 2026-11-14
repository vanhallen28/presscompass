import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ds/Button';
import styles from '@/components/newsroom/ads/ads.module.css';
import { Notice, PageHeader, ui } from '@/components/newsroom/ui';
import { formatWib } from '@/lib/time';
import { requireStaff } from '@/modules/auth/staff';
import { dismissNotFound } from '@/modules/seo/actions';
import { listNotFound } from '@/modules/seo/queries';

export const metadata: Metadata = { title: '404 log' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

export default async function NotFoundLogPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  await requireStaff();
  const [{ notice }, rows] = await Promise.all([searchParams, listNotFound()]);
  return (
    <>
      <PageHeader
        title="404 log"
        description="Addresses readers (and search engines) asked for that have no page, most recent first. Point the useful ones at the right page with a redirect."
      />
      {notice === 'dismissed' && <Notice tone="success">Removed from the log.</Notice>}
      {rows.length === 0 ? (
        <p className={styles.intro}>Nothing logged yet. The log keeps the 1,000 most recent addresses.</p>
      ) : (
        <div className={styles.page}>
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th scope="col">Address</th>
                  <th scope="col" className={ui.num}>
                    Visits
                  </th>
                  <th scope="col">Last seen (WIB)</th>
                  <th scope="col">Came from</th>
                  <th scope="col">
                    <span className={ui.srOnly}>Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.path}>
                    <td className={ui.mono}>{row.path}</td>
                    <td className={ui.num}>{row.hits}</td>
                    <td className={ui.mono}>{formatWib(row.last_seen, 'short')}</td>
                    <td>
                      <span className={ui.slug}>{row.referrer || '—'}</span>
                    </td>
                    <td>
                      <span className={styles.rowActions}>
                        <Link href={`/newsroom/seo/redirects?from=${encodeURIComponent(row.path)}`} aria-label={`Create redirect from ${row.path}`}>
                          Create redirect
                        </Link>
                        <form action={dismissNotFound}>
                          <input type="hidden" name="path" value={row.path} />
                          <Button type="submit" size="sm" variant="quiet" aria-label={`Dismiss ${row.path}`}>
                            Dismiss
                          </Button>
                        </form>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form action={dismissNotFound}>
            <input type="hidden" name="all" value="1" />
            <Button type="submit" size="sm" variant="quiet" icon="trash">
              Clear the log
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
