import type { Metadata } from 'next';
import { ListView } from '@/components/site/ListView';
import { StaticPageView } from '@/components/site/StaticPageView';
import { sectionParams } from '@/modules/site/params';
import { getList, getPage } from '@/modules/site/queries';

// A section, or else a static page with that address (sections and pages share the top-level addresses;
// the Newsroom keeps them apart). Addresses missing from generateStaticParams render on their first visit,
// then come from the cache. The page needs its params to render at all, so it may block.
export const instant = false;

type Props = { params: Promise<{ section: string }> };

export function generateStaticParams() {
  return sectionParams();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section } = await params;
  const list = await getList('section', section);
  if (list?.subject) return { title: list.subject.name, description: list.subject.description || undefined };
  const page = await getPage(section);
  return page ? { title: page.title, description: page.description || undefined } : {};
}

export default async function SectionPage({ params }: Props) {
  const { section } = await params;
  const list = await getList('section', section);
  if (!list) {
    const page = await getPage(section);
    if (page) return <StaticPageView page={page} />;
  }
  return <ListView kind="section" slug={section} page={1} />;
}
