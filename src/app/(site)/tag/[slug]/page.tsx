import type { Metadata } from 'next';
import { ListView } from '@/components/site/ListView';
import { PLACEHOLDER } from '@/modules/site/params';
import { getList } from '@/modules/site/queries';

// Addresses missing from generateStaticParams render on their first visit, then come from the cache.
// The page needs its params to render at all (it is a 404 or a redirect without them), so it may block.
export const instant = false;

type Props = { params: Promise<{ slug: string }> };

// One sample is enough (see src/modules/site/params.ts); every other tag page renders on first visit.
export function generateStaticParams() {
  return [{ slug: PLACEHOLDER }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const list = await getList('tag', slug);
  return list?.subject ? { title: list.subject.name } : {};
}

export default async function TagPage({ params }: Props) {
  const { slug } = await params;
  return <ListView kind="tag" slug={slug} page={1} />;
}
