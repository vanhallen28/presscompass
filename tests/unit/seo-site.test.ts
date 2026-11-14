import { describe, expect, it } from 'vitest';
import { articleJsonLd, breadcrumbs, homeJsonLd, jsonLdText, profileJsonLd } from '@/modules/seo/jsonld';
import { articleMetadata, listMetadata, type MetaContext, robots, siteMetadata } from '@/modules/seo/metadata';
import { normalisePath, parseRedirect } from '@/modules/seo/redirects';
import { DEFAULT_SEO, parseSeoSettings, readSeoSettings, robotsTxt } from '@/modules/seo/settings';
import { escapeXml, newsSitemap, rss, sitemapIndex, urlset } from '@/modules/seo/xml';
import type { ArticlePage } from '@/modules/site/types';

const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};

const ctx = (over: Partial<MetaContext> = {}): MetaContext => ({
  settings: { ...DEFAULT_SEO, indexing: true, sameAs: ['https://x.com/presscompass'], publishingPrinciples: '/editorial-standards' },
  origin: 'https://presscompass.site',
  production: true,
  delivery: { cloudName: 'demo', deliveryUrl: 'https://res.cloudinary.com' },
  ...over,
});

const article = (over: Partial<ArticlePage> = {}): ArticlePage => ({
  id: '00000000-0000-4000-8000-000000000001',
  title: 'How Indonesia keeps rice on the shelves',
  slug: 'rice-reserve',
  type: 'explainer',
  kicker: '',
  standfirst: 'The rice reserve, explained.',
  publishedAt: '2026-11-14T01:00:00+00:00',
  updatedAt: null,
  readingMinutes: 3,
  isBreaking: false,
  section: { name: 'Business', slug: 'business' },
  authors: [{ name: 'Rani Putri', slug: 'rani-putri', role: 'Business correspondent', photo: null }],
  lead: { publicId: 'presscompass/images/rice', width: 1800, height: 1200, alt: 'Rice fields', credit: '' },
  body: { type: 'doc', content: [] },
  sources: [{ title: 'Rice stocks', url: 'https://bulog.co.id', publisher: 'Bulog', accessed: '2026-11-01' }],
  leadCaption: '',
  tags: [{ name: 'Rice', slug: 'rice' }],
  media: [],
  links: [],
  related: [],
  more: [],
  seo: { title: '', description: '', canonical: '', noindex: false, keyphrase: 'rice reserve' },
  ogImage: null,
  modifiedAt: '2026-11-14T02:00:00+00:00',
  ...over,
});

describe('SEO settings', () => {
  it('falls back to defaults for missing or malformed values', () => {
    expect(readSeoSettings(null)).toEqual(DEFAULT_SEO);
    expect(
      readSeoSettings({
        titleTemplate: 'No placeholder',
        sameAs: ['http://insecure', 'https://x.com/a'],
        publishingPrinciples: 'javascript:alert(1)',
      }),
    ).toMatchObject({
      titleTemplate: DEFAULT_SEO.titleTemplate,
      sameAs: ['https://x.com/a'],
      publishingPrinciples: '',
    });
  });

  it('checks the form', () => {
    const ok = parseSeoSettings(
      form({
        indexing: 'on',
        siteName: 'PressCompass',
        titleTemplate: '%s | PressCompass',
        homeTitle: 'PressCompass',
        description: 'News.',
        newsName: 'PressCompass',
        sameAs: 'https://x.com/a\n https://facebook.com/b ',
        publishingPrinciples: '/standards',
        correctionsPolicy: '',
        robots: 'User-agent: GPTBot\nDisallow: /',
      }),
    );
    expect(ok).toMatchObject({
      ok: true,
      value: { indexing: true, sameAs: ['https://x.com/a', 'https://facebook.com/b'], robots: 'User-agent: GPTBot\nDisallow: /' },
    });
    const bad = parseSeoSettings(
      form({
        siteName: '',
        titleTemplate: 'PressCompass',
        homeTitle: 'x',
        description: 'x',
        newsName: 'PressCompass (Indonesia)',
        sameAs: 'x.com/a',
        publishingPrinciples: '//evil',
        robots: 'Allow everything',
      }),
    );
    expect(bad.ok).toBe(false);
    if (!bad.ok)
      expect(Object.keys(bad.errors).sort()).toEqual(['newsName', 'publishingPrinciples', 'robots', 'sameAs', 'siteName', 'titleTemplate']);
  });

  it('builds robots.txt, closed outside production', () => {
    const live = robotsTxt({ ...DEFAULT_SEO, robots: 'User-agent: GPTBot\nDisallow: /' }, 'https://presscompass.site', true);
    expect(live).toContain('Disallow: /newsroom\n');
    expect(live).toContain('User-agent: GPTBot\nDisallow: /\n');
    expect(live).toContain('Sitemap: https://presscompass.site/sitemap.xml\nSitemap: https://presscompass.site/news-sitemap.xml\n');
    expect(robotsTxt(DEFAULT_SEO, 'https://x', false)).toBe('User-agent: *\nDisallow: /\n');
  });
});

describe('redirects', () => {
  it('normalises old addresses and checks both ends', () => {
    expect(normalisePath('https://old.example/2019/05/post/?utm=1#x')).toBe('/2019/05/post');
    expect(normalisePath(' /old-story/ ')).toBe('/old-story');
    expect(parseRedirect(form({ from: '/old', to: 'https://www.presscompass.site/business/new', code: '308' }), 'presscompass.site')).toEqual({
      ok: true,
      value: { from: '/old', to: '/business/new', code: 308 },
    });
    expect(parseRedirect(form({ from: '/gone', to: '/ignored', code: '410' }), 'presscompass.site')).toEqual({
      ok: true,
      value: { from: '/gone', to: '', code: 410 },
    });
    const bad = parseRedirect(form({ from: '/newsroom/x', to: 'https://elsewhere.example', code: '308' }), 'presscompass.site');
    expect(bad.ok === false && bad.errors).toEqual({
      from: 'Addresses under /newsroom, /api and /_next cannot be redirected.',
      to: 'Redirects lead to pages on this site. Enter the address starting with /.',
    });
    const same = parseRedirect(form({ from: '/a', to: '/a/', code: '308' }), 'presscompass.site');
    expect(same.ok === false && same.errors.to).toBe('The new address must differ from the old one.');
    expect(parseRedirect(form({ from: '/', to: '/a', code: '308' }), 'presscompass.site').ok).toBe(false);
  });
});

describe('metadata', () => {
  it('stays noindex until the live site has indexing on, and asks for large image previews', () => {
    expect(robots(ctx())).toMatchObject({ index: true, googleBot: { 'max-image-preview': 'large' } });
    expect(robots(ctx({ production: false }))).toEqual({ index: false, follow: false });
    expect(robots(ctx({ settings: { ...DEFAULT_SEO } }))).toEqual({ index: false, follow: false });
    expect(robots(ctx(), true)).toEqual({ index: false, follow: true });
    expect(siteMetadata(ctx()).title).toEqual({ default: DEFAULT_SEO.homeTitle, template: '%s · PressCompass' });
  });

  it('describes an article for search and social cards', () => {
    const meta = articleMetadata(ctx(), article());
    expect(meta.title).toBe('How Indonesia keeps rice on the shelves');
    expect(meta.alternates?.canonical).toBe('/business/rice-reserve');
    expect(meta.openGraph).toMatchObject({
      type: 'article',
      publishedTime: '2026-11-14T01:00:00+00:00',
      modifiedTime: '2026-11-14T02:00:00+00:00',
      section: 'Business',
      tags: ['Rice'],
    });
    expect((meta.openGraph as { images: { url: string }[] }).images[0].url).toBe(
      `/og/${article().id}?v=${Date.parse('2026-11-14T02:00:00+00:00') / 1000}`,
    );
    const custom = articleMetadata(
      ctx(),
      article({
        seo: { title: 'Rice reserve explained', description: 'Custom.', canonical: 'https://elsewhere.example/a', noindex: true, keyphrase: '' },
        ogImage: { publicId: 'presscompass/images/og', width: 1200, height: 630, alt: 'Card', credit: '' },
      }),
    );
    expect(custom).toMatchObject({
      title: 'Rice reserve explained',
      description: 'Custom.',
      alternates: { canonical: 'https://elsewhere.example/a' },
      robots: { index: false },
    });
    expect((custom.openGraph as { images: { url: string }[] }).images[0].url).toBe(
      'https://res.cloudinary.com/demo/image/upload/c_fill,g_auto,ar_1.91:1,w_1200,f_jpg,q_auto/presscompass/images/og',
    );
  });

  it('gives later pages of a list their own canonical', () => {
    expect(listMetadata(ctx(), { title: 'Business', path: '/business', page: 2 })).toMatchObject({
      title: 'Business, page 2',
      alternates: { canonical: '/business/page/2' },
    });
    expect(listMetadata(ctx(), { title: 'Business', description: '', path: '/business' }).description).toBe(DEFAULT_SEO.description);
  });
});

describe('structured data', () => {
  it('marks up articles after Google’s Article guidelines', () => {
    const data = articleJsonLd(ctx(), article());
    expect(data).toMatchObject({
      '@type': 'Article',
      headline: 'How Indonesia keeps rice on the shelves',
      datePublished: '2026-11-14T01:00:00+00:00',
      dateModified: '2026-11-14T02:00:00+00:00',
      author: [{ '@type': 'Person', name: 'Rani Putri', url: 'https://presscompass.site/author/rani-putri', jobTitle: 'Business correspondent' }],
      publisher: { '@type': 'NewsMediaOrganization', '@id': 'https://presscompass.site/#organization' },
      citation: [{ '@type': 'CreativeWork', name: 'Rice stocks', url: 'https://bulog.co.id' }],
    });
    expect((data.image as string[]).map((url) => url.match(/ar_([\d.:]+)/)?.[1])).toEqual(['16:9', '4:3', '1:1']);
    expect(articleJsonLd(ctx(), article({ type: 'news' }))['@type']).toBe('NewsArticle');
    expect(articleJsonLd(ctx(), article({ type: 'opinion' }))['@type']).toBe('OpinionNewsArticle');
  });

  it('describes the publisher, breadcrumbs and authors, and escapes script text', () => {
    const home = homeJsonLd(ctx()) as { '@graph': Record<string, unknown>[] };
    expect(home['@graph'][1]).toMatchObject({
      '@type': 'NewsMediaOrganization',
      sameAs: ['https://x.com/presscompass'],
      publishingPrinciples: 'https://presscompass.site/editorial-standards',
    });
    expect(breadcrumbs(ctx(), [{ name: 'Home', path: '/' }, { name: 'Business' }]).itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://presscompass.site/' },
      { '@type': 'ListItem', position: 2, name: 'Business' },
    ]);
    expect(profileJsonLd(ctx(), 'rani-putri', { name: 'Rani', slug: 'rani-putri', role: 'Reporter' }).mainEntity).toMatchObject({
      '@type': 'Person',
      name: 'Rani',
      jobTitle: 'Reporter',
    });
    expect(jsonLdText({ headline: '</script><script>alert(1)</script>' })).not.toContain('</script>');
  });
});

describe('sitemaps and RSS', () => {
  it('escapes text and writes the sitemap formats', () => {
    expect(escapeXml(`Rice & "prices" <up>`)).toBe('Rice &amp; &quot;prices&quot; &lt;up&gt;');
    expect(sitemapIndex([{ loc: 'https://p.site/sitemaps/pages.xml', lastmod: '2026-11-14T01:00:00+07:00' }])).toContain(
      '<sitemap>\n    <loc>https://p.site/sitemaps/pages.xml</loc>\n    <lastmod>2026-11-13T18:00:00.000Z</lastmod>\n  </sitemap>',
    );
    const set = urlset([{ loc: 'https://p.site/a?x=1&y=2', images: ['https://img/a.jpg'] }, { loc: 'https://p.site/b' }]);
    expect(set).toContain('<loc>https://p.site/a?x=1&amp;y=2</loc>');
    expect(set).toContain('<image:image>\n      <image:loc>https://img/a.jpg</image:loc>');
    expect(set).not.toContain('<lastmod>');
    const news = newsSitemap([{ loc: 'https://p.site/a', title: 'Rice & prices', publishedAt: '2026-11-14T01:00:00Z' }], {
      name: 'PressCompass',
      language: 'en',
    });
    expect(news).toContain('<news:name>PressCompass</news:name>');
    expect(news).toContain('<news:title>Rice &amp; prices</news:title>');
    expect(news).toContain('<news:publication_date>2026-11-14T01:00:00.000Z</news:publication_date>');
  });

  it('writes RSS 2.0 with authors, category and image', () => {
    const feed = rss({
      title: 'PressCompass',
      link: 'https://p.site/',
      description: 'News',
      self: 'https://p.site/feed.xml',
      items: [
        {
          title: 'A',
          link: 'https://p.site/a',
          description: 'S',
          publishedAt: '2026-11-14T01:00:00Z',
          authors: ['Rani', 'Bima'],
          category: 'Business',
          image: { url: 'https://img/a.jpg', width: 1200, height: 675 },
        },
      ],
    });
    expect(feed).toContain('<atom:link href="https://p.site/feed.xml" rel="self" type="application/rss+xml"/>');
    expect(feed).toContain('<pubDate>Sat, 14 Nov 2026 01:00:00 GMT</pubDate>');
    expect(feed).toContain('<dc:creator>Rani, Bima</dc:creator>');
    expect(feed).toContain('<media:content url="https://img/a.jpg" medium="image" type="image/jpeg" width="1200" height="675"/>');
  });
});
