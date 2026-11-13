import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { SearchForm } from '@/components/site/SearchForm';
import { SitePage } from '@/components/site/SitePage';
import { RowStory } from '@/components/site/Stories';
import styles from '@/components/site/site.module.css';
import { search } from '@/modules/site/queries';

export const metadata: Metadata = { title: 'Search', robots: { index: false, follow: true } };

const SIZE = 20;

type Props = { searchParams: Promise<{ q?: string | string[]; page?: string | string[] }> };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? '';

async function Results({ searchParams }: Props) {
  const params = await searchParams;
  const query = first(params.q).trim().slice(0, 200);
  const page = Math.max(1, Math.min(500, Number.parseInt(first(params.page), 10) || 1));
  const results = query ? await search(query, page, SIZE) : null;
  const pages = results ? Math.ceil(results.total / SIZE) : 0;
  const href = (n: number) => `/search?${new URLSearchParams({ q: query, ...(n > 1 ? { page: String(n) } : {}) })}`;

  return (
    <>
      <SearchForm query={query} />
      {results && (
        <p className={styles.count} role="status">
          {results.total === 0
            ? `Nothing found for “${query}”. Try fewer or different words.`
            : `${results.total.toLocaleString('en-GB')} ${results.total === 1 ? 'result' : 'results'} for “${query}”`}
        </p>
      )}
      {results && results.rows.length > 0 && (
        <ul className={styles.rows}>
          {results.rows.map((card) => (
            <li key={card.id}>
              <RowStory card={card} />
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && (
        <nav className={styles.pager} aria-label="Pages">
          {page > 1 ? <Link href={href(page - 1)}>Previous results</Link> : <span />}
          <span>
            Page {page} of {pages}
          </span>
          {page < pages ? <Link href={href(page + 1)}>More results</Link> : <span />}
        </nav>
      )}
    </>
  );
}

export default function SearchPage(props: Props) {
  return (
    <SitePage page="search">
      <div className={styles.wrap}>
        <header className={styles.pageHead}>
          <h1 className={styles.h1}>Search</h1>
          <Suspense fallback={<SearchForm />}>
            <Results {...props} />
          </Suspense>
        </header>
      </div>
    </SitePage>
  );
}
