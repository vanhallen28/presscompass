import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon, type IconName } from '@/components/ds/Icon';
import { StatusBadge } from '@/components/newsroom/StatusBadge';
import { SubmitButton } from '@/components/newsroom/SubmitButton';
import { EmptyState, PageHeader } from '@/components/newsroom/ui';
import { deployEnv } from '@/lib/env';
import { createSessionClient } from '@/lib/supabase/clients';
import { formatWib, wibDayStart } from '@/lib/time';
import { requireStaff } from '@/modules/auth/staff';
import { createArticle } from '@/modules/editor/actions';
import { getDashboard, listArticles, publishDue } from '@/modules/editor/queries';
import styles from './newsroom.module.css';

export const metadata: Metadata = { title: 'Dashboard' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

async function databaseCheck(): Promise<{ ok: boolean; detail: string }> {
  try {
    const supabase = await createSessionClient();
    const { count, error } = await supabase.from('sections').select('id', { count: 'exact', head: true });
    if (error) return { ok: false, detail: error.message };
    return { ok: true, detail: `Connected. ${count ?? 0} ${count === 1 ? 'section' : 'sections'}.` };
  } catch (error) {
    return { ok: false, detail: (error as Error).message };
  }
}

const NEXT_STEPS = [
  ['v0.3.0', 'Media library on Cloudinary, lead images and image blocks'],
  ['v0.4.0', 'Public site'],
  ['v0.5.0', 'Homepage, navigation, pages and site settings'],
  ['v0.6.0', 'SEO tools'],
  ['v0.7.0', 'Automatic indexing and the SEO dashboard'],
] as const;

export default async function DashboardPage() {
  const staff = await requireStaff();
  await publishDue();
  const now = new Date();
  const [stats, recent, database] = await Promise.all([getDashboard(wibDayStart(now)), listArticles({ limit: 6 }), databaseCheck()]);
  const environment = deployEnv();

  const cards: { label: string; icon: IconName; value: number; note: string; href: string }[] = [
    { label: 'Published today', icon: 'check', value: stats.published_today, note: formatWib(now, 'date'), href: '/newsroom/articles?status=published' },
    { label: 'In review', icon: 'eye', value: stats.review, note: stats.review ? 'Waiting for a final read' : 'Nothing waiting', href: '/newsroom/articles?status=review' },
    {
      label: 'Scheduled',
      icon: 'clock',
      value: stats.scheduled,
      note: stats.next_scheduled_at ? `Next ${formatWib(stats.next_scheduled_at, 'short')}` : 'Nothing scheduled',
      href: '/newsroom/articles?status=scheduled',
    },
    { label: 'Drafts', icon: 'edit', value: stats.drafts, note: 'Saved as you write', href: '/newsroom/articles?status=draft' },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        actions={
          <form action={createArticle}>
            <SubmitButton icon="plus" pendingLabel="Creating…">
              New article
            </SubmitButton>
          </form>
        }
      />
      <ul className={styles.stats} aria-label="Articles at a glance">
        {cards.map((card) => (
          <li key={card.label}>
            <Link href={card.href} className={styles.stat}>
              <span className={styles.statLabel}>
                <Icon name={card.icon} size={16} />
                {card.label}
              </span>
              <b className={styles.statValue}>{card.value}</b>
              <small className={styles.statNote}>{card.note}</small>
            </Link>
          </li>
        ))}
      </ul>

      <div className={styles.grid}>
        <section className={styles.panel} aria-label="Recently updated">
          <h2 className={styles.panelTitle}>
            Recently updated
          </h2>
          {recent.rows.length === 0 ? (
            <EmptyState icon="file" title="No articles yet">
              <p>New article opens a draft that saves itself every 10 seconds.</p>
            </EmptyState>
          ) : (
            <ul className={styles.recent}>
              {recent.rows.map((row) => (
                <li key={row.id}>
                  <Link href={`/newsroom/articles/${row.id}`}>{row.title || 'Untitled'}</Link>
                  <span className={styles.recentMeta}>
                    <StatusBadge status={row.status} />
                    <time dateTime={row.updated_at}>{formatWib(row.updated_at, 'short')}</time>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className={styles.side2}>
          <section className={styles.panel} aria-label="System">
            <h2 className={styles.panelTitle}>
              System
            </h2>
            <ul className={styles.checks}>
              <li>
                <Icon name={database.ok ? 'check' : 'alert'} size={16} className={database.ok ? styles.ok : styles.bad} />
                <span>
                  <b>Database</b> {database.detail}
                </span>
              </li>
              <li>
                <Icon name="check" size={16} className={styles.ok} />
                <span>
                  <b>Deployment</b> {environment === 'production' ? 'Production' : 'Preview or local'}
                </span>
              </li>
              <li>
                <Icon name="check" size={16} className={styles.ok} />
                <span>
                  <b>Signed in</b> {staff.email}
                </span>
              </li>
            </ul>
          </section>
          <section className={styles.panel} aria-label="Coming next">
            <h2 className={styles.panelTitle}>
              Coming next
            </h2>
            <ol className={styles.steps}>
              {NEXT_STEPS.map(([version, text]) => (
                <li key={version}>
                  <span className={styles.version}>{version}</span>
                  {text}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}
