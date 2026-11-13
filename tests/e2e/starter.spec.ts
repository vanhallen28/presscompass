import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { signIn, sql } from './helpers';

// The starter content pack (npm run content:starter) against the fake Supabase and fake Cloudinary.
// It runs once, on the desktop project, and imports drafts so the public pages of other tests stay as they are.
const FAKE = 'http://127.0.0.1:3101';
const ENV = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: FAKE,
  SUPABASE_SECRET_KEY: 'sb_secret_e2e',
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: 'demo',
  CLOUDINARY_API_URL: `${FAKE}/fake-cloudinary`,
  CLOUDINARY_API_KEY: 'fake-key',
  CLOUDINARY_API_SECRET: 'fake-secret',
};
const importStarter = () => execFileSync('node', ['scripts/content-starter.mjs', '--draft'], { env: ENV, encoding: 'utf8' });

test('imports the starter articles once, with their illustrations', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The import changes shared data; one project is enough.');
  test.setTimeout(90_000);

  expect(importStarter()).toContain('10 of 10 starter articles added.');
  expect(importStarter()).toContain('Nothing to add: all 10 starter articles are already there.');

  const rows = await sql<{ slug: string; status: string; words: number; credit: string; public_id: string; revisions: number }>(
    `select a.slug, a.status::text as status, a.word_count as words, m.credit, m.public_id,
            (select count(*)::int from public.article_revisions r where r.article_id = a.id) as revisions
     from public.articles a join public.media m on m.id = a.lead_media_id
     where m.public_id like 'presscompass/images/starter-%'`,
  );
  expect(rows).toHaveLength(10);
  for (const row of rows) {
    expect(row).toMatchObject({ status: 'draft', credit: 'Illustration: PressCompass', revisions: 1 });
    expect(row.words).toBeGreaterThan(250);
  }
  const assets = (await (await fetch(`${FAKE}/fake-cloudinary/__assets`)).json()) as string[];
  for (const row of rows) expect(assets).toContain(row.public_id);

  const [economy] = await sql<{ id: string }>(`select id from public.articles where slug = 'indonesia-economy-2025-what-drove-growth'`);
  await signIn(page, `/newsroom/preview/${economy.id}`);
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText("Indonesia's economy in 2025: what drove growth");
  await expect(main.getByText('Illustration: PressCompass')).toBeVisible();
  await expect(main.getByRole('figure').filter({ hasText: 'Economic growth, 2019–2025' }).locator('svg rect')).toHaveCount(7);
  await expect(main.getByRole('img', { name: /terraced|skyline/ }).first()).toBeVisible();
});
