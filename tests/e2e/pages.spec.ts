import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, signIn, unique } from './helpers';

test('writes, publishes and unpublishes a static page', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One project is enough for a shared page.');
  const title = unique('Editorial standards');
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  await signIn(page, '/newsroom/pages');
  await page.getByRole('button', { name: 'New page' }).click();
  await page.waitForURL(/\/newsroom\/pages\/[0-9a-f-]{36}$/);
  const main = page.getByRole('main');

  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(main.getByRole('alert').filter({ hasText: 'Check the fields marked below.' })).toBeVisible();
  await expect(main.getByText('Add a title before publishing.')).toBeVisible();

  await page.getByRole('textbox', { name: 'Title' }).fill(title);
  await expect(page.getByRole('textbox', { name: 'Address' })).toHaveValue(slug);
  await page.getByRole('textbox', { name: 'Description' }).fill('How we report and correct.');
  await page.locator('.ProseMirror').click();
  await page.keyboard.type('We check every figure against its source before publishing.');
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(main.getByRole('status').filter({ hasText: 'Page published.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View page' })).toHaveAttribute('href', `/${slug}`);
  await expectNoAxeViolations(page);

  await expect(async () => {
    await page.goto(`/${slug}`);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  }).toPass({ timeout: 20_000 });
  await expect(page.getByText('We check every figure against its source before publishing.')).toBeVisible();
  await expect(page.getByRole('contentinfo').getByRole('link', { name: title })).toBeVisible();
  await expect(page).toHaveTitle(new RegExp(title));

  await page.goto('/newsroom/pages');
  await page.getByRole('link', { name: title }).click();
  await page.getByRole('button', { name: 'Unpublish' }).click();
  await expect(main.getByRole('status').filter({ hasText: 'Page unpublished.' })).toBeVisible();
  await expect(async () => {
    const response = await page.request.get(`/${slug}`);
    expect(await response.text()).not.toContain('We check every figure');
  }).toPass({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Delete page' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete page' }).click();
  await page.waitForURL('**/newsroom/pages?notice=deleted');
  await expect(main.getByRole('link', { name: title })).toHaveCount(0);
});
