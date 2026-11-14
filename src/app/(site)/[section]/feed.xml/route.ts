import { feedXml, xmlResponse } from '@/modules/seo/feeds';
import { sectionParams } from '@/modules/site/params';

// /{section}/feed.xml: RSS of a section's 30 newest articles.

export function generateStaticParams() {
  return sectionParams();
}

export async function GET(_request: Request, { params }: RouteContext<'/[section]/feed.xml'>) {
  const { section } = await params;
  return xmlResponse(await feedXml(section), 'application/rss+xml');
}
