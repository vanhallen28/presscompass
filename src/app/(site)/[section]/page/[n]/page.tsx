import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ListView } from '@/components/site/ListView';
import { pageNumber } from '@/modules/site/format';
import { sectionParams } from '@/modules/site/params';
import { getList } from '@/modules/site/queries';

// Addresses missing from generateStaticParams render on their first visit, then come from the cache.
// The page needs its params to render at all (it is a 404 or a redirect without them), so it may block.
export const instant = false;

type Props = { params: Promise<{ section: string; n: string }> };

export async function generateStaticParams() {
  return (await sectionParams()).map((params) => ({ ...params, n: '2' }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section, n } = await params;
  const list = await getList('section', section);
  return list?.subject ? { title: `${list.subject.name}, page ${n}` } : {};
}

export default async function SectionPageN({ params }: Props) {
  const { section, n } = await params;
  const page = pageNumber(n);
  if (!page) notFound();
  return <ListView kind="section" slug={section} page={page} />;
}
