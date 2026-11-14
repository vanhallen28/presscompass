import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type Query, type TestDatabase } from './database';

const OWNER = '11111111-1111-4111-8111-111111111111';
const STRANGER = '22222222-2222-4222-8222-222222222222';

let db: TestDatabase;
const id: Record<string, string> = {};
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const asOwner = <T>(fn: (q: Query) => Promise<T>) => db.as('authenticated', OWNER, fn);
const asAnon = <T>(fn: (q: Query) => Promise<T>) => db.as('anon', null, fn);

beforeAll(async () => {
  db = await createTestDatabase();
  const q = db.client;
  const one = async (sql: string, params: unknown[]) => (await q.query(sql, params)).rows[0].id as string;
  await q.query(`insert into auth.users (id, email) values ($1, 'owner@example.com'), ($2, 'stranger@example.com')`, [OWNER, STRANGER]);
  await q.query(`insert into public.staff (user_id) values ($1)`, [OWNER]);
  id.lead = await one(
    `insert into public.media (public_id, format, width, height, bytes, alt) values ('presscompass/images/lead', 'jpg', 1600, 900, 1, 'Rice') returning id`,
    [],
  );
  id.social = await one(
    `insert into public.media (public_id, format, width, height, bytes, alt) values ('presscompass/images/og', 'jpg', 1200, 630, 1, 'Card') returning id`,
    [],
  );
  id.business = await one(`insert into public.sections (name, slug, position) values ('Business', 'business', 0) returning id`, []);
  id.science = await one(`insert into public.sections (name, slug, position) values ('Science', 'science', 1) returning id`, []);
  id.rani = await one(`insert into public.authors (name, slug) values ('Rani', 'rani') returning id`, []);
  id.rice = await one(`insert into public.tags (name, slug) values ('Rice', 'rice') returning id`, []);

  const article = async (key: string, title: string, section: string, status: string, hours: number | null, seo: Record<string, unknown> = {}) => {
    id[key] = await one(
      `insert into public.articles (title, slug, section_id, status, published_at, lead_media_id, seo, major_update_at)
       values ($1, $2, $3, $4::public.article_status, $5, $6, $7, null) returning id`,
      [title, key, section, status, hours === null ? null : hoursAgo(hours), id.lead, JSON.stringify(seo)],
    );
    await q.query(`insert into public.article_authors (article_id, author_id) values ($1, $2)`, [id[key], id.rani]);
  };
  await article('rice-prices', 'Rice prices', id.business, 'published', 2, {
    keyphrase: 'Rice prices',
    ogMediaId: id.social,
    title: 'Rice prices in 2026',
  });
  await article('old-rice', 'Rice in 2020', id.business, 'published', 24 * 400, { keyphrase: 'rice prices ' });
  await article('hidden', 'Hidden', id.business, 'published', 1, { noindex: true });
  await article('copied', 'Copied', id.business, 'published', 1, { canonical: 'https://example.org/original' });
  await article('draft', 'Draft rice', id.business, 'draft', null, { keyphrase: 'rice prices' });
  await article('archived', 'Archived rice', id.business, 'archived', null, { keyphrase: 'rice prices' });
  await article('future', 'Future', id.business, 'published', -5);
  await article('lizards', 'Komodo lizards', id.science, 'published', 3);
  await q.query(`insert into public.article_tags (article_id, tag_id) values ($1, $2), ($3, $2)`, [id['rice-prices'], id.rice, id['old-rice']]);
  await q.query(`update public.articles set major_update_at = now() - interval '30 minutes' where id = $1`, [id['old-rice']]);
  await q.query(
    `insert into public.pages (title, slug, status, published_at) values ('About', 'about', 'published', now() - interval '1 day'), ('Draft page', 'draft-page', 'draft', null)`,
  );
  await q.query(`update public.layouts set published = '{"newsName":"PressCompass"}' where key = 'seo'`);
});

afterAll(async () => {
  await db?.close();
});

describe('404 log', () => {
  it('counts addresses through log_not_found only, and keeps them from readers', async () => {
    await expect(asAnon((q) => q(`select public.log_not_found('/x', '')`))).rejects.toThrow(/permission denied/);
    await expect(asOwner((q) => q(`select public.log_not_found('/x', '')`))).rejects.toThrow(/permission denied/);
    const logged = await db.as('service_role', null, async (q) => {
      await q(`select public.log_not_found('/old-page?utm=1', 'https://google.com/')`);
      await q(`select public.log_not_found('/old-page', '')`);
      await q(`select public.log_not_found('/newsroom/secret', '')`);
      await q(`select public.log_not_found('//evil.example', '')`);
      await q(`select public.log_not_found('/_next/static/x.js', '')`);
      return q<{ path: string; hits: number; referrer: string }>(`select path, hits, referrer from public.not_found_log`);
    });
    expect(logged).toEqual([{ path: '/old-page', hits: 2, referrer: 'https://google.com/' }]);

    await db.client.query(`insert into public.not_found_log (path) values ('/kept')`);
    expect(await asOwner((q) => q(`select path from public.not_found_log`))).toEqual([{ path: '/kept' }]);
    await expect(asAnon((q) => q(`select * from public.not_found_log`))).rejects.toThrow(/permission denied/);
    expect(await db.as('authenticated', STRANGER, (q) => q(`select * from public.not_found_log`))).toEqual([]);
    await expect(asOwner((q) => q(`insert into public.not_found_log (path) values ('/y')`))).rejects.toThrow(/permission denied/);
    expect(await asOwner((q) => q(`delete from public.not_found_log where path = '/kept' returning path`))).toEqual([{ path: '/kept' }]);
    await db.client.query(`delete from public.not_found_log`);
  });

  it('keeps only the 1,000 most recent addresses', async () => {
    await db.client.query(
      `insert into public.not_found_log (path, last_seen) select '/gone-' || n, now() - n * interval '1 minute' from generate_series(1, 1000) n`,
    );
    const [{ count, oldest }] = await db.as('service_role', null, async (q) => {
      await q(`select public.log_not_found('/newest', '')`);
      return q<{ count: number; oldest: boolean }>(`select count(*)::int as count, bool_or(path = '/gone-1000') as oldest from public.not_found_log`);
    });
    expect(count).toBe(1000);
    expect(oldest).toBe(false);
    await db.client.query(`delete from public.not_found_log`);
  });
});

describe('site SEO reads', () => {
  it('returns the published SEO settings', async () => {
    expect(await asAnon((q) => q(`select public.site_seo() as s`))).toEqual([{ s: { newsName: 'PressCompass' } }]);
  });

  it('adds the SEO settings and social image to the article page', async () => {
    const [{ a }] = await asAnon((q) => q<{ a: Record<string, unknown> }>(`select public.site_article('rice-prices') as a`));
    expect(a.title).toBe('Rice prices');
    expect(a.seo).toEqual({ title: 'Rice prices in 2026', description: '', canonical: '', noindex: false, keyphrase: 'Rice prices' });
    expect(a.ogImage).toMatchObject({ publicId: 'presscompass/images/og', width: 1200 });
    expect(a.modifiedAt).toBeTruthy();
    expect(a.related).toBeDefined();
    expect(await asAnon((q) => q(`select public.site_article('draft') as a`))).toEqual([{ a: null }]);
    expect(await asAnon((q) => q(`select public.site_article('nothing') as a`))).toEqual([{ a: null }]);
  });

  it('lists months, sections, authors, tags and pages for the sitemap index, without hidden articles', async () => {
    const [{ s }] = await asAnon((q) =>
      q<{ s: Record<string, { slug?: string; month?: string; lastmod: string | null }[]> }>(`select public.site_sitemap() as s`),
    );
    const month = (h: number) => new Date(Date.now() - h * 3600_000).toISOString().slice(0, 7);
    expect(s.months.map((m) => m.month)).toEqual([...new Set([month(2), month(3), month(24 * 400)])]);
    expect(s.sections.map((x) => x.slug)).toEqual(['business', 'science']);
    expect(s.authors.map((x) => x.slug)).toEqual(['rani']);
    expect(s.tags.map((x) => x.slug)).toEqual(['rice']);
    expect(s.pages.map((x) => x.slug)).toEqual(['about']);
    // The old article's Major update moves its month's lastmod and the business section's.
    const old = s.months.find((m) => m.month === month(24 * 400));
    expect(Date.now() - new Date(old!.lastmod!).getTime()).toBeLessThan(3600_000);
  });

  it('lists one month of articles, and the news sitemap of the last two days', async () => {
    const month = new Date(Date.now() - 2 * 3600_000).toISOString().slice(0, 7);
    const [{ rows }] = await asAnon((q) =>
      q<{ rows: { slug: string; section: string; image: unknown }[] }>(`select public.site_sitemap_articles($1) as rows`, [month]),
    );
    const slugs = rows.map((r) => r.slug);
    expect(slugs).toContain('rice-prices');
    expect(slugs).not.toContain('hidden');
    expect(slugs).not.toContain('copied');
    expect(slugs).not.toContain('future');
    expect(slugs).not.toContain('draft');
    expect(rows.find((r) => r.slug === 'rice-prices')).toMatchObject({ section: 'business', image: { publicId: 'presscompass/images/lead' } });
    expect(await asAnon((q) => q(`select public.site_sitemap_articles('nope') as rows`))).toEqual([{ rows: [] }]);
    const [{ news }] = await asAnon((q) => q<{ news: { slug: string; title: string }[] }>(`select public.site_news_sitemap() as news`));
    expect(news.map((n) => n.slug)).toEqual(['rice-prices', 'lizards']);
  });
});

describe('SEO panel lookup', () => {
  it('finds other articles with the same keyphrase or title, and suggests links', async () => {
    const lookup = (args: unknown[]) =>
      asOwner((q) =>
        q<{ r: { keyphrase: { title: string }[]; title: { title: string }[]; suggestions: { title: string; path: string }[] } }>(
          `select public.article_seo_lookup($1, $2, $3, $4, $5, $6) as r`,
          args,
        ),
      );
    const [{ r }] = await lookup([id['rice-prices'], ' RICE PRICES', 'komodo lizards', id.business, [id.rice], []]);
    expect(r.keyphrase.map((a) => a.title).sort()).toEqual(['Draft rice', 'Rice in 2020']);
    expect(r.title.map((a) => a.title)).toEqual(['Komodo lizards']);
    expect(r.suggestions[0]).toEqual({ id: id['old-rice'], title: 'Rice in 2020', path: '/business/old-rice' });
    expect(r.suggestions.map((s) => s.title)).not.toContain('Future');
    const [{ r: excluded }] = await lookup([id['rice-prices'], '', '', id.business, [id.rice], [id['old-rice']]]);
    expect(excluded.keyphrase).toEqual([]);
    expect(excluded.suggestions.map((s) => s.title)).not.toContain('Rice in 2020');
    await expect(db.as('authenticated', STRANGER, (q) => q(`select public.article_seo_lookup($1, 'x', 'y')`, [id.draft]))).rejects.toThrow(
      /not_staff/,
    );
    await expect(asAnon((q) => q(`select public.article_seo_lookup($1, 'x', 'y')`, [id.draft]))).rejects.toThrow(/permission denied/);
  });

  it('counts a social image as a use of the media item', async () => {
    const [{ uses }] = await asOwner((q) => q<{ uses: { role: string; title: string }[] }>(`select public.media_usage($1) as uses`, [id.social]));
    expect(uses).toEqual([expect.objectContaining({ role: 'social', title: 'Rice prices' })]);
  });
});

describe('redirects for the CDN', () => {
  it('lists permanent redirects whose old address has no page, for the secret key only', async () => {
    await db.client.query(
      `insert into public.redirects (from_path, to_path, code, auto) values
         ('/old-story', '/business/rice-prices', 308, false),
         ('/business/rice-prices', '/business/old-rice', 308, false),
         ('/business', '/science', 308, false),
         ('/about', '/business', 308, false),
         ('/gone', '', 410, false),
         ('/author/rani', '/', 308, false),
         ('/tag/rice', '/', 308, false),
         ('/business/draft', '/business/rice-prices', 308, true)`,
    );
    const rows = await db.as('service_role', null, (q) => q<{ r: { source: string; destination: string }[] }>(`select public.cdn_redirects() as r`));
    expect(rows[0].r).toEqual([
      { source: '/business/draft', destination: '/business/rice-prices' },
      { source: '/old-story', destination: '/business/rice-prices' },
    ]);
    await expect(asAnon((q) => q(`select public.cdn_redirects()`))).rejects.toThrow(/permission denied/);
    await expect(asOwner((q) => q(`select public.cdn_redirects()`))).rejects.toThrow(/permission denied/);
    await db.client.query(`delete from public.redirects`);
  });

  it('shows staff the state of the last copy to Vercel', async () => {
    expect(await asOwner((q) => q(`select public.cdn_redirects_state() as s`))).toEqual([{ s: null }]);
    await db.client.query(`insert into public.app_meta (key, value) values ('cdn_redirects', '{"count": 2, "error": ""}')`);
    expect(await asOwner((q) => q(`select public.cdn_redirects_state() as s`))).toEqual([{ s: { count: 2, error: '' } }]);
    await expect(db.as('authenticated', STRANGER, (q) => q(`select public.cdn_redirects_state()`))).rejects.toThrow(/not_staff/);
    await expect(asAnon((q) => q(`select public.cdn_redirects_state()`))).rejects.toThrow(/permission denied/);
  });
});
