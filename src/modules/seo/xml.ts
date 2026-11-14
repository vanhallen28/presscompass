// XML for sitemaps (sitemaps.org 0.9 with Google's image and news extensions) and RSS 2.0. Pure.

export function escapeXml(text: string): string {
  return text
    .replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
}

const iso = (value: string | null | undefined) => (value ? new Date(value).toISOString() : null);

const HEAD = '<?xml version="1.0" encoding="UTF-8"?>\n';

export function sitemapIndex(entries: { loc: string; lastmod?: string | null }[]): string {
  const items = entries.map(
    (e) => `  <sitemap>\n    <loc>${escapeXml(e.loc)}</loc>${iso(e.lastmod) ? `\n    <lastmod>${iso(e.lastmod)}</lastmod>` : ''}\n  </sitemap>`,
  );
  return `${HEAD}<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items.join('\n')}\n</sitemapindex>\n`;
}

export type UrlEntry = { loc: string; lastmod?: string | null; images?: string[] };

export function urlset(entries: UrlEntry[]): string {
  const items = entries.map((e) => {
    const parts = [`    <loc>${escapeXml(e.loc)}</loc>`];
    if (iso(e.lastmod)) parts.push(`    <lastmod>${iso(e.lastmod)}</lastmod>`);
    for (const image of e.images ?? []) parts.push(`    <image:image>\n      <image:loc>${escapeXml(image)}</image:loc>\n    </image:image>`);
    return `  <url>\n${parts.join('\n')}\n  </url>`;
  });
  return `${HEAD}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${items.join('\n')}\n</urlset>\n`;
}

/** Google News sitemap: one news:news per URL, publication name and language, first publication date, title. */
export function newsSitemap(items: { loc: string; title: string; publishedAt: string }[], publication: { name: string; language: string }): string {
  const entries = items.map(
    (item) =>
      `  <url>\n    <loc>${escapeXml(item.loc)}</loc>\n    <news:news>\n      <news:publication>\n        <news:name>${escapeXml(publication.name)}</news:name>\n        <news:language>${escapeXml(publication.language)}</news:language>\n      </news:publication>\n      <news:publication_date>${iso(item.publishedAt)}</news:publication_date>\n      <news:title>${escapeXml(item.title)}</news:title>\n    </news:news>\n  </url>`,
  );
  return `${HEAD}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n${entries.join('\n')}\n</urlset>\n`;
}

export type RssItem = {
  title: string;
  link: string;
  description: string;
  publishedAt: string;
  authors: string[];
  category?: string;
  image?: { url: string; width: number; height: number };
};

export function rss(channel: { title: string; link: string; description: string; self: string; items: RssItem[] }): string {
  const updated = channel.items[0]?.publishedAt;
  const items = channel.items.map((item) => {
    const parts = [
      `      <title>${escapeXml(item.title)}</title>`,
      `      <link>${escapeXml(item.link)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(item.link)}</guid>`,
      `      <pubDate>${new Date(item.publishedAt).toUTCString()}</pubDate>`,
    ];
    if (item.description) parts.push(`      <description>${escapeXml(item.description)}</description>`);
    if (item.authors.length) parts.push(`      <dc:creator>${escapeXml(item.authors.join(', '))}</dc:creator>`);
    if (item.category) parts.push(`      <category>${escapeXml(item.category)}</category>`);
    if (item.image)
      parts.push(
        `      <media:content url="${escapeXml(item.image.url)}" medium="image" type="image/jpeg" width="${item.image.width}" height="${item.image.height}"/>`,
      );
    return `    <item>\n${parts.join('\n')}\n    </item>`;
  });
  return `${HEAD}<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${escapeXml(channel.title)}</title>
    <link>${escapeXml(channel.link)}</link>
    <description>${escapeXml(channel.description)}</description>
    <language>en</language>
    <atom:link href="${escapeXml(channel.self)}" rel="self" type="application/rss+xml"/>${updated ? `\n    <lastBuildDate>${new Date(updated).toUTCString()}</lastBuildDate>` : ''}
${items.join('\n')}
  </channel>
</rss>
`;
}
