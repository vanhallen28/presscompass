import Link from 'next/link';
import styles from './site.module.css';

/** Newer and older pages of a list. Page 1 is the list's own address; later pages are `{base}/page/{n}`. */
export function Pager({ base, page, total, size }: { base: string; page: number; total: number; size: number }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return null;
  const href = (n: number) => (n <= 1 ? base || '/' : `${base}/page/${n}`);
  return (
    <nav className={styles.pager} aria-label="Pages">
      {page > 1 ? <Link href={href(page - 1)}>Newer articles</Link> : <span />}
      <span>
        Page {page} of {pages}
      </span>
      {page < pages ? <Link href={href(page + 1)}>Older articles</Link> : <span />}
    </nav>
  );
}
