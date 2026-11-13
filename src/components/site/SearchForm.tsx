import { Button } from '@/components/ds/Button';
import styles from './site.module.css';

/** A plain GET form to /search (no JavaScript). The label wraps the field, so no id is needed. */
export function SearchForm({ query = '' }: { query?: string }) {
  return (
    <form className={styles.searchForm} action="/search" method="get" role="search">
      <label>
        <span className="sr-only">Search PressCompass</span>
        <input className={styles.input} type="search" name="q" defaultValue={query} placeholder="Search articles" maxLength={200} />
      </label>
      <Button type="submit" variant="primary">
        Search
      </Button>
    </form>
  );
}
