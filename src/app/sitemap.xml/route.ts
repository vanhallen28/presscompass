import { sitemapIndexXml, xmlResponse } from '@/modules/seo/feeds';

// /sitemap.xml: the sitemap index (one file per month of articles, plus sections, authors, tags and pages).
export async function GET() {
  return xmlResponse(await sitemapIndexXml());
}
