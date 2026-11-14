import { feedXml, xmlResponse } from '@/modules/seo/feeds';

// /feed.xml: RSS of the 30 newest articles.
export async function GET() {
  return xmlResponse(await feedXml(null), 'application/rss+xml');
}
