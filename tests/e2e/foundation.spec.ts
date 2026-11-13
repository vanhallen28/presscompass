import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Password the fake Supabase accepts (tests/fake-supabase/auth.mjs).
const PASSWORD = 'correct-horse-battery-staple';

test.describe('site basics', () => {
  test('shows the masthead, stays out of search engines until launch', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'PressCompass home' })).toBeVisible();
    await expect(page).toHaveTitle('PressCompass · News with a sense of direction');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('uses the light palette by default and the dark palette when the device prefers it', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(246, 244, 239)');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(11, 21, 36)');
  });

  test('loads the self-hosted fonts', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const families = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family));
    expect(families.join(' ')).toMatch(/newsreader/i);
  });

  test('has no accessibility violations', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe('Newsroom access', () => {
  test('sends signed-out visitors to the login page and remembers where they were going', async ({ page }) => {
    await page.goto('/newsroom/articles?status=draft');
    await expect(page).toHaveURL(/\/newsroom\/login\?next=%2Fnewsroom%2Farticles%3Fstatus%3Ddraft$/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('login page is labelled and accessible in both themes', async ({ page }) => {
    await page.goto('/newsroom/login');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      expect(results.violations, `${colorScheme} theme`).toEqual([]);
    }
  });

  test('asks for both fields before contacting Supabase', async ({ page }) => {
    await page.goto('/newsroom/login');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('main').getByRole('alert')).toHaveText('Enter your email and password.');
  });

  test('rejects a wrong password and keeps the email', async ({ page }) => {
    await page.goto('/newsroom/login');
    await page.getByLabel('Email').fill('owner@example.com');
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('main').getByRole('alert')).toHaveText('Email or password is incorrect.');
    await expect(page.getByLabel('Email')).toHaveValue('owner@example.com');
  });

  test('refuses accounts that are not Newsroom staff', async ({ page }) => {
    await page.goto('/newsroom/login');
    await page.getByLabel('Email').fill('stranger@example.com');
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('main').getByRole('alert')).toHaveText('This account does not have Newsroom access.');
    await page.goto('/newsroom');
    await expect(page).toHaveURL(/\/newsroom\/login/);
  });

  test('signs the owner in, shows the dashboard, and signs out', async ({ page }, testInfo) => {
    await page.goto('/newsroom');
    await page.getByLabel('Email').fill('owner@example.com');
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/newsroom$/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText(/Connected\. \d+ sections?\./)).toBeVisible();
    if (testInfo.project.name === 'desktop') await expect(page.getByText('owner@example.com', { exact: true })).toBeVisible();

    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      expect(results.violations, `${colorScheme} theme`).toEqual([]);
    }

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/newsroom\/login$/);
    await page.goto('/newsroom');
    await expect(page).toHaveURL(/\/newsroom\/login/);
  });
});
