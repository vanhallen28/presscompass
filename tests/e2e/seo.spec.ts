import { expect, type Page, test } from '@playwright/test';
import { expectNoAxeViolations, revalidateSite, seedArticle, seedTaxonomy, signIn, slugFor, sql, unique } from './helpers';

// v0.6.0: the WordPress-style editor (SEO tab, + inserter, / command), metadata and structured data, the
// automatic social card, sitemaps, RSS, robots.txt, SEO settings, the 404 log and redirects.

const main = (page: Page) => page.getByRole('main');
const desktopOnly = (name: string) => test.skip(name !== 'desktop', 'Shared site files; one project is enough.');

test.describe('article editor', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'Editor flows run on desktop; the phone layout is checked separately.');
  });

  test('scores the article in the SEO tab and saves the SEO settings with the scores', async ({ page }) => {
    const { section, author } = await seedTaxonomy('seo-tab');
    const title = unique('Rice prices climb');
    const id = await seedArticle({ title, sectionId: section.id, authorId: author.id, ready: true });
    await signIn(page, `/newsroom/articles/${id}`);

    await expect(main(page).getByRole('button', { name: /^SEO \d+ out of 100/ })).toBeVisible();
    await main(page).getByRole('tab', { name: /SEO/ }).click();
    const panel = main(page).getByRole('tabpanel', { name: /SEO/ });
    await expect(panel.getByText('Set a focus keyphrase')).toBeVisible();

    await panel.getByRole('textbox', { name: 'Focus keyphrase' }).fill('rice prices');
    await panel
      .getByText(/^Good results/)
      .first()
      .click();
    await expect(panel.getByText('The keyphrase appears in the first 100 words.')).toBeVisible();
    await expect(panel.getByText('Set a focus keyphrase')).toHaveCount(0);
    await panel.getByRole('textbox', { name: 'SEO title' }).fill('Rice prices climb for a third week in Java');
    await expect(panel.getByRole('figure', { name: 'Google preview' })).toContainText('Rice prices climb for a third week in Java · PressCompass');
    await panel.getByText('Advanced', { exact: true }).click();
    await panel.getByRole('checkbox', { name: 'Hide from search engines' }).check();
    await expect(panel.getByText('This article asks search engines not to index it')).toBeVisible();

    await main(page).getByRole('button', { name: 'Save draft' }).click();
    await expect(main(page).getByText('Draft saved.')).toBeVisible();
    const [row] = await sql<{ seo: { keyphrase: string; title: string; noindex: boolean; scores: { seo: number; readability: number } } }>(
      `select seo from public.articles where id = $1`,
      [id],
    );
    expect(row.seo).toMatchObject({ keyphrase: 'rice prices', title: 'Rice prices climb for a third week in Java', noindex: true });
    expect(row.seo.scores.seo).toBeGreaterThan(0);
    expect(row.seo.scores.readability).toBeGreaterThan(0);

    await page.goto(`/newsroom/articles?q=${encodeURIComponent(title)}`);
    await expect(main(page).getByRole('row', { name: new RegExp(title) })).toContainText(`SEO ${row.seo.scores.seo}`);
  });

  test('adds blocks with / in an empty line and with the + inserter', async ({ page }) => {
    const id = await seedArticle({ title: unique('Blocks'), ready: true });
    await signIn(page, `/newsroom/articles/${id}`);
    const text = main(page).getByRole('textbox', { name: 'Article text' });
    await text.click();
    await text.press('Control+End');
    await text.press('Enter');
    await page.keyboard.type('/subh');
    const list = main(page).getByRole('listbox', { name: 'Blocks' });
    await expect(list.getByRole('option', { name: /Subheading/ })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    await expect(list).toHaveCount(0);
    await page.keyboard.type('Where prices go next');
    await expect(text.locator('h3')).toHaveText('Where prices go next');

    await main(page).getByRole('button', { name: 'Add a block' }).click();
    const inserter = main(page).getByRole('dialog', { name: 'Add a block' });
    await inserter.getByRole('searchbox', { name: 'Search blocks' }).fill('divider');
    await inserter.getByRole('searchbox', { name: 'Search blocks' }).press('Enter');
    await expect(inserter).toHaveCount(0);
    await expect(text.locator('hr')).toHaveCount(1);
  });
});

test.describe('public site', () => {
  test('articles carry metadata, structured data and an automatic social card', async ({ page, request }, testInfo) => {
    desktopOnly(testInfo.project.name);
    const { section, author, tag } = await seedTaxonomy('seo-meta');
    const title = unique('Nickel exports rise');
    const id = await seedArticle({ title, sectionId: section.id, authorId: author.id, tagId: tag.id, ready: true, status: 'published' });
    await revalidateSite();
    const path = `/${section.slug}/${slugFor(title)}`;

    await page.goto(path);
    await expect(page).toHaveTitle(`${title} · PressCompass`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `http://localhost:3100${path}`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
    await expect(page.locator('meta[property="article:section"]')).toHaveAttribute('content', section.name);
    const image = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(image).toMatch(new RegExp(`/og/${id}\\?v=\\d+$`));
    await expect(page.locator('link[rel="alternate"][type="application/rss+xml"]').first()).toHaveAttribute('href', /feed\.xml$/);

    const data = (await page.locator('script[type="application/ld+json"]').allTextContents()).map((text) => JSON.parse(text));
    const article = data.find((item) => item['@type'] === 'NewsArticle');
    expect(article).toMatchObject({
      headline: title,
      author: [{ '@type': 'Person', name: author.name }],
      publisher: { '@type': 'NewsMediaOrganization' },
    });
    expect(data.find((item) => item['@type'] === 'BreadcrumbList')?.itemListElement).toHaveLength(3);

    const card = await request.get(image!);
    expect(card.status()).toBe(200);
    expect(card.headers()['content-type']).toBe('image/png');
    expect((await request.get('/brand/logo.png')).headers()['content-type']).toBe('image/png');
    expect((await request.get('/og/00000000-0000-4000-8000-000000000000')).status()).toBe(404);
  });

  test('serves sitemaps, the news sitemap, RSS and robots.txt', async ({ request }, testInfo) => {
    desktopOnly(testInfo.project.name);
    const { section, author } = await seedTaxonomy('seo-files');
    const title = unique('Timor-Leste joins ASEAN');
    await seedArticle({ title, sectionId: section.id, authorId: author.id, ready: true, status: 'published' });
    await revalidateSite();
    const url = `http://localhost:3100/${section.slug}/${slugFor(title)}`;

    const index = await (await request.get('/sitemap.xml')).text();
    const month = new Date().toISOString().slice(0, 7);
    expect(index).toContain(`<loc>http://localhost:3100/sitemaps/articles-${month}.xml</loc>`);
    expect(index).toContain('<loc>http://localhost:3100/sitemaps/sections.xml</loc>');
    const articles = await request.get(`/sitemaps/articles-${month}.xml`);
    expect(articles.headers()['content-type']).toBe('application/xml; charset=utf-8');
    expect(await articles.text()).toContain(`<loc>${url}</loc>`);
    expect(await (await request.get('/sitemaps/sections.xml')).text()).toContain(`<loc>http://localhost:3100/${section.slug}</loc>`);
    expect((await request.get('/sitemaps/nothing.xml')).status()).toBe(404);

    const news = await (await request.get('/news-sitemap.xml')).text();
    expect(news).toContain(`<loc>${url}</loc>`);
    expect(news).toContain(`<news:title>${title}</news:title>`);

    const feed = await request.get('/feed.xml');
    expect(feed.headers()['content-type']).toBe('application/rss+xml; charset=utf-8');
    expect(await feed.text()).toContain(`<link>${url}</link>`);
    expect(await (await request.get(`/${section.slug}/feed.xml`)).text()).toContain(`<title>${section.name} · PressCompass</title>`);
    expect((await request.get('/no-such-section/feed.xml')).status()).toBe(404);

    // Not Vercel Production: crawlers are asked to stay out.
    expect(await (await request.get('/robots.txt')).text()).toBe('User-agent: *\nDisallow: /\n');
  });
});

test.describe('Newsroom SEO pages', () => {
  test('SEO settings change what the site tells search engines', async ({ page, request }, testInfo) => {
    desktopOnly(testInfo.project.name);
    await signIn(page, '/newsroom/seo');
    const name = main(page).getByRole('textbox', { name: 'Publication name' });
    await expect(name).toHaveValue('PressCompass');
    await name.fill('PressCompass (Jakarta)');
    await main(page).getByRole('button', { name: 'Save settings' }).click();
    await expect(main(page).getByText('Enter the publication name as Google News shows it, without brackets.')).toBeVisible();

    await main(page).getByRole('textbox', { name: 'Publication name' }).fill('PressCompass Daily');
    await main(page).getByRole('button', { name: 'Save settings' }).click();
    await expect(main(page).getByText('SEO settings saved.')).toBeVisible();
    await expect.poll(async () => (await request.get('/news-sitemap.xml')).text(), { timeout: 15_000 }).toContain('PressCompass Daily');

    await main(page).getByRole('textbox', { name: 'Publication name' }).fill('PressCompass');
    await main(page).getByRole('button', { name: 'Save settings' }).click();
    await expect(main(page).getByText('SEO settings saved.')).toBeVisible();
  });

  test('logs addresses with no page and redirects them from the 404 log', async ({ page, browser, request }, testInfo) => {
    desktopOnly(testInfo.project.name);
    const { section } = await seedTaxonomy('seo-404');
    const title = unique('New home of an old story');
    await seedArticle({ title, sectionId: section.id, ready: true, status: 'published' });
    await revalidateSite();
    const old = `/${unique('archive')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}/2019/old-story`;

    const reader = await browser.newPage();
    await reader.goto(old);
    await expect(reader.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await expect.poll(async () => (await sql(`select path from public.not_found_log where path = $1`, [old])).length, { timeout: 10_000 }).toBe(1);

    await signIn(page, '/newsroom/seo/not-found');
    await main(page)
      .getByRole('link', { name: `Create redirect from ${old}` })
      .click();
    await expect(main(page).getByRole('textbox', { name: 'Old address' })).toHaveValue(old);
    await main(page)
      .getByRole('textbox', { name: 'New address' })
      .fill(`/${section.slug}/${slugFor(title)}`);
    await expect(main(page).getByText(/Vercel redirects are not connected/)).toBeVisible();
    await main(page).getByRole('button', { name: 'Save redirect' }).click();
    await expect(main(page).getByText('Redirect saved.')).toBeVisible();
    await expect(main(page).getByRole('cell', { name: old, exact: true })).toBeVisible();
    expect(await sql(`select path from public.not_found_log where path = $1`, [old])).toHaveLength(0);

    // The address answers with a permanent redirect once the site cache has picked up the change.
    const target = `/${section.slug}/${slugFor(title)}`;
    await expect
      .poll(
        async () => {
          // Next.js answers a cached redirect with 308 and sends readers on with the redirect in the page itself.
          return (await request.get(old, { maxRedirects: 0 })).status();
        },
        { timeout: 30_000 },
      )
      .toBe(308);
    await reader.goto(old);
    await expect(reader).toHaveURL(new RegExp(`${target}$`));
    await reader.close();
  });
});

test('the SEO tab and the SEO pages are accessible in both themes', async ({ page }, testInfo) => {
  desktopOnly(testInfo.project.name);
  const { section, author } = await seedTaxonomy('seo-axe');
  const id = await seedArticle({ title: unique('Accessible SEO'), sectionId: section.id, authorId: author.id, ready: true });
  await signIn(page, `/newsroom/articles/${id}`);
  await main(page).getByRole('tab', { name: /SEO/ }).click();
  const panel = main(page).getByRole('tabpanel', { name: /SEO/ });
  for (const name of ['Internal links', 'Social card', 'Advanced']) await panel.getByText(name, { exact: true }).click();
  await panel
    .getByText(/^Good results/)
    .first()
    .click();
  await page.waitForLoadState('networkidle');
  const check = async () => {
    await expectNoAxeViolations(page);
    await page.emulateMedia({ colorScheme: 'dark' });
    await expectNoAxeViolations(page);
    await page.emulateMedia({ colorScheme: 'light' });
  };
  await check();
  for (const path of ['/newsroom/seo', '/newsroom/seo/redirects', '/newsroom/seo/not-found']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeAttached();
    await check();
  }
});
