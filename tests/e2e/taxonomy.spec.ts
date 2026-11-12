import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, signIn, unique } from './helpers';

// Locators use roles, not labels: Next keeps visited pages hidden in the DOM, and roles skip hidden elements.
test.describe('sections, tags and authors', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'Form flows run on desktop; the mobile layout is checked separately.');
    await signIn(page);
  });

  test('creates a section, renames its address, and deletes it', async ({ page }) => {
    const name = unique('Economy');
    const slug = name.toLowerCase().replace(' ', '-');
    await page.goto('/newsroom/sections/new');
    await page.getByRole('textbox', { name: 'Name' }).fill(name);
    await expect(page.getByRole('textbox', { name: 'Address' })).toHaveValue(slug);
    await page.getByRole('button', { name: 'Create section' }).click();
    await expect(page.getByRole('main').getByRole('status')).toHaveText('Section created.');
    const row = page.getByRole('row', { name: new RegExp(name) });
    await expect(row).toContainText(`/${slug}`);
    await expect(row).toContainText('Shown');

    await row.getByRole('link', { name }).click();
    await page.getByRole('textbox', { name: 'Address' }).fill(`${slug}-news`);
    await page.getByRole('checkbox', { name: 'Show in the main navigation' }).uncheck();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('main').getByRole('status')).toHaveText('Section saved.');
    await expect(page.getByRole('row', { name: new RegExp(name) })).toContainText(`/${slug}-news`);
    await expect(page.getByRole('row', { name: new RegExp(name) })).toContainText('Hidden');

    await page.getByRole('link', { name }).click();
    await page.getByRole('button', { name: 'Delete section' }).click();
    const dialog = page.getByRole('dialog', { name: `Delete ${name}?` });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete section' }).click();
    await expect(page.getByRole('main').getByRole('status')).toHaveText('Section deleted.');
    await expect(page.getByRole('link', { name })).toHaveCount(0);
  });

  test('explains reserved and duplicate addresses next to the field', async ({ page }) => {
    await page.goto('/newsroom/sections/new');
    await page.getByRole('textbox', { name: 'Name' }).fill('Search');
    await page.getByRole('button', { name: 'Create section' }).click();
    await expect(page.getByText('The site already uses /search. Choose another address.')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Address' })).toHaveAttribute('aria-invalid', 'true');

    const name = unique('Twin');
    for (let attempt = 0; attempt < 2; attempt++) {
      await page.goto('/newsroom/sections/new');
      await page.getByRole('textbox', { name: 'Name' }).fill(name);
      await page.getByRole('button', { name: 'Create section' }).click();
    }
    await expect(page.getByText('Another section already uses this address.')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue(name);
  });

  test('moves sections in the navigation order', async ({ page }) => {
    const first = unique('Alpha');
    const second = unique('Beta');
    for (const name of [first, second]) {
      await page.goto('/newsroom/sections/new');
      await page.getByRole('textbox', { name: 'Name' }).fill(name);
      await page.getByRole('button', { name: 'Create section' }).click();
      await expect(page.getByRole('main').getByRole('status')).toHaveText('Section created.');
    }
    const order = async () => (await page.getByRole('row').allTextContents()).findIndex((text) => text.includes(second));
    const before = await order();
    await page.getByRole('button', { name: `Move ${second} up` }).click();
    await expect.poll(order).toBe(before - 1);
  });

  test('creates a tag and an author with profile links', async ({ page }) => {
    const tag = unique('Rice');
    await page.goto('/newsroom/tags/new');
    await page.getByRole('textbox', { name: 'Name' }).fill(tag);
    await page.getByRole('textbox', { name: 'Description' }).fill('Harvests, prices and imports.');
    await page.getByRole('button', { name: 'Create tag' }).click();
    await expect(page.getByRole('main').getByRole('status')).toHaveText('Tag created.');
    await expect(page.getByRole('row', { name: new RegExp(tag) })).toContainText('Harvests, prices and imports.');

    const author = unique('Rani');
    await page.goto('/newsroom/authors/new');
    await page.getByRole('textbox', { name: 'Name' }).fill(author);
    await page.getByRole('textbox', { name: 'Role' }).fill('Business correspondent');
    await page.getByRole('textbox', { name: 'Link 1 label' }).fill('Website');
    await page.getByRole('textbox', { name: 'Link 1 address' }).fill('javascript:alert(1)');
    await page.getByRole('button', { name: 'Create author' }).click();
    await expect(page.getByText('Each link needs a label and an address that starts with https:// or http://.')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Role' })).toHaveValue('Business correspondent');
    await page.getByRole('textbox', { name: 'Link 1 address' }).fill('https://example.com/rani');
    await page.getByRole('button', { name: 'Create author' }).click();
    await expect(page.getByRole('main').getByRole('status')).toHaveText('Author created.');
    await page.getByRole('link', { name: author }).click();
    await expect(page.getByRole('textbox', { name: 'Link 1 address' })).toHaveValue('https://example.com/rani');
  });

  test('pages are accessible in both themes', async ({ page }) => {
    for (const path of ['/newsroom/sections', '/newsroom/sections/new', '/newsroom/tags', '/newsroom/authors/new']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectNoAxeViolations(page);
      await page.emulateMedia({ colorScheme: 'dark' });
      await expectNoAxeViolations(page);
      await page.emulateMedia({ colorScheme: 'light' });
    }
  });
});

test('the Newsroom menu fits a phone screen without sideways scrolling', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Phone layout only.');
  await signIn(page, '/newsroom/sections');
  await expect(page.getByRole('link', { name: 'Sections' })).toHaveAttribute('aria-current', 'page');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});
