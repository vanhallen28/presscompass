import type { Metadata } from 'next';
import { ConfirmButton } from '@/components/newsroom/ConfirmButton';
import { RedirectForm } from '@/components/newsroom/seo/RedirectForm';
import styles from '@/components/newsroom/ads/ads.module.css';
import { Notice, PageHeader, ui } from '@/components/newsroom/ui';
import { formatWib } from '@/lib/time';
import { requireStaff } from '@/modules/auth/staff';
import { deleteRedirect } from '@/modules/seo/actions';
import { cdnConfigured } from '@/modules/seo/cdn-sync';
import { getCdnState, listRedirects } from '@/modules/seo/queries';

export const metadata: Metadata = { title: 'Redirects' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

const NOTICES: Record<string, string> = { saved: 'Redirect saved.', deleted: 'Redirect removed.' };

export default async function RedirectsPage({ searchParams }: { searchParams: Promise<{ notice?: string; from?: string }> }) {
  await requireStaff();
  const [{ notice, from }, redirects, cdn] = await Promise.all([searchParams, listRedirects(), getCdnState()]);
  const { production, configured } = cdnConfigured();
  return (
    <>
      <PageHeader
        title="Redirects"
        description="Old addresses and where they lead. Changing an article's address or section adds one automatically; add your own for anything else."
      />
      {notice && NOTICES[notice] && <Notice tone="success">{NOTICES[notice]}</Notice>}
      <p className={styles.intro}>
        {!configured
          ? 'Vercel redirects are not connected, so the site redirects old addresses itself. Connect them (docs/ops/setup.md, step J) so search engines get a proper permanent redirect on every visit.'
          : !production
            ? 'Vercel redirects are connected; they are updated from the live site only.'
            : cdn?.error
              ? `Vercel redirects: the last update failed (${cdn.error}). The next try is within 5 minutes.`
              : cdn?.syncedAt
                ? `Vercel serves ${cdn.count} ${cdn.count === 1 ? 'redirect' : 'redirects'}, updated ${formatWib(cdn.syncedAt, 'short')} WIB. Changes reach Vercel within seconds.`
                : 'Vercel redirects are connected; the first update runs within 5 minutes.'}
      </p>
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
