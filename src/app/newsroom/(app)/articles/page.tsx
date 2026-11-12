import type { Metadata } from 'next';
import Link from 'next/link';
import { Button, ButtonLink } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { ArticleTable } from '@/components/newsroom/ArticleTable';
import { noticeFor } from '@/components/newsroom/notices';
import { SubmitButton } from '@/components/newsroom/SubmitButton';
import { EmptyState, Notice, PageHeader, ui } from '@/components/newsroom/ui';
import { UUID } from '@/lib/doc/schema';
import { requireStaff } from '@/modules/auth/staff';
import { createArticle } from '@/modules/editor/actions';
import { listArticles, PAGE_SIZE, publishDue, statusCounts } from '@/modules/editor/queries';
import { type ArticleStatus, STATUSES } from '@/modules/editor/status';
import { listAuthors, listSections } from '@/modules/taxonomy/queries';
import styles from './articles.module.css';

export const metadata: Metadata = { title: 'Articles' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

const TABS: [ArticleStatus | undefined, string][] = [
  [undefined, 'All'],
  ['draft', 'Drafts'],
  ['review', 'In review'],
  ['scheduled', 'Scheduled'],
  ['published', 'Published'],
  ['archived', 'Archived'],
];

type Search = { status?: string; q?: string; section?: string; author?: string; page?: string; notice?: string };

export default async function ArticlesPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireStaff();
  const params = await searchParams;
  const status = STATUSES.find((s) => s === params.status);
  const q = (params.q ?? '').trim().slice(0, 100);
  const section = params.section && UUID.test(params.section) ? params.section : undefined;
  const author = params.author && UUID.test(params.author) ? params.author : undefined;
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);

  await publishDue();
  const [list, counts, sections, authors] = await Promise.all([
    listArticles({ status, q, section, author, page }),
    statusCounts(),
    listSections(),
    listAuthors(),
  ]);
  const total = Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0);
  const pages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  const filtered = Boolean(q || section || author);
  const message = noticeFor('article', params.notice);

  const href = (changes: Partial<Record<'status' | 'page', string | undefined>>) => {
    const next = new URLSearchParams();
    const merged = { status, q: q || undefined, section, author, page: undefined as string | undefined, ...changes };
    for (const [key, value] of Object.entries(merged)) if (value) next.set(key, value);
    const query = next.toString();
    return `/newsroom/articles${query ? `?${query}` : ''}`;
  };

  return (
    <>
      <PageHeader
        title="Articles"
        actions={
          <form action={createArticle}>
            <SubmitButton icon="plus" pendingLabel="Creating…">
              New article
            </SubmitButton>
          </form>
        }
      />
      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <form className={styles.filters} role="search" action="/newsroom/articles">
        {status && <input type="hidden" name="status" value={status} />}
        <div className={styles.search}>
          <Icon name="search" size={18} />
          <input aria-label="Search articles" className={styles.input} type="search" name="q" defaultValue={q} placeholder="Search titles, authors, addresses" />
        </div>
        <select aria-label="Section" name="section" defaultValue={section ?? ''} className={styles.select}>
          <option value="">All sections</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select aria-label="Author" name="author" defaultValue={author ?? ''} className={styles.select}>
          <option value="">All authors</option>
          {authors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm">
          Filter
        </Button>
        {filtered && (
          <ButtonLink href={status ? `/newsroom/articles?status=${status}` : '/newsroom/articles'} variant="quiet" size="sm">
            Clear
          </ButtonLink>
        )}
      </form>

      <nav className={styles.tabs} aria-label="Filter by status">
        {TABS.map(([value, label]) => (
          <Link key={label} href={href({ status: value })} aria-current={status === value ? 'page' : undefined}>
            {label}
            <span className={styles.n}>{value ? (counts[value] ?? 0) : total}</span>
          </Link>
        ))}
      </nav>

      {list.rows.length === 0 ? (
        <div className={ui.tableWrap}>
          <EmptyState icon="file" title={filtered ? 'No articles match' : status ? 'Nothing here yet' : 'No articles yet'}>
            <p>{filtered ? 'Try another search or clear the filters.' : 'Start with New article. It opens as a draft that saves itself.'}</p>
          </EmptyState>
        </div>
      ) : (
        <ArticleTable key={`${status}-${q}-${section}-${author}-${page}`} rows={list.rows} />
      )}

      {list.total > 0 && (
        <div className={styles.pager}>
          <span>
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, list.total)} of {list.total}
          </span>
          <span className={styles.pagerLinks}>
            {page > 1 && (
              <ButtonLink href={href({ page: String(page - 1) })} size="sm" icon="arrow-left">
                Previous
              </ButtonLink>
            )}
            <span>
              Page {page} of {pages}
            </span>
            {page < pages && (
              <ButtonLink href={href({ page: String(page + 1) })} size="sm">
                Next
              </ButtonLink>
            )}
          </span>
        </div>
      )}
    </>
  );
}
