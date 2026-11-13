import { expect, type Page, test } from '@playwright/test';
import { CRON_SECRET, expectNoAxeViolations, READY_BODY, revalidateSite, seedArticle, seedTaxonomy, signIn, slugFor, sql, unique } from './helpers';

// The public site against the fake Supabase. Tests seed with SQL, so they drop the cache themselves
// (revalidateSite); the Newsroom flow at the end checks that the Newsroom does it on its own.

const main = (page: Page) => page.getByRole('main');

/** Seeds a section, author and tag, a published article in them and a draft in the same section. */
async function seedStory(label: string, extra: Partial<Parameters<typeof seedArticle>[0]> = {}) {
  const taxonomy = await seedTaxonomy(label);
  const title = extra.title ?? unique(`${label} story`);
  const draft = unique(`${label} draft`);
  const id = await seedArticle({ ready: true, status: 'published', sectionId: taxonomy.section.id, authorId: taxonomy.author.id, tagId: taxonomy.tag.id, ...extra, title });
  await seedArticle({ title: draft, ready: true, status: 'draft', sectionId: taxonomy.section.id, authorId: taxonomy.author.id });
  await revalidateSite();
  return { ...taxonomy, id, title, draft, href: `/${taxonomy.section.slug}/${slugFor(title)}` };
}

/** A missing page is a soft 404 (noindex) on its first visit and a real 404 once cached. */
async function expectMissing(page: Page, path: string) {
  const first = await page.request.get(path);
  if (first.status() === 200) expect(await first.text()).toContain('<meta name="robots" content="noindex"/>');
  else expect(first.status()).toBe(404);
  await expect.poll(async () => (await page.request.get(path)).status()).toBe(404);
}

test('shows published articles on the front page, their section, author and tag pages, and hides drafts', async ({ page }) => {
  const story = await seedStory('Site');
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: story.section.name })).toBeVisible();
  await expect(main(page).getByRole('link', { name: new RegExp(story.title) }).first()).toBeVisible();
  await expect(page.getByText(story.draft)).toHaveCount(0);

  await page.goto(story.href);
  await expect(page.getByRole('heading', { level: 1, name: story.title })).toBeVisible();
  await expect(page).toHaveTitle(`${story.title} · PressCompass`);
  await expect(page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: story.section.name })).toHaveAttribute('aria-current', 'true');
  await expect(main(page).getByRole('link', { name: story.author.name })).toHaveAttribute('href', `/author/a-${story.key}`);
  await main(page).getByRole('link', { name: story.tag.name }).click();
  await page.waitForURL(`**/tag/t-${story.key}`);
  await expect(page.getByRole('heading', { level: 1, name: story.tag.name })).toBeVisible();
  await expect(main(page).getByRole('link', { name: new RegExp(story.title) })).toBeVisible();

  await page.goto(`/author/a-${story.key}`);
  await expect(page.getByRole('heading', { level: 1, name: story.author.name })).toBeVisible();
  await expect(main(page).getByText('1 article', { exact: true })).toBeVisible();

  await page.goto(`/${story.section.slug}`);
  await expect(page.getByRole('heading', { level: 1, name: story.section.name })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: story.section.name })).toHaveAttribute('aria-current', 'page');
  await expect(main(page).getByRole('link', { name: new RegExp(story.title) })).toBeVisible();
  await expect(page.getByText(story.draft)).toHaveCount(0);

  await expectMissing(page, `/${story.section.slug}/${slugFor(story.draft)}`);
  await expectMissing(page, `/${unique('nowhere').replace(/\W+/g, '-')}`);
});

test('sends wrong sections and changed addresses to the article with a permanent redirect', async ({ page }) => {
  const story = await seedStory('Moved');
  await page.goto(`/news-${story.key}/${slugFor(story.title)}`);
  await expect(page).toHaveURL(new RegExp(`${story.href}$`));

  const newSlug = `${slugFor(story.title)}-updated`;
  await sql(`update public.articles set slug = $1 where id = $2`, [newSlug, story.id]);
  await revalidateSite();
  await page.goto(story.href);
  await expect(page).toHaveURL(new RegExp(`/${story.section.slug}/${newSlug}$`));
  await expect(page.getByRole('heading', { level: 1, name: story.title })).toBeVisible();
  await expect.poll(async () => (await page.request.get(story.href, { maxRedirects: 0 })).status()).toBe(308);
});

test('pages through a section', async ({ page }) => {
  const { section } = await seedTaxonomy('Paged');
  await sql(
    `insert into public.articles (title, slug, section_id, status, published_at)
     select 'Paged story ' || n, $2 || '-' || n, $1, 'published', now() - (n || ' minutes')::interval from generate_series(1, 25) n`,
    [section.id, section.slug],
  );
  await revalidateSite();
  await page.goto(`/${section.slug}`);
  await expect(main(page).getByText('25 articles')).toBeVisible();
  await expect(main(page).getByRole('link', { name: /Paged story/ })).toHaveCount(24);
  await page.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name: 'Older articles' }).click();
  await page.waitForURL(`**/${section.slug}/page/2`);
  await expect(main(page).getByRole('link', { name: /Paged story 25/ })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Pages' })).toContainText('Page 2 of 2');
  await expectMissing(page, `/${section.slug}/page/3`);
});

test('finds published articles by their words', async ({ page }) => {
  const word = `zq${Date.now().toString(36)}`;
  const story = await seedStory('Search', { title: `The ${word} harbour reopens` });
  await sql(`update public.articles set title = $1 where title = $2`, [`The ${word} harbour draft`, story.draft]);
  await revalidateSite();
  await page.goto('/search');
  await page.getByRole('searchbox', { name: 'Search PressCompass' }).first().fill(word);
  await main(page).getByRole('button', { name: 'Search' }).click();
  await page.waitForURL(`**/search?q=${word}`);
  await expect(main(page).getByRole('status')).toHaveText(`1 result for “${word}”`);
  await expect(main(page).getByRole('link', { name: new RegExp(`The ${word} harbour reopens`) })).toBeVisible();
  await page.goto(`/search?q=${word}nothing`);
  await expect(main(page).getByRole('status')).toContainText('Nothing found');
});

test('draws chart blocks with a table for screen readers', async ({ page }) => {
  const body = {
    type: 'doc',
    content: [
      ...READY_BODY.content,
      {
        type: 'chart',
        attrs: { kind: 'bar', title: 'Annual food inflation', subtitle: 'Per cent', source: 'BPS', axis: 'Month', labels: ['May', 'Jun', 'Jul'], series: [{ name: 'Inflation', values: [4.1, 3.8, 2.1] }] },
      },
    ],
  };
  const story = await seedStory('Chart', { body });
  await page.goto(story.href);
  const chart = main(page).getByRole('figure').filter({ hasText: 'Annual food inflation' });
  await expect(chart.locator('svg rect')).toHaveCount(3);
  await expect(chart.getByRole('table', { name: 'Annual food inflation. Per cent' })).toBeAttached();
  await expect(chart).toContainText('Source: BPS');
});

test('publishes scheduled articles when the cron endpoint runs', async ({ page }) => {
  const { section, author } = await seedTaxonomy('Cron');
  const title = unique('Cron story');
  const id = await seedArticle({ title, ready: true, status: 'scheduled', scheduledAt: new Date(Date.now() - 60_000), sectionId: section.id, authorId: author.id });
  expect((await page.request.get('/api/cron/run')).status()).toBe(401);
  const run = await page.request.get('/api/cron/run', { headers: { authorization: `Bearer ${CRON_SECRET}` } });
  expect(run.status()).toBe(200);
  expect(await run.json()).toMatchObject({ ok: true });
  expect((await sql<{ status: string }>(`select status from public.articles where id = $1`, [id]))[0].status).toBe('published');
  await page.goto(`/${section.slug}/${slugFor(title)}`);
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
});

test('keeps the reader’s theme choice', async ({ page }) => {
  await page.goto('/');
  const theme = page.getByRole('group', { name: 'Theme' });
  await theme.getByRole('button', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(11, 21, 36)');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(theme.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
  await theme.getByRole('button', { name: 'Auto' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./);
});

test('opens the section menu and copies an article link', async ({ page, context }, testInfo) => {
  const story = await seedStory('Menu');
  await page.goto('/');
  await page.getByRole('button', { name: 'Menu' }).click();
  const menu = page.locator('[popover]:popover-open');
  await expect(menu.getByRole('link', { name: story.section.name })).toBeVisible();
  await menu.getByRole('button', { name: 'Close menu' }).click();
  await expect(menu).toHaveCount(0);

  test.skip(testInfo.project.name === 'mobile', 'Clipboard permissions are a desktop browser feature here.');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(story.href);
  await main(page).getByRole('button', { name: 'Copy link' }).click();
  await expect(main(page).getByRole('status').filter({ hasText: 'Link copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`http://localhost:3100${story.href}`);
});

test('public pages are accessible in both themes and fit a phone', async ({ page }, testInfo) => {
  const story = await seedStory('Axe');
  for (const path of ['/', story.href, `/${story.section.slug}`, `/author/a-${story.key}`, '/search?q=story', '/not-a-page']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expectNoAxeViolations(page);
    await page.emulateMedia({ colorScheme: 'dark' });
    await expectNoAxeViolations(page);
    await page.emulateMedia({ colorScheme: 'light' });
    if (testInfo.project.name === 'mobile') {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBe(0);
    }
  }
});

test.describe('from the Newsroom', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'Editor flows run on desktop.');
  });

  test('publishing in the Newsroom shows the article on the site straight away', async ({ page }) => {
    const { section, author } = await seedTaxonomy('Live');
    const title = unique('Live story');
    const id = await seedArticle({ title, ready: true, sectionId: section.id, authorId: author.id });
    const href = `/${section.slug}/${slugFor(title)}`;
    await page.goto(href);
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();

    await signIn(page, `/newsroom/articles/${id}`);
    await page.getByRole('button', { name: 'Publish now' }).click();
    await expect(main(page).getByRole('status').filter({ hasText: 'Published.' })).toBeVisible();
    // The Newsroom expires the cache after one second (src/modules/site/invalidate.ts).
    await expect(async () => {
      await page.goto(href);
      await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible({ timeout: 1000 });
    }).toPass();

    await page.goto(`/newsroom/articles/${id}`);
    await page.getByRole('textbox', { name: 'Headline' }).fill(`${title} (updated)`);
    await page.getByRole('button', { name: 'Update', exact: true }).click();
    await expect(main(page).getByRole('status').filter({ hasText: 'Update published.' })).toBeVisible();
    await expect(async () => {
      await page.goto(href);
      await expect(page.getByRole('heading', { level: 1, name: `${title} (updated)` })).toBeVisible({ timeout: 1000 });
    }).toPass();
  });
});
