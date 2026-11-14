import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ListView } from '@/components/site/ListView';
import { pageNumber } from '@/modules/site/format';
import { metaContext } from '@/modules/seo/context';
import { listMetadata, subjectDescription } from '@/modules/seo/metadata';
import { PLACEHOLDER } from '@/modules/site/params';
import { getList } from '@/modules/site/queries';

// Addresses missing from generateStaticParams render on their first visit, then come from the cache.
// The page needs its params to render at all (it is a 404 or a redirect without them), so it may block.
export const instant = false;

type Props = { params: Promise<{ slug: string; n: string }> };

export function generateStaticParams() {
  return [{ slug: PLACEHOLDER, n: '2' }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, n } = await params;
  const [list, ctx] = await Promise.all([getList('tag', slug), metaContext()]);
  const page = pageNumber(n);
  return list?.subject && page
    ? listMetadata(ctx, { title: list.subject.name, description: subjectDescription(list.subject), path: `/tag/${slug}`, page })
    : {};
}

export default async function TagPageN({ params }: Props) {
  const { slug, n } = await params;
  const page = pageNumber(n);
  if (!page) notFound();
  return <ListView kind="tag" slug={slug} page={page} />;
}
