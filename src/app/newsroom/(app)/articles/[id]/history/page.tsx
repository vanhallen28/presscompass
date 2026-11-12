import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ButtonLink } from '@/components/ds/Button';
import { ConfirmButton } from '@/components/newsroom/ConfirmButton';
import { EmptyState, Notice, PageHeader, ui } from '@/components/newsroom/ui';
import { UUID } from '@/lib/doc/schema';
import { formatWib } from '@/lib/time';
import { requireStaff } from '@/modules/auth/staff';
import { restoreRevision } from '@/modules/editor/actions';
import { getArticle, listRevisions } from '@/modules/editor/queries';

export const metadata: Metadata = { title: 'History' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

const NOTICES: Record<string, string> = {
  missing: 'That version no longer exists. Only the 50 latest versions are kept.',
  'restore-failed': 'The version could not be restored. Try again.',
};

export default async function HistoryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  await requireStaff();
  const [{ id }, { notice }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const [article, revisions] = await Promise.all([getArticle(id), listRevisions(id)]);
  if (!article) notFound();

  return (
    <>
      <PageHeader
        title="History"
        description={`${article.title || 'Untitled'} · The 50 latest versions are kept. Manual saves and status changes each add one; autosave adds at most one every 10 minutes.`}
        back={{ href: `/newsroom/articles/${id}`, label: 'Back to the editor' }}
      />
      {notice && NOTICES[notice] && <Notice tone="error">{NOTICES[notice]}</Notice>}
      <div className={ui.tableWrap}>
        {revisions.length === 0 ? (
          <EmptyState icon="history" title="No versions yet">
            <p>Versions appear here after the first save.</p>
          </EmptyState>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th scope="col">Saved (WIB)</th>
                <th scope="col">What happened</th>
                <th scope="col">
                  <span className={ui.srOnly}>Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {revisions.map((revision, index) => (
                <tr key={revision.id}>
                  <td className={ui.mono}>{formatWib(revision.created_at)}</td>
                  <td className={ui.cellTitle}>
                    {revision.note || 'Saved'}
                    {index === 0 && <span className={ui.slug}>Latest version</span>}
                  </td>
                  <td className={ui.cellActions}>
                    <div className={ui.rowActions}>
                      <ButtonLink href={`/newsroom/preview/${id}?revision=${revision.id}`} size="sm" variant="quiet" icon="eye" target="_blank">
                        View
                      </ButtonLink>
                      {index > 0 && (
                        <form action={restoreRevision}>
                          <input type="hidden" name="articleId" value={id} />
                          <input type="hidden" name="revisionId" value={revision.id} />
                          <ConfirmButton
                            size="sm"
                            title="Restore this version?"
                            body={`The headline, text, byline and details go back to how they were on ${formatWib(revision.created_at)} WIB. The address and status stay as they are, and the current version is kept here.`}
                            confirmLabel="Restore"
                          >
                            Restore
                          </ConfirmButton>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
