import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { Client } from 'pg';

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

// Direct access to the fake Supabase database (tests/fake-supabase), to set up data quickly.
const ADMIN_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/postgres';

export async function sql<T extends Record<string, unknown> = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const url = new URL(ADMIN_URL);
  url.pathname = '/presscompass_e2e';
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  try {
    return (await client.query(text, params)).rows as T[];
  } finally {
    await client.end();
  }
}

export const READY_BODY = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Prices of medium-grade rice rose for a third week as the dry season cut yields across Java.' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Traders in Jakarta said supplies were thin. '.repeat(20).trim() }] },
  ],
};

/** A section, an author and a tag with unique names, created straight in the database. */
export async function seedTaxonomy(label: string) {
  const key = unique(label).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const [section] = await sql<{ id: string; name: string; slug: string }>(
    `insert into public.sections (name, slug) values ($1, $2) returning id, name, slug`,
    [`Section ${key}`, `s-${key}`],
  );
  const [author] = await sql<{ id: string; name: string }>(`insert into public.authors (name, slug, role) values ($1, $2, 'Reporter') returning id, name`, [
    `Author ${key}`,
    `a-${key}`,
  ]);
  const [tag] = await sql<{ id: string; name: string }>(`insert into public.tags (name, slug) values ($1, $2) returning id, name`, [`Tag ${key}`, `t-${key}`]);
  return { section, author, tag, key };
}

/** A media library row straight in the database (no file on the fake Cloudinary, so it shows as a blank image). */
export async function seedMedia(alt = 'Farmers plant rice seedlings in a flooded field.') {
  const key = unique('seed').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const [media] = await sql<{ id: string }>(
    `insert into public.media (public_id, format, width, height, bytes, alt, original_name) values ($1, 'jpg', 1600, 900, 120000, $2, $3) returning id`,
    [`presscompass/images/${key}`, alt, `${key}.jpg`],
  );
  return media.id;
}

/** The address part the Newsroom makes from a headline. */
export const slugFor = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** An article straight in the database; `ready` fills everything publishing needs (including a lead image with alt text). */
export async function seedArticle(options: {
  title: string;
  sectionId?: string;
  authorId?: string;
  tagId?: string;
  ready?: boolean;
  status?: string;
  body?: unknown;
  scheduledAt?: Date;
  publishedAt?: Date;
}) {
  const leadMediaId = options.ready ? await seedMedia() : null;
  const [article] = await sql<{ id: string }>(
    `insert into public.articles (title, slug, section_id, standfirst, body, body_text, word_count, status, published_at, scheduled_at, lead_media_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8::public.article_status,
             case when $8::text = 'published' then coalesce($10, now()) else null end, $11, $9) returning id`,
    [
      options.title,
      slugFor(options.title),
      options.sectionId ?? null,
      options.ready ? 'Why it matters for households.' : '',
      JSON.stringify(options.body ?? (options.ready ? READY_BODY : { type: 'doc', content: [] })),
      '',
      options.ready ? 160 : 0,
      options.status ?? 'draft',
      leadMediaId,
      options.publishedAt ?? null,
      options.scheduledAt ?? null,
    ],
  );
  if (options.authorId) await sql(`insert into public.article_authors (article_id, author_id) values ($1, $2)`, [article.id, options.authorId]);
  if (options.tagId) await sql(`insert into public.article_tags (article_id, tag_id) values ($1, $2)`, [article.id, options.tagId]);
  return article.id;
}

// Same value as CRON_SECRET in playwright.config.ts.
export const CRON_SECRET = 'e2e-cron-secret-that-is-long-enough-1234';

/** Drops cached site pages after seeding with SQL (the Newsroom does this itself). */
export async function revalidateSite(tags = ['site']) {
  const response = await fetch('http://localhost:3100/api/revalidate', {
    method: 'POST',
    headers: { authorization: `Bearer ${CRON_SECRET}`, 'content-type': 'application/json' },
    body: JSON.stringify({ tags }),
  });
  expect(response.status).toBe(200);
}
