import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from './database';

const OWNER = '11111111-1111-4111-8111-111111111111';
const STRANGER = '22222222-2222-4222-8222-222222222222';

let db: TestDatabase;
let sectionId: string;
let authorId: string;
let publishedId: string;
let draftId: string;
let futureId: string;

beforeAll(async () => {
  db = await createTestDatabase();
  const q = db.client;
  await q.query(`insert into auth.users (id, email) values ($1, 'owner@example.com'), ($2, 'stranger@example.com')`, [OWNER, STRANGER]);
  await q.query(`insert into public.staff (user_id) values ($1)`, [OWNER]);
  sectionId = (await q.query(`insert into public.sections (name, slug) values ('Business', 'business') returning id`)).rows[0].id;
  authorId = (await q.query(`insert into public.authors (name, slug) values ('Rani Prameswari', 'rani-prameswari') returning id`)).rows[0].id;
  const insertArticle = async (slug: string, status: string, publishedAt: string | null) =>
    (
      await q.query(
        `insert into public.articles (title, slug, section_id, status, published_at) values ($1, $2, $3, $4, $5) returning id`,
        [slug, slug, sectionId, status, publishedAt],
      )
    ).rows[0].id as string;
  publishedId = await insertArticle('rice-prices', 'published', '2026-11-12T12:50:00Z');
  draftId = await insertArticle('draft-story', 'draft', null);
  futureId = await insertArticle('embargoed-story', 'published', '2999-01-01T00:00:00Z');
  for (const id of [publishedId, draftId]) await q.query(`insert into public.article_authors (article_id, author_id) values ($1, $2)`, [id, authorId]);
  await q.query(`insert into public.pages (title, slug, status, published_at) values ('About', 'about', 'published', now()), ('Privacy', 'privacy', 'draft', null)`);
  await q.query(`update public.layouts set draft = '{"title":"draft"}', published = '{"title":"live"}' where key = 'home'`);
  await q.query(`insert into public.article_revisions (article_id, snapshot) values ($1, '{}')`, [draftId]);
});

afterAll(async () => {
  await db?.close();
});

describe('anon (publishable key, no session)', () => {
  it('reads only published, due articles', async () => {
    const rows = await db.as('anon', null, (q) => q<{ slug: string }>('select slug from public.articles order by slug'));
    expect(rows.map((r) => r.slug)).toEqual(['rice-prices']);
  });

  it('reads authors of published articles only', async () => {
    const rows = await db.as('anon', null, (q) => q<{ article_id: string }>('select article_id from public.article_authors'));
    expect(rows.map((r) => r.article_id)).toEqual([publishedId]);
  });

  it('reads public taxonomy and published pages', async () => {
    const sections = await db.as('anon', null, (q) => q('select slug from public.sections'));
    expect(sections).toHaveLength(1);
    const pages = await db.as('anon', null, (q) => q<{ slug: string }>('select slug from public.pages'));
    expect(pages.map((p) => p.slug)).toEqual(['about']);
  });

  it('reads the published layout but not the draft column', async () => {
    const rows = await db.as('anon', null, (q) => q<{ published: unknown }>(`select published from public.layouts where key = 'home'`));
    expect(rows[0].published).toEqual({ title: 'live' });
    await expect(db.as('anon', null, (q) => q(`select draft from public.layouts where key = 'home'`))).rejects.toThrow(/permission denied/);
  });

  it('cannot read system tables or revisions', async () => {
    await expect(db.as('anon', null, (q) => q('select * from public.app_meta'))).rejects.toThrow(/permission denied/);
    await expect(db.as('anon', null, (q) => q('select * from public.staff'))).rejects.toThrow(/permission denied/);
    await expect(db.as('anon', null, (q) => q('select * from public.article_revisions'))).rejects.toThrow(/permission denied/);
  });

  it('cannot write anything', async () => {
    await expect(db.as('anon', null, (q) => q(`insert into public.sections (name, slug) values ('Hack', 'hack')`))).rejects.toThrow(
      /row-level security/,
    );
    const updated = await db.as('anon', null, (q) => q(`update public.articles set title = 'x' where id = $1 returning id`, [publishedId]));
    expect(updated).toHaveLength(0);
  });
});

describe('authenticated user who is not staff', () => {
  it('sees only public content and cannot write', async () => {
    const rows = await db.as('authenticated', STRANGER, (q) => q<{ slug: string }>('select slug from public.articles order by slug'));
    expect(rows.map((r) => r.slug)).toEqual(['rice-prices']);
    await expect(
      db.as('authenticated', STRANGER, (q) => q(`insert into public.tags (name, slug) values ('x', 'x')`)),
    ).rejects.toThrow(/row-level security/);
    const staff = await db.as('authenticated', STRANGER, (q) => q('select * from public.staff'));
    expect(staff).toHaveLength(0);
  });
});

describe('staff (Newsroom session)', () => {
  it('sees drafts and embargoed articles', async () => {
    const rows = await db.as('authenticated', OWNER, (q) => q<{ id: string }>('select id from public.articles'));
    expect(rows.map((r) => r.id).sort()).toEqual([publishedId, draftId, futureId].sort());
  });

  it('writes content, layouts and revisions', async () => {
    await db.as('authenticated', OWNER, async (q) => {
      await q(`insert into public.tags (name, slug) values ('Food prices', 'food-prices')`);
      const rows = await q(`update public.layouts set draft = '{"title":"next"}' where key = 'home' returning key`);
      expect(rows).toHaveLength(1);
      await q(`insert into public.article_revisions (article_id, snapshot) values ($1, '{}')`, [publishedId]);
    });
  });

  it('reads its own staff row but cannot grant itself more', async () => {
    const rows = await db.as('authenticated', OWNER, (q) => q<{ role: string }>('select role from public.staff'));
    expect(rows).toEqual([{ role: 'owner' }]);
    await expect(db.as('authenticated', OWNER, (q) => q(`insert into public.staff (user_id) values ($1)`, [STRANGER]))).rejects.toThrow(
      /permission denied/,
    );
  });

  it('still cannot read app_meta through the Data API', async () => {
    await expect(db.as('authenticated', OWNER, (q) => q('select * from public.app_meta'))).rejects.toThrow(/permission denied/);
  });
});

describe('service_role (secret key)', () => {
  it('reads and writes system tables', async () => {
    await db.as('service_role', null, async (q) => {
      const rows = await q<{ value: unknown }>(`select value from public.app_meta where key = 'project'`);
      expect(rows[0].value).toBe('presscompass');
      await q(`insert into public.staff (user_id) values ($1)`, [STRANGER]);
    });
  });
});

describe('project marker', () => {
  it('is written by the migrations and is the only app_meta row', async () => {
    const rows = (await db.client.query(`select key, value from public.app_meta order by key`)).rows;
    expect(rows).toEqual([{ key: 'project', value: 'presscompass' }]);
  });
});

describe('constraints', () => {
  it('rejects reserved and malformed slugs', async () => {
    await expect(db.client.query(`insert into public.sections (name, slug) values ('API', 'api')`)).rejects.toThrow(/check constraint/);
    await expect(db.client.query(`insert into public.tags (name, slug) values ('Bad', 'Bad Slug')`)).rejects.toThrow(/check constraint/);
  });

  it('requires a time for scheduled and published articles', async () => {
    await expect(
      db.client.query(`insert into public.articles (slug, status) values ('needs-time', 'scheduled')`),
    ).rejects.toThrow(/scheduled_needs_time/);
  });

  it('builds the English search vector', async () => {
    const rows = (
      await db.client.query(`select slug from public.articles where search @@ websearch_to_tsquery('english', 'rice price')`)
    ).rows;
    expect(rows.map((r) => r.slug)).toContain('rice-prices');
  });
});
