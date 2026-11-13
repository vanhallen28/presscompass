import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from './database';

const OWNER = '11111111-1111-4111-8111-111111111111';
const STRANGER = '22222222-2222-4222-8222-222222222222';

let db: TestDatabase;
let image: string;

type Ads = {
  enabled: boolean;
  adsenseClient: string;
  adsTxt: string;
  verificationMeta: string;
  headCode: string;
  metaPixelId: string;
  adsenseAuto: boolean;
  slots: { placement: string; kind: string }[];
};

const siteAds = async () => (await db.as('anon', null, (q) => q<{ ads: Ads }>(`select public.site_ads() as ads`)))[0].ads;

beforeAll(async () => {
  db = await createTestDatabase();
  const q = db.client;
  await q.query(`insert into auth.users (id, email) values ($1, 'owner@example.com'), ($2, 'stranger@example.com')`, [OWNER, STRANGER]);
  await q.query(`insert into public.staff (user_id) values ($1)`, [OWNER]);
  image = (
    await q.query(
      `insert into public.media (public_id, format, width, height, bytes, alt) values ('presscompass/images/p', 'jpg', 800, 600, 1, 'A desk') returning id`,
    )
  ).rows[0].id;
  const body = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'We use cookies.' }] },
      { type: 'image', attrs: { mediaId: image, caption: '' } },
    ],
  };
  await q.query(
    `insert into public.pages (title, slug, blocks, status, published_at, seo) values
       ('Privacy policy', 'privacy-policy', $1, 'published', now() - interval '1 hour', '{"description":"How we use data."}'),
       ('About us', 'about', '[]', 'draft', null, '{}')`,
    [JSON.stringify([{ type: 'text', body }])],
  );
});

afterAll(async () => {
  await db?.close();
});

describe('ads', () => {
  it('keeps settings and slots away from readers and other signed-in users', async () => {
    await expect(db.as('anon', null, (q) => q(`select * from public.ad_settings`))).rejects.toThrow(/permission denied/);
    await expect(db.as('anon', null, (q) => q(`select * from public.ad_slots`))).rejects.toThrow(/permission denied/);
    expect(await db.as('authenticated', STRANGER, (q) => q(`select * from public.ad_slots`))).toEqual([]);
    expect(await db.as('authenticated', STRANGER, (q) => q(`update public.ad_settings set enabled = true returning id`))).toEqual([]);
  });

  it('has one settings row and eight placements that staff can change but not add or remove', async () => {
    const slots = await db.as('authenticated', OWNER, (q) => q<{ placement: string }>(`select placement from public.ad_slots order by placement`));
    expect(slots.map((row) => row.placement)).toEqual([
      'article_end',
      'article_inline_1',
      'article_inline_2',
      'article_rail',
      'footer',
      'home_middle',
      'list',
      'top',
    ]);
    await expect(db.as('authenticated', OWNER, (q) => q(`insert into public.ad_slots (placement) values ('top')`))).rejects.toThrow(
      /permission denied/,
    );
    await expect(db.as('authenticated', OWNER, (q) => q(`delete from public.ad_settings`))).rejects.toThrow(/permission denied/);
    await expect(db.as('authenticated', OWNER, (q) => q(`update public.ad_slots set enabled = true where placement = 'top'`))).rejects.toThrow(
      /check constraint/,
    );
    await expect(db.as('authenticated', OWNER, (q) => q(`update public.ad_settings set adsense_client = 'pub-123'`))).rejects.toThrow(
      /check constraint/,
    );
  });

  it('gives readers verification data while ads are off, and code only once they are on', async () => {
    await db.client.query(
      `update public.ad_settings set adsense_client = 'ca-pub-1234567890123456', ads_txt = 'example.com, 42, DIRECT', verification_meta = '<meta name="x" content="y">',
         head_code = '<script>window.x = 1</script>', meta_pixel_id = '123456789012345', adsense_auto = true`,
    );
    await db.client.query(`update public.ad_slots set enabled = true, adsense_slot = '1234567890' where placement = 'top'`);
    await db.client.query(
      `update public.ad_slots set enabled = true, kind = 'html', html = '<a href="https://example.com">Sponsor</a>' where placement = 'footer'`,
    );

    const off = await siteAds();
    expect(off).toMatchObject({
      enabled: false,
      adsenseClient: 'ca-pub-1234567890123456',
      adsTxt: 'example.com, 42, DIRECT',
      headCode: '',
      metaPixelId: '',
      adsenseAuto: false,
      slots: [],
    });
    expect(off.verificationMeta).toContain('name="x"');

    await db.client.query(`update public.ad_settings set enabled = true`);
    const on = await siteAds();
    expect(on).toMatchObject({ enabled: true, headCode: '<script>window.x = 1</script>', metaPixelId: '123456789012345', adsenseAuto: true });
    expect(on.slots.map((slot) => `${slot.placement}:${slot.kind}`)).toEqual(['footer:html', 'top:adsense']);

    await db.client.query(`update public.ad_settings set adsense_client = ''`);
    expect((await siteAds()).slots.map((slot) => slot.placement)).toEqual(['footer']);
  });
});

describe('pages', () => {
  it('shows readers published pages with their body, images and footer list', async () => {
    const [{ page }] = await db.as('anon', null, (q) => q<{ page: Record<string, unknown> }>(`select public.site_page('privacy-policy') as page`));
    expect(page).toMatchObject({ title: 'Privacy policy', slug: 'privacy-policy', description: 'How we use data.' });
    expect((page.body as { content: unknown[] }).content).toHaveLength(2);
    expect(page.media).toEqual([expect.objectContaining({ id: image, alt: 'A desk' })]);
    const [{ draft }] = await db.as('anon', null, (q) => q<{ draft: unknown }>(`select public.site_page('about') as draft`));
    expect(draft).toBeNull();
    const [{ list }] = await db.as('anon', null, (q) => q<{ list: unknown }>(`select public.site_pages() as list`));
    expect(list).toEqual([{ title: 'Privacy policy', slug: 'privacy-policy' }]);
  });

  it('counts page images as used', async () => {
    const [{ uses }] = await db.as('authenticated', OWNER, (q) =>
      q<{ uses: { kind: string; title: string }[] }>(`select public.media_usage($1) as uses`, [image]),
    );
    expect(uses).toEqual([expect.objectContaining({ kind: 'page', title: 'Privacy policy', role: 'body', status: 'published' })]);
  });
});
