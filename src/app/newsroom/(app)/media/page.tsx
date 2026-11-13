import type { Metadata } from 'next';
import Link from 'next/link';
import { Button, ButtonLink } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { CloudImage } from '@/components/media/CloudImage';
import styles from '@/components/media/media.module.css';
import { UploadButton } from '@/components/media/UploadButton';
import { EmptyState, Notice, PageHeader } from '@/components/newsroom/ui';
import articles from '../articles/articles.module.css';
import { requireStaff } from '@/modules/auth/staff';
import { listMedia, MEDIA_PAGE_SIZE, uploadsReady } from '@/modules/media/queries';
import { formatBytes } from '@/modules/media/types';

export const metadata: Metadata = { title: 'Media' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

const NOTICES: Record<string, { tone: 'success' | 'error'; text: string }> = {
  deleted: { tone: 'success', text: 'Image deleted, here and on Cloudinary.' },
};

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; notice?: string }> }) {
  await requireStaff();
  const params = await searchParams;
  const q = (params.q ?? '').trim().slice(0, 100);
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const { total, items } = await listMedia({ q, page });
  const pages = Math.max(1, Math.ceil(total / MEDIA_PAGE_SIZE));
  const ready = uploadsReady();
  const notice = params.notice ? NOTICES[params.notice] : null;
  const href = (p: number) => `/newsroom/media?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <>
      <PageHeader
        title="Media"
        description="Images live on Cloudinary and are sent to readers at the right size and format. Alt text is saved with each image and is needed before an article that uses it can be published."
      />
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      {!ready && (
        <Notice tone="error">
          Cloudinary is not connected yet, so uploads are off. Add NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to .env
          on your computer and to Vercel (docs/ops/setup.md, step E).
        </Notice>
      )}
      <UploadButton disabled={!ready} />

      <form className={articles.filters} role="search" action="/newsroom/media">
        <div className={articles.search}>
          <Icon name="search" size={18} />
          <input aria-label="Search images" className={articles.input} type="search" name="q" defaultValue={q} placeholder="Search alt text, captions, credits, file names" />
        </div>
        <Button type="submit" size="sm">
          Search
        </Button>
        {q && (
          <ButtonLink href="/newsroom/media" size="sm" variant="quiet">
            Clear
          </ButtonLink>
        )}
      </form>

      {items.length === 0 ? (
        <EmptyState icon="image" title={q ? 'No images match' : 'No images yet'}>
          <p>{q ? 'Try other words or clear the search.' : 'Upload images here, or straight from an article.'}</p>
        </EmptyState>
      ) : (
        <ul className={styles.grid} aria-label="Images">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={`/newsroom/media/${item.id}`} className={styles.tile}>
                <span className={styles.tileImage}>
                  <CloudImage image={item} alt="" preset="square" sizes="(max-width: 640px) 50vw, 200px" className={styles.thumb} />
                  {!item.alt && <span className={styles.noAlt}>No alt text</span>}
                </span>
                <span className={styles.tileText}>
                  <span className={styles.tileAlt}>{item.alt || item.originalName || 'Untitled image'}</span>
                  <span className={styles.tileMeta}>
                    {item.width}×{item.height} · {formatBytes(item.bytes)} · {item.uses ? `used ${item.uses}×` : 'unused'}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {total > MEDIA_PAGE_SIZE && (
        <div className={articles.pager}>
          <span>
            Showing {(page - 1) * MEDIA_PAGE_SIZE + 1}–{Math.min(page * MEDIA_PAGE_SIZE, total)} of {total}
          </span>
          <span className={articles.pagerLinks}>
            {page > 1 && (
              <ButtonLink href={href(page - 1)} size="sm" icon="arrow-left">
                Previous
              </ButtonLink>
            )}
            <span>
              Page {page} of {pages}
            </span>
            {page < pages && (
              <ButtonLink href={href(page + 1)} size="sm">
                Next
              </ButtonLink>
            )}
          </span>
        </div>
      )}
    </>
  );
}
