import { sitemapFileXml, sitemapFiles, xmlResponse } from '@/modules/seo/feeds';

// /sitemaps/articles-YYYY-MM.xml, /sitemaps/sections.xml, authors.xml, tags.xml, pages.xml.
// The files that exist at build time are prerendered; a new month renders on its first request.

export async function generateStaticParams() {
  const files = await sitemapFiles();
  return (files.length ? files : ['pages.xml']).map((file) => ({ file }));
}

export async function GET(_request: Request, { params }: RouteContext<'/sitemaps/[file]'>) {
  const { file } = await params;
  return xmlResponse(await sitemapFileXml(file));
}
