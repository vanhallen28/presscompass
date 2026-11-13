import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CloudImage } from '@/components/media/CloudImage';
import styles from '@/components/media/media.module.css';
import { ConfirmButton } from '@/components/newsroom/ConfirmButton';
import forms from '@/components/newsroom/forms.module.css';
import { Notice, PageHeader } from '@/components/newsroom/ui';
import { UUID } from '@/lib/doc/schema';
import { formatWib } from '@/lib/time';
import { requireStaff } from '@/modules/auth/staff';
import { STATUS_LABELS, type ArticleStatus } from '@/modules/editor/status';
import { deleteMedia } from '@/modules/media/actions';
import { getMedia, mediaUsage } from '@/modules/media/queries';
import { formatBytes } from '@/modules/media/types';
import { MediaDetailsForm } from './MediaDetailsForm';

export const metadata: Metadata = { title: 'Image' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

const NOTICES: Record<string, string> = {
  'in-use': 'This image is still used. Remove it from the articles and authors listed under Used in, then delete it.',
  'delete-failed': 'The image could not be deleted. Try again.',
};

const ROLE: Record<string, string> = { lead: 'Lead image', body: 'In the text', photo: 'Author photo' };

export default async function MediaItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  await requireStaff();
  const [{ id }, { notice }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const [media, uses] = await Promise.all([getMedia(id), mediaUsage(id)]);
  if (!media) notFound();

  return (
    <>
      <PageHeader title={media.alt || media.originalName || 'Image'} back={{ href: '/newsroom/media', label: 'Media' }} />
      {notice && NOTICES[notice] && <Notice tone="error">{NOTICES[notice]}</Notice>}
      <div className={styles.detail}>
        <div>
          <CloudImage image={media} alt={media.alt} preset="original" sizes="(max-width: 900px) 100vw, 60vw" priority className={styles.detailImage} />
          <dl className={styles.facts}>
            <dt>File</dt>
            <dd>{media.originalName || '—'}</dd>
            <dt>Size</dt>
            <dd>
              {media.width}×{media.height} px · {formatBytes(media.bytes)} · {media.format.toUpperCase()}
            </dd>
            <dt>Uploaded</dt>
            <dd>{formatWib(media.createdAt)} WIB</dd>
            <dt>Cloudinary ID</dt>
            <dd>{media.publicId}</dd>
          </dl>
        </div>
        <div className={styles.side}>
          <section className={styles.card} aria-label="Details">
            <h2 className={styles.cardTitle}>Details</h2>
            <MediaDetailsForm media={media} />
          </section>
          <section className={styles.card} aria-label="Used in">
            <h2 className={styles.cardTitle}>Used in</h2>
            {uses.length === 0 ? (
              <p className={forms.hint}>Not used yet.</p>
            ) : (
              <ul className={styles.uses}>
                {uses.map((use) => (
                  <li key={`${use.kind}-${use.id}`}>
                    <Link href={use.kind === 'article' ? `/newsroom/articles/${use.id}` : `/newsroom/authors/${use.id}`}>{use.title || 'Untitled'}</Link>
                    <br />
                    <small>
                      {ROLE[use.role]}
                      {use.status && ` · ${STATUS_LABELS[use.status as ArticleStatus]}`}
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className={styles.card} aria-label="Delete">
            <h2 className={styles.cardTitle}>Delete</h2>
            {uses.length > 0 ? (
              <p className={forms.hint}>Images in use cannot be deleted. Remove it from the places listed above first.</p>
            ) : (
              <form action={deleteMedia}>
                <input type="hidden" name="id" value={media.id} />
                <ConfirmButton
                  icon="trash"
                  title="Delete this image?"
                  body="It is removed from the media library and from Cloudinary. This cannot be undone."
                  confirmLabel="Delete image"
                  danger
                >
                  Delete image
                </ConfirmButton>
              </form>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
