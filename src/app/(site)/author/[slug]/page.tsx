import type { Metadata } from 'next';
import { JsonLd } from '@/components/site/JsonLd';
import { ListView } from '@/components/site/ListView';
import { metaContext } from '@/modules/seo/context';
import { profileJsonLd } from '@/modules/seo/jsonld';
import { listMetadata, subjectDescription } from '@/modules/seo/metadata';
import { PLACEHOLDER } from '@/modules/site/params';
import { getList } from '@/modules/site/queries';

// Addresses missing from generateStaticParams render on their first visit, then come from the cache.
// The page needs its params to render at all (it is a 404 or a redirect without them), so it may block.
export const instant = false;

type Props = { params: Promise<{ slug: string }> };

// One sample is enough (see src/modules/site/params.ts); every other author page renders on first visit.
export function generateStaticParams() {
  return [{ slug: PLACEHOLDER }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [list, ctx] = await Promise.all([getList('author', slug), metaContext()]);
  return list?.subject
    ? listMetadata(ctx, { title: list.subject.name, description: subjectDescription(list.subject), path: `/author/${slug}`, profile: true })
    : {};
}

export default async function AuthorPage({ params }: Props) {
  const { slug } = await params;
  const [list, ctx] = await Promise.all([getList('author', slug), metaContext()]);
  return (
    <>
      {list?.subject && <JsonLd data={profileJsonLd(ctx, slug, list.subject)} />}
      <ListView kind="author" slug={slug} page={1} />
    </>
  );
}
