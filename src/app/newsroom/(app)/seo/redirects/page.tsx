import type { Metadata } from 'next';
import { ConfirmButton } from '@/components/newsroom/ConfirmButton';
import { RedirectForm } from '@/components/newsroom/seo/RedirectForm';
import styles from '@/components/newsroom/ads/ads.module.css';
import { Notice, PageHeader, ui } from '@/components/newsroom/ui';
import { formatWib } from '@/lib/time';
import { requireStaff } from '@/modules/auth/staff';
import { deleteRedirect } from '@/modules/seo/actions';
import { listRedirects } from '@/modules/seo/queries';

export const metadata: Metadata = { title: 'Redirects' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

const NOTICES: Record<string, string> = { saved: 'Redirect saved.', deleted: 'Redirect removed.' };

export default async function RedirectsPage({ searchParams }: { searchParams: Promise<{ notice?: string; from?: string }> }) {
  await requireStaff();
  const [{ notice, from }, redirects] = await Promise.all([searchParams, listRedirects()]);
  return (
    <>
      <PageHeader
        title="Redirects"
        description="Old addresses and where they lead. Changing an article's address or section adds one automatically; add your own for anything else."
      />
      {notice && NOTICES[notice] && <Notice tone="success">{NOTICES[notice]}</Notice>}
      <div className={styles.page}>
        <RedirectForm from={typeof from === 'string' ? from.slice(0, 300) : ''} />
        {redirects.length === 0 ? (
          <p className={styles.intro}>No redirects yet.</p>
        ) : (
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th scope="col">Old address</th>
                  <th scope="col">Leads to</th>
                  <th scope="col">Added</th>
                  <th scope="col">
                    <span className={ui.srOnly}>Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {redirects.map((r) => (
                  <tr key={r.id}>
                    <td className={ui.mono}>{r.from_path}</td>
                    <td className={ui.mono}>{r.code === 410 ? 'Gone (Page not found)' : r.to_path}</td>
                    <td>
                      {formatWib(r.created_at, 'short')}
                      <span className={ui.slug}>{r.auto ? 'Automatic' : 'Added by hand'}</span>
                    </td>
                    <td>
                      <form action={deleteRedirect}>
                        <input type="hidden" name="id" value={r.id} />
                        <ConfirmButton
                          size="sm"
                          variant="quiet"
                          icon="trash"
                          aria-label={`Remove the redirect from ${r.from_path}`}
                          title="Remove this redirect?"
                          body={`${r.from_path} will show Page not found again.`}
                          confirmLabel="Remove"
                          danger
                        >
                          Remove
                        </ConfirmButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
