import type { Metadata } from 'next';
import { ListView } from '@/components/site/ListView';
import { sectionParams } from '@/modules/site/params';
import { getList } from '@/modules/site/queries';

// Addresses missing from generateStaticParams render on their first visit, then come from the cache.
// The page needs its params to render at all (it is a 404 or a redirect without them), so it may block.
export const instant = false;

type Props = { params: Promise<{ section: string }> };

export function generateStaticParams() {
  return sectionParams();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section } = await params;
  const list = await getList('section', section);
  return list?.subject ? { title: list.subject.name, description: list.subject.description || undefined } : {};
}

export default async function SectionPage({ params }: Props) {
  const { section } = await params;
  return <ListView kind="section" slug={section} page={1} />;
}
