import { expect, type Page, test } from '@playwright/test';
import { expectNoAxeViolations, seedArticle, seedTaxonomy, signIn, sql, unique } from './helpers';

// Locators use roles, not labels: Next keeps visited pages hidden in the DOM, and roles skip hidden elements.

const main = (page: Page) => page.getByRole('main');
const saveState = (page: Page) => main(page).locator('p[role="status"]');

async function newArticle(page: Page) {
  await page.goto('/newsroom/articles');
  await page.getByRole('button', { name: 'New article' }).click();
  await page.waitForURL(/\/newsroom\/articles\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('textbox', { name: 'Article text' })).toBeVisible();
  return page.url().split('/').pop() as string;
}

async function typeBody(page: Page, text: string) {
  await page.getByRole('textbox', { name: 'Article text' }).click();
  await page.keyboard.insertText(text);
}

test.describe('articles', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'Editor flows run on desktop; the phone layout is checked separately.');
    await signIn(page);
  });

  test('writes a draft that saves itself, explains what blocks publishing, then publishes', async ({ page }) => {
    test.setTimeout(60_000);
    const { section, author, tag } = await seedTaxonomy('Write');
    const headline = unique('Rice prices climb');
    const id = await newArticle(page);

    await page.getByRole('textbox', { name: 'Headline' }).fill(headline);
    await page.getByRole('textbox', { name: 'Standfirst' }).fill('Farmers expect a smaller harvest.');
    await page.getByRole('button', { name: 'H2 heading' }).click();
    await page.keyboard.type('What changed');
    await page.keyboard.press('Enter');
    await page.keyboard.insertText('Prices rose again this week. '.repeat(32).trim());
    await expect(saveState(page)).toHaveText('Unsaved changes');
    await expect(saveState(page)).toHaveText(/^Saved /, { timeout: 15_000 });
    await expect(main(page).getByText(/^\d+ words · 1 min read$/)).toBeVisible();

    await page.getByRole('button', { name: 'Publish now' }).click();
    const problems = main(page).getByRole('alert');
    await expect(problems).toContainText('2 things need attention');
    await expect(problems).toContainText('Choose a section.');
    await expect(problems).toContainText('Add at least one author.');

    await page.getByRole('combobox', { name: 'Section' }).selectOption({ label: section.name });
    await page.getByRole('combobox', { name: 'Add an author' }).selectOption({ label: author.name });
    await page.getByRole('combobox', { name: 'Add a tag' }).selectOption({ label: tag.name });
    await page.getByRole('button', { name: 'Publish now' }).click();
    await expect(main(page).getByRole('status').filter({ hasText: 'Published.' })).toBeVisible();
    await expect(main(page).getByText(/^First published /)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Update', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Address' })).toHaveValue(headline.toLowerCase().replace(/ /g, '-'));

    const [row] = await sql<{ status: string; word_count: number; tags: number; heading: number }>(
      `select status, word_count,
              (select count(*)::int from public.article_tags where article_id = a.id) as tags,
              (body -> 'content' -> 0 -> 'attrs' ->> 'level')::int as heading
         from public.articles a where id = $1`,
      [id],
    );
    expect(row).toMatchObject({ status: 'published', tags: 1, heading: 2 });
    expect(row.word_count).toBeGreaterThanOrEqual(150);

    await page.goto(`/newsroom/preview/${id}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(headline);
    await expect(page.getByRole('heading', { level: 2, name: 'What changed' })).toBeVisible();
    await expect(page.getByText(`By ${author.name}`)).toBeVisible();
    await expect(page.getByText('Readers see this version.')).toBeVisible();

    await page.goto(`/newsroom/articles/${id}/history`);
    await expect(page.getByRole('cell', { name: /^Published/ })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Autosaved' })).toBeVisible();
  });

  test('adds the special blocks and shows them in the preview', async ({ page }) => {
    const { section, author } = await seedTaxonomy('Blocks');
    const target = await seedArticle({ title: unique('Earlier story'), sectionId: section.id, authorId: author.id, ready: true, status: 'published' });
    const [{ title: targetTitle }] = await sql<{ title: string }>(`select title from public.articles where id = $1`, [target]);
    const id = await newArticle(page);
    await page.getByRole('textbox', { name: 'Headline' }).fill(unique('Blocks'));
    await typeBody(page, 'Opening paragraph.');

    await page.getByRole('button', { name: 'Pull quote' }).click();
    let dialog = page.getByRole('dialog', { name: 'Pull quote' });
    await dialog.getByRole('button', { name: 'Insert' }).click();
    await expect(dialog.getByText('Write the quote.')).toBeVisible();
    await dialog.getByRole('textbox', { name: 'Quote' }).fill('We are not done with this season yet.');
    await dialog.getByRole('textbox', { name: /Who said it/ }).fill('Head of Bulog');
    await dialog.getByRole('button', { name: 'Insert' }).click();

    await page.getByRole('button', { name: 'Key figures' }).click();
    dialog = page.getByRole('dialog', { name: 'Key figures' });
    await dialog.getByRole('textbox', { name: 'Figure 1' }).fill('31.5m');
    await dialog.getByRole('textbox', { name: 'Label 1' }).fill('tonnes expected');
    await dialog.getByRole('textbox', { name: 'Figure 2' }).fill('−2.4%');
    await dialog.getByRole('textbox', { name: 'Label 2' }).fill('on last year');
    await dialog.getByRole('textbox', { name: /Source/ }).fill('BPS');
    await dialog.getByRole('button', { name: 'Insert' }).click();

    await page.getByRole('button', { name: 'YouTube video' }).click();
    dialog = page.getByRole('dialog', { name: 'YouTube video' });
    await dialog.getByRole('textbox', { name: 'YouTube link' }).fill('https://vimeo.com/123');
    await dialog.getByRole('textbox', { name: 'What the video shows' }).fill('Harvest in Karawang');
    await dialog.getByRole('button', { name: 'Insert' }).click();
    await expect(dialog.getByText(/Paste a YouTube link/)).toBeVisible();
    await dialog.getByRole('textbox', { name: 'YouTube link' }).fill('https://youtu.be/dQw4w9WgXcQ');
    await dialog.getByRole('button', { name: 'Insert' }).click();

    await page.getByRole('button', { name: 'Read more card' }).click();
    dialog = page.getByRole('dialog', { name: 'Read more' });
    await dialog.getByRole('searchbox', { name: 'Find an article' }).fill(targetTitle);
    await dialog.getByRole('button', { name: 'Search' }).click();
    await dialog.getByRole('button', { name: new RegExp(targetTitle) }).click();
    await dialog.getByRole('button', { name: 'Insert' }).click();

    await expect(page.getByText('PULL QUOTE', { exact: false }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(main(page).getByRole('status').filter({ hasText: 'Draft saved.' })).toBeVisible();

    await page.goto(`/newsroom/preview/${id}`);
    await expect(page.getByText('We are not done with this season yet.')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Key figures' })).toContainText('31.5m');
    await expect(page.getByText('Source: BPS')).toBeVisible();
    await expect(page.getByRole('link', { name: targetTitle })).toHaveAttribute('href', `/${section.slug}/${targetTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
    await expect(page.locator('iframe')).toHaveCount(0);
    await page.getByRole('button', { name: 'Play video: Harvest in Karawang' }).click();
    await expect(page.locator('iframe[src^="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"]')).toBeAttached();
  });

  test('schedules in WIB and publishes once the time has passed', async ({ page }) => {
    const { section, author } = await seedTaxonomy('Schedule');
    const id = await seedArticle({ title: unique('Scheduled story'), sectionId: section.id, authorId: author.id, ready: true });
    await page.goto(`/newsroom/articles/${id}`);
    await page.getByRole('button', { name: 'Schedule', exact: true }).click();
    await page.getByLabel('Publish time (WIB)').fill('2099-01-02T09:30');
    await page.getByRole('button', { name: 'Confirm schedule' }).click();
    await expect(main(page).getByRole('status').filter({ hasText: 'Scheduled for 2 Jan 2099, 09:30 WIB.' })).toBeVisible();
    const [row] = await sql<{ status: string; scheduled_at: Date }>(`select status, scheduled_at from public.articles where id = $1`, [id]);
    expect(row.status).toBe('scheduled');
    expect(row.scheduled_at.toISOString()).toBe('2099-01-02T02:30:00.000Z');

    await sql(`update public.articles set scheduled_at = now() - interval '1 minute' where id = $1`, [id]);
    await page.goto('/newsroom/articles?status=published');
    await expect(page.getByRole('row', { name: /Scheduled story/ }).filter({ hasText: 'Published' }).first()).toBeVisible();
  });

  test('unpublishes and archives after confirming, and archived articles are read-only', async ({ page }) => {
    const { section, author } = await seedTaxonomy('Archive');
    const id = await seedArticle({ title: unique('Live story'), sectionId: section.id, authorId: author.id, ready: true, status: 'published' });
    await page.goto(`/newsroom/articles/${id}`);
    await page.getByRole('button', { name: 'Unpublish', exact: true }).click();
    const confirm = page.getByRole('dialog', { name: 'Unpublish this article?' });
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('button', { name: 'Update', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Unpublish', exact: true }).click();
    await confirm.getByRole('button', { name: 'Unpublish' }).click();
    await expect(main(page).getByRole('status').filter({ hasText: 'Unpublished. Readers no longer see it.' })).toBeVisible();

    await page.getByRole('button', { name: 'Archive', exact: true }).click();
    await page.getByRole('dialog', { name: 'Archive this article?' }).getByRole('button', { name: 'Archive' }).click();
    await expect(main(page).getByText('Archived articles are read-only.')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Headline' })).toBeDisabled();
    await page.getByRole('button', { name: 'Restore to draft' }).click();
    await expect(page.getByRole('textbox', { name: 'Headline' })).toBeEnabled();
  });

  test('refuses a save from a window that is out of date', async ({ page, context }) => {
    const id = await seedArticle({ title: unique('Two windows') });
    const other = await context.newPage();
    await other.goto(`/newsroom/articles/${id}`);
    await page.goto(`/newsroom/articles/${id}`);
    await page.getByRole('textbox', { name: 'Headline' }).fill('Saved in the first window');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(main(page).getByRole('status').filter({ hasText: 'Draft saved.' })).toBeVisible();

    await other.getByRole('textbox', { name: 'Headline' }).fill('Typed in the second window');
    await other.getByRole('button', { name: 'Save draft' }).click();
    await expect(main(other).getByRole('alert').filter({ hasText: 'This article changed in another window.' })).toBeVisible();
    await expect(other.getByRole('button', { name: 'Reload' })).toBeVisible();
    const [row] = await sql<{ title: string }>(`select title from public.articles where id = $1`, [id]);
    expect(row.title).toBe('Saved in the first window');
  });

  test('restores an earlier version from the history', async ({ page }) => {
    const id = await newArticle(page);
    await page.getByRole('textbox', { name: 'Headline' }).fill('First headline');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(main(page).getByRole('status').filter({ hasText: 'Draft saved.' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Headline' }).fill('Second headline');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(main(page).getByRole('status').filter({ hasText: 'Draft saved.' })).toBeVisible();

    await page.goto(`/newsroom/articles/${id}/history`);
    await page.getByRole('row').nth(2).getByRole('button', { name: 'Restore' }).click();
    await page.getByRole('dialog', { name: 'Restore this version?' }).getByRole('button', { name: 'Restore' }).click();
    await page.waitForURL(`**/newsroom/articles/${id}?notice=restored`);
    await expect(page.getByRole('textbox', { name: 'Headline' })).toHaveValue('First headline');
    await expect(main(page).getByText('Earlier version restored.')).toBeVisible();
    await page.goto(`/newsroom/articles/${id}/history`);
    await expect(page.getByRole('cell', { name: /^Restored the version from/ })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Before restore' })).toBeVisible();
  });

  test('filters the list and publishes several articles at once, naming what blocks the rest', async ({ page }) => {
    const { section, author } = await seedTaxonomy('Bulk');
    const ready = unique('Bulk ready');
    const thin = unique('Bulk thin');
    await seedArticle({ title: ready, sectionId: section.id, authorId: author.id, ready: true });
    await seedArticle({ title: thin, sectionId: section.id, authorId: author.id });

    await page.goto('/newsroom/articles');
    await page.getByRole('combobox', { name: 'Section' }).selectOption({ label: section.name });
    await page.getByRole('button', { name: 'Filter' }).click();
    await expect(page.getByRole('row')).toHaveCount(3);
    await page.getByRole('searchbox', { name: 'Search articles' }).fill(ready);
    await page.getByRole('button', { name: 'Filter' }).click();
    await expect(page.getByRole('row')).toHaveCount(2);
    await page.getByRole('link', { name: 'Clear' }).click();

    await page.getByRole('combobox', { name: 'Section' }).selectOption({ label: section.name });
    await page.getByRole('button', { name: 'Filter' }).click();
    await expect(page.getByRole('row')).toHaveCount(3);
    await page.getByRole('checkbox', { name: 'Select all articles on this page' }).check();
    await page.getByRole('combobox', { name: 'Action for selected articles' }).selectOption('publish');
    await page.getByRole('button', { name: 'Apply' }).click();
    const notice = main(page).getByRole('alert');
    await expect(notice).toContainText('1 article published. 1 article needs work before publishing:');
    await expect(notice).toContainText(thin);
    await expect(notice).toContainText('Add a standfirst');
    await expect(page.getByRole('row', { name: new RegExp(ready) })).toContainText('Published');

    await page.getByRole('checkbox', { name: `Select ${thin}` }).check();
    await page.getByRole('combobox', { name: 'Action for selected articles' }).selectOption('delete');
    await page.getByRole('button', { name: 'Apply' }).click();
    await page.getByRole('dialog', { name: 'Delete 1 article?' }).getByRole('button', { name: 'Delete' }).click();
    await expect(main(page).getByRole('status')).toContainText('1 article deleted.');
    await expect(page.getByRole('row', { name: new RegExp(thin) })).toHaveCount(0);
  });

  test('editor, list, history and preview are accessible in both themes', async ({ page }) => {
    const { section, author } = await seedTaxonomy('Axe');
    const id = await seedArticle({ title: unique('Accessible story'), sectionId: section.id, authorId: author.id, ready: true });
    for (const path of [`/newsroom/articles/${id}`, '/newsroom/articles', `/newsroom/articles/${id}/history`, `/newsroom/preview/${id}`, '/newsroom']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeAttached();
      await page.waitForLoadState('networkidle');
      await expectNoAxeViolations(page);
      await page.emulateMedia({ colorScheme: 'dark' });
      await expectNoAxeViolations(page);
      await page.emulateMedia({ colorScheme: 'light' });
    }
  });
});

test('the editor fits a phone screen', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Phone layout only.');
  const id = await seedArticle({ title: unique('Phone story') });
  await signIn(page, `/newsroom/articles/${id}`);
  await expect(page.getByRole('textbox', { name: 'Article text' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});
