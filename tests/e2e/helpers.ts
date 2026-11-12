import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

// Password the fake Supabase accepts (tests/fake-supabase/auth.mjs).
export const PASSWORD = 'correct-horse-battery-staple';

export async function signIn(page: Page, next = '/newsroom') {
  await page.goto(`/newsroom/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Email').fill('owner@example.com');
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => url.pathname === next);
}

/** A name no other test (or parallel project) uses, so tests can share one database. */
export function unique(prefix: string) {
  return `${prefix} ${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

export async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}
