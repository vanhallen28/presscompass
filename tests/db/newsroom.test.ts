import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type Query, type TestDatabase } from './database';

const OWNER = '11111111-1111-4111-8111-111111111111';
const STRANGER = '22222222-2222-4222-8222-222222222222';

let db: TestDatabase;
let business: string;
let politics: string;
let rani: string;
let bima: string;
let economy: string;
let rice: string;

const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Prices rose.' }] }] };

type SaveOptions = {
  authors?: string[] | null;
  tags?: string[] | null;
  related?: string[] | null;
  revision?: string | null;
  throttle?: boolean;
};

async function newArticle(q: Query, slug: string, extra: Record<string, unknown> = {}): Promise<string> {
  const fields: Record<string, unknown> = { title: slug, slug, section_id: business, ...extra };
  const columns = Object.keys(fields);
  const values = Object.values(fields);
  const rows = await q<{ id: string }>(
    `insert into public.articles (${columns.join(', ')}) values (${columns.map((_, i) => `$${i + 1}`).join(', ')}) returning id`,
    values,
  );
  return rows[0].id;
}

async function save(q: Query, id: string, version: number, fields: Record<string, unknown>, options: SaveOptions = {}) {
  const rows = await q<{ r: { version: number; slug: string; status: string } }>(
    `select public.save_article(p_id => $1, p_version => $2, p_fields => $3::jsonb, p_authors => $4::uuid[],
       p_tags => $5::uuid[], p_related => $6::uuid[], p_revision => $7, p_throttle => $8) as r`,
    [id, version, JSON.stringify(fields), options.authors ?? null, options.tags ?? null, options.related ?? null, options.revision ?? null, options.throttle ?? false],
  );
  return rows[0].r;
}

const asOwner = <T>(fn: (q: Query) => Promise<T>) => db.as('authenticated', OWNER, fn);

beforeAll(async () => {
  db = await createTestDatabase();
  const q = db.client;
  await q.query(`insert into auth.users (id, email) values ($1, 'owner@example.com'), ($2, 'stranger@example.com')`, [OWNER, STRANGER]);
  await q.query(`insert into public.staff (user_id) values ($1)`, [OWNER]);
  const one = async (sql: string) => (await q.query(sql)).rows[0].id as string;
  business = await one(`insert into public.sections (name, slug) values ('Business', 'business') returning id`);
  politics = await one(`insert into public.sections (name, slug) values ('Politics', 'politics') returning id`);
  rani = await one(`insert into public.authors (name, slug) values ('Rani Prameswari', 'rani-prameswari') returning id`);
  bima = await one(`insert into public.authors (name, slug) values ('Bima Santoso', 'bima-santoso') returning id`);
  economy = await one(`insert into public.tags (name, slug) values ('Economy', 'economy') returning id`);
  rice = await one(`insert into public.tags (name, slug) values ('Rice', 'rice') returning id`);
});

afterAll(async () => {
  await db?.close();
});

describe('save_article', () => {
  it('saves the fields, bumps the version and replaces authors, tags and related articles in order', async () => {
    await asOwner(async (q) => {
      const id = await newArticle(q, 'draft-one');
      const other = await newArticle(q, 'other-story');
      const result = await save(
        q,
        id,
        1,
        { title: 'Rice prices climb', slug: 'rice-prices-climb', standfirst: 'Why it matters.', body: doc, body_text: 'Prices rose.', word_count: 2, reading_minutes: 1, type: 'analysis', section_id: politics },
        { authors: [bima, rani], tags: [rice, economy], related: [other, id] },
      );
      expect(result).toMatchObject({ version: 2, slug: 'rice-prices-climb', status: 'draft' });
      const [row] = await q(`select title, standfirst, type, section_id, body, word_count, version from public.articles where id = $1`, [id]);
      expect(row).toEqual({ title: 'Rice prices climb', standfirst: 'Why it matters.', type: 'analysis', section_id: politics, body: doc, word_count: 2, version: 2 });
      const authors = await q(`select author_id, position from public.article_authors where article_id = $1 order by position`, [id]);
      expect(authors).toEqual([{ author_id: bima, position: 0 }, { author_id: rani, position: 1 }]);
      const tags = await q<{ tag_id: string }>(`select tag_id from public.article_tags where article_id = $1`, [id]);
      expect(tags.map((t) => t.tag_id).sort()).toEqual([economy, rice].sort());
      const related = await q(`select related_id, position from public.article_related where article_id = $1`, [id]);
      expect(related).toEqual([{ related_id: other, position: 0 }]);

      await save(q, id, 2, { title: 'Rice prices climb again' }, { authors: [rani] });
      const kept = await q(`select author_id from public.article_authors where article_id = $1`, [id]);
      expect(kept).toEqual([{ author_id: rani }]);
      const tagsKept = await q(`select count(*)::int as n from public.article_tags where article_id = $1`, [id]);
      expect(tagsKept[0].n).toBe(2);
    });
  });

  it('refuses a save based on an old version', async () => {
    await asOwner(async (q) => {
      const id = await newArticle(q, 'two-windows');
      await save(q, id, 1, { title: 'First window' });
      await expect(save(q, id, 1, { title: 'Second window' })).rejects.toThrow('version_conflict');
    });
  });

  it('gives an automatic slug a free suffix and refuses a manual slug that is taken', async () => {
    await asOwner(async (q) => {
      await newArticle(q, 'jakarta-floods');
      await newArticle(q, 'jakarta-floods-2');
      const id = await newArticle(q, 'untitled-0a1b2c3d');
      const auto = await save(q, id, 1, { slug: 'jakarta-floods', slug_auto: true });
      expect(auto.slug).toBe('jakarta-floods-3');
      await expect(save(q, id, 2, { slug: 'jakarta-floods', slug_auto: false })).rejects.toThrow('slug_taken');
    });
  });

  it('never renames the slug of an article that has been published', async () => {
    await asOwner(async (q) => {
      await newArticle(q, 'budget-vote');
      const id = await newArticle(q, 'budget-vote-explained', { status: 'published', published_at: '2026-11-01T00:00:00Z' });
      await expect(save(q, id, 1, { slug: 'budget-vote', slug_auto: true })).rejects.toThrow('slug_taken');
    });
  });

  it('keeps a revision for every manual save and at most one autosave revision per 10 minutes', async () => {
    await asOwner(async (q) => {
      const id = await newArticle(q, 'revisions');
      await save(q, id, 1, { title: 'Saved by hand' }, { authors: [rani], revision: 'Saved draft' });
      await save(q, id, 2, { title: 'Autosaved' }, { revision: 'Autosaved', throttle: true });
      await save(q, id, 3, { title: 'Published' }, { revision: 'Published' });
      const rows = await q<{ note: string; snapshot: { title: string; authors: string[] }; created_by: string }>(
        `select note, snapshot, created_by from public.article_revisions where article_id = $1 order by id`,
        [id],
      );
      expect(rows.map((r) => r.note)).toEqual(['Saved draft', 'Published']);
      expect(rows[0].snapshot).toMatchObject({ title: 'Saved by hand', authors: [rani] });
      expect(rows[0].created_by).toBe(OWNER);
    });
  });

  it('keeps only the 50 latest revisions of an article', async () => {
    await asOwner(async (q) => {
      const id = await newArticle(q, 'many-revisions');
      for (let i = 1; i <= 55; i++) await q(`select public.record_revision($1, $2)`, [id, `Save ${i}`]);
      const rows = await q<{ note: string }>(`select note from public.article_revisions where article_id = $1 order by id`, [id]);
      expect(rows).toHaveLength(50);
      expect(rows[0].note).toBe('Save 6');
    });
  });

  it('is refused for signed-in users who are not staff and for anonymous visitors', async () => {
    const id = await asOwner((q) => newArticle(q, 'locked'));
    await expect(db.as('authenticated', STRANGER, (q) => save(q, id, 1, { title: 'x' }))).rejects.toThrow('not_staff');
    await expect(db.as('anon', null, (q) => save(q, id, 1, { title: 'x' }))).rejects.toThrow(/permission denied/);
  });
});

describe('automatic redirects', () => {
  it('redirects the old address of a published article, keeps chains one hop long, and drops a redirect when the address comes back', async () => {
    await asOwner(async (q) => {
      const id = await newArticle(q, 'port-strike', { status: 'published', published_at: '2026-11-01T00:00:00Z' });
      await save(q, id, 1, { slug: 'port-strike-ends' });
      await save(q, id, 2, { section_id: politics });
      const redirects = () => q(`select from_path, to_path, code, auto from public.redirects order by from_path`);
      expect(await redirects()).toEqual([
        { from_path: '/business/port-strike', to_path: '/politics/port-strike-ends', code: 308, auto: true },
        { from_path: '/business/port-strike-ends', to_path: '/politics/port-strike-ends', code: 308, auto: true },
      ]);
      await save(q, id, 3, { slug: 'port-strike', section_id: business });
      expect(await redirects()).toEqual([
        { from_path: '/business/port-strike-ends', to_path: '/business/port-strike', code: 308, auto: true },
        { from_path: '/politics/port-strike-ends', to_path: '/business/port-strike', code: 308, auto: true },
      ]);
    });
  });

  it('adds no redirect while an article has never been published', async () => {
    await asOwner(async (q) => {
      const id = await newArticle(q, 'quiet-draft');
      await save(q, id, 1, { slug: 'quiet-draft-renamed' });
      expect(await q(`select * from public.redirects`)).toEqual([]);
    });
  });

  it('redirects a renamed section and the published articles in it', async () => {
    await asOwner(async (q) => {
      await newArticle(q, 'nickel-exports', { status: 'published', published_at: '2026-11-01T00:00:00Z' });
      await newArticle(q, 'unpublished-idea');
      await q(`update public.sections set slug = 'economy' where id = $1`, [business]);
      const rows = await q(`select from_path, to_path from public.redirects order by from_path`);
      expect(rows).toEqual([
        { from_path: '/business', to_path: '/economy' },
        { from_path: '/business/nickel-exports', to_path: '/economy/nickel-exports' },
      ]);
    });
  });

  it('redirects a renamed tag or author only once they have published articles', async () => {
    await asOwner(async (q) => {
      await q(`update public.tags set slug = 'rice-trade' where id = $1`, [rice]);
      expect(await q(`select * from public.redirects`)).toEqual([]);
      const id = await newArticle(q, 'tagged-story', { status: 'published', published_at: '2026-11-01T00:00:00Z' });
      await q(`insert into public.article_tags (article_id, tag_id) values ($1, $2)`, [id, economy]);
      await q(`insert into public.article_authors (article_id, author_id) values ($1, $2)`, [id, rani]);
      await q(`update public.tags set slug = 'indonesian-economy' where id = $1`, [economy]);
      await q(`update public.authors set slug = 'rani-p' where id = $1`, [rani]);
      const rows = await q(`select from_path, to_path from public.redirects order by from_path`);
      expect(rows).toEqual([
        { from_path: '/author/rani-prameswari', to_path: '/author/rani-p' },
        { from_path: '/tag/economy', to_path: '/tag/indonesian-economy' },
      ]);
    });
  });
});

describe('status changes', () => {
  it('publishes scheduled articles when their time has come', async () => {
    await asOwner(async (q) => {
      const due = await newArticle(q, 'due-story', { status: 'scheduled', scheduled_at: '2026-01-01T06:00:00Z' });
      const later = await newArticle(q, 'later-story', { status: 'scheduled', scheduled_at: '2999-01-01T06:00:00Z' });
      const [{ n }] = await q<{ n: number }>(`select public.publish_due_articles() as n`);
      expect(n).toBe(1);
      const rows = await q(`select id, status, published_at from public.articles where id in ($1, $2) order by slug`, [due, later]);
      expect(rows).toEqual([
        { id: due, status: 'published', published_at: new Date('2026-01-01T06:00:00Z') },
        { id: later, status: 'scheduled', published_at: null },
      ]);
    });
  });

  it('moves several articles at once and records why', async () => {
    await asOwner(async (q) => {
      const draft = await newArticle(q, 'bulk-draft');
      const live = await newArticle(q, 'bulk-live', { status: 'published', published_at: '2026-10-01T00:00:00Z' });
      const [{ n }] = await q<{ n: number }>(`select public.set_article_status($1::uuid[], 'publish') as n`, [[draft, live]]);
      expect(n).toBe(1);
      const [row] = await q<{ status: string; published_at: Date }>(`select status, published_at from public.articles where id = $1`, [draft]);
      expect(row.status).toBe('published');
      expect(row.published_at).toBeInstanceOf(Date);
      await q(`select public.set_article_status($1::uuid[], 'unpublish')`, [[draft, live]]);
      await q(`select public.set_article_status($1::uuid[], 'archive')`, [[live]]);
      const statuses = await q(`select slug, status from public.articles where id in ($1, $2) order by slug`, [draft, live]);
      expect(statuses).toEqual([
        { slug: 'bulk-draft', status: 'draft' },
        { slug: 'bulk-live', status: 'archived' },
      ]);
      const notes = await q<{ note: string }>(`select note from public.article_revisions where article_id = $1 order by id`, [draft]);
      expect(notes.map((r) => r.note)).toEqual(['Published', 'Unpublished']);
      await expect(q(`select public.set_article_status($1::uuid[], 'explode')`, [[draft]])).rejects.toThrow('unknown_action');
    });
  });
});

describe('Newsroom reads', () => {
  it('lists articles with section and authors, filters them and counts the total', async () => {
    await asOwner(async (q) => {
      const a = await newArticle(q, 'list-rice-harvest');
      const b = await newArticle(q, 'list-court-ruling', { section_id: politics, status: 'review' });
      await save(q, a, 1, { title: 'Rice harvest 100% done' }, { authors: [rani] });
      await save(q, b, 1, { title: 'Court ruling' }, { authors: [bima] });
      const list = async (args: string, params: unknown[] = []) =>
        (await q<{ r: { total: number; rows: { slug: string; section: { name: string } | null; authors: string[] }[] } }>(`select public.newsroom_articles(${args}) as r`, params))[0].r;

      const all = await list(`p_query => 'list-'`);
      expect(all.total).toBe(2);
      expect(all.rows.map((r) => r.slug)).toEqual(['list-court-ruling', 'list-rice-harvest']);
      expect(all.rows[1]).toMatchObject({ section: { name: 'Business' }, authors: ['Rani Prameswari'] });

      expect((await list(`p_query => 'list-', p_status => 'review'`)).rows.map((r) => r.slug)).toEqual(['list-court-ruling']);
      expect((await list(`p_query => 'list-', p_section => $1`, [business])).rows.map((r) => r.slug)).toEqual(['list-rice-harvest']);
      expect((await list(`p_query => 'list-', p_author => $1`, [bima])).rows.map((r) => r.slug)).toEqual(['list-court-ruling']);
      expect((await list(`p_query => 'Santoso'`)).rows.map((r) => r.slug)).toEqual(['list-court-ruling']);
      expect((await list(`p_query => '100%'`)).total).toBe(1);
      expect((await list(`p_query => '%'`)).rows.map((r) => r.slug)).toEqual(['list-rice-harvest']);
      expect((await list(`p_query => 'list_'`)).total).toBe(0);
      const page = await list(`p_query => 'list-', p_limit => 1, p_offset => 1`);
      expect(page).toMatchObject({ total: 2, rows: [{ slug: 'list-rice-harvest' }] });
    });
  });

  it('counts articles by status, by section, tag and author, and for the dashboard', async () => {
    await asOwner(async (q) => {
      await newArticle(q, 'count-draft');
      const live = await newArticle(q, 'count-live', { status: 'published', published_at: '2026-11-13T02:00:00Z' });
      await newArticle(q, 'count-scheduled', { status: 'scheduled', scheduled_at: '2999-01-01T00:00:00Z' });
      await q(`insert into public.article_tags (article_id, tag_id) values ($1, $2)`, [live, rice]);
      await q(`insert into public.article_authors (article_id, author_id) values ($1, $2)`, [live, bima]);

      const [{ counts }] = await q(`select public.article_status_counts() as counts`);
      expect(counts).toEqual({ draft: 1, published: 1, scheduled: 1 });

      const [{ usage }] = await q<{ usage: Record<string, Record<string, number>> }>(`select public.newsroom_usage() as usage`);
      expect(usage.sections[business]).toBe(3);
      expect(usage.tags[rice]).toBe(1);
      expect(usage.authors[bima]).toBe(1);
      expect(usage.authors[rani]).toBeUndefined();

      const [{ d }] = await q(`select public.newsroom_dashboard('2026-11-12T17:00:00Z') as d`);
      expect(d).toEqual({ published_today: 1, review: 0, scheduled: 1, drafts: 1, next_scheduled_at: '2999-01-01T00:00:00+00:00' });
    });
  });

  it('keeps every Newsroom function away from anonymous visitors and non-staff', async () => {
    for (const call of ['public.newsroom_articles()', 'public.article_status_counts()', 'public.newsroom_usage()', 'public.publish_due_articles()']) {
      await expect(db.as('anon', null, (q) => q(`select ${call}`))).rejects.toThrow(/permission denied/);
    }
    await expect(db.as('authenticated', STRANGER, (q) => q(`select public.newsroom_articles()`))).rejects.toThrow('not_staff');
  });
});
