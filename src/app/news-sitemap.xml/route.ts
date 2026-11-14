import { newsSitemapXml, xmlResponse } from '@/modules/seo/feeds';

// /news-sitemap.xml: Google News sitemap, articles first published in the last two days.
export async function GET() {
  return xmlResponse(await newsSitemapXml());
}
