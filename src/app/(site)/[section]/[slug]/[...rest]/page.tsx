import { missing } from '@/modules/site/missing';
import { PLACEHOLDER } from '@/modules/site/params';

// Addresses with three or more parts have no page on this site. Catching them here lets redirects from the
// Newsroom (SEO, Redirects) work for old addresses of that shape too; everything else is a 404.
export const instant = false;

type Props = { params: Promise<{ section: string; slug: string; rest: string[] }> };

export function generateStaticParams() {
  return [{ section: PLACEHOLDER, slug: PLACEHOLDER, rest: [PLACEHOLDER] }];
}

export default async function DeepAddress({ params }: Props) {
  const { section, slug, rest } = await params;
  return missing(`/${[section, slug, ...rest].join('/')}`);
}
