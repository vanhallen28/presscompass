import type { Metadata } from 'next';
import { JsonLd } from '@/components/site/JsonLd';
import { ListView } from '@/components/site/ListView';
import { StaticPageView } from '@/components/site/StaticPageView';
import { metaContext } from '@/modules/seo/context';
import { breadcrumbs } from '@/modules/seo/jsonld';
import { listMetadata } from '@/modules/seo/metadata';
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
  const [list, ctx] = await Promise.all([getList('section', section), metaContext()]);
  if (list?.subject) {
    return listMetadata(ctx, { title: list.subject.name, description: list.subject.description, path: `/${section}`, feed: `/${section}/feed.xml` });
  }
  const page = await getPage(section);
  return page ? listMetadata(ctx, { title: page.title, description: page.description, path: `/${section}` }) : {};
}

export default async function SectionPage({ params }: Props) {
  const { section } = await params;
  const list = await getList('section', section);
  if (!list) {
    const page = await getPage(section);
    if (page) return <StaticPageView page={page} />;
  }
  const ctx = await metaContext();
  return (
    <>
      {list?.subject && (
        <JsonLd
          data={breadcrumbs(ctx, [
            { name: 'Home', path: '/' },
            { name: list.subject.name, path: `/${section}` },
          ])}
        />
      )}
      <ListView kind="section" slug={section} page={1} />
    </>
  );
}
