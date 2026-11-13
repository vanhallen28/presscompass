import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type Query, type TestDatabase } from './database';

const OWNER = '11111111-1111-4111-8111-111111111111';

let db: TestDatabase;
const id: Record<string, string> = {};

type Card = { id: string; title: string; section: { slug: string } | null; authors: { name: string }[]; lead: unknown };
type List = { subject: Record<string, unknown> | null; total: number; rows: Card[] } | null;

const ids = (cards: Card[]) => cards.map((card) => card.id);
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

beforeAll(async () => {
  db = await createTestDatabase();
  const q = db.client;
  const one = async (sql: string, params: unknown[]) => (await q.query(sql, params)).rows[0].id as string;
  await q.query(`insert into auth.users (id, email) values ($1, 'owner@example.com')`, [OWNER]);
  await q.query(`insert into public.staff (user_id) values ($1)`, [OWNER]);

  id.lead = await one(`insert into public.media (public_id, format, width, height, bytes, alt, credit) values ('presscompass/images/lead', 'jpg', 1600, 900, 1, 'Rice fields', 'Rani/PressCompass') returning id`, []);
  id.inline = await one(`insert into public.media (public_id, format, width, height, bytes, alt) values ('presscompass/images/inline', 'jpg', 1200, 800, 1, 'A mill') returning id`, []);
  id.photo = await one(`insert into public.media (public_id, format, width, height, bytes, alt) values ('presscompass/images/rani', 'jpg', 800, 800, 1, 'Rani') returning id`, []);

  const section = (name: string, slug: string, position: number, inNav = true) =>
    one(`insert into public.sections (name, slug, position, in_nav) values ($1, $2, $3, $4) returning id`, [name, slug, position, inNav]);
  id.business = await section('Business', 'business', 0);
  id.politics = await section('Politics', 'politics', 1);
  id.hidden = await section('Archive desk', 'archive-desk', 2, false);
  id.empty = await section('Science', 'science', 3);

  id.rani = await one(`insert into public.authors (name, slug, role, photo_media_id) values ('Rani', 'rani', 'Business correspondent', $1) returning id`, [id.photo]);
  id.bima = await one(`insert into public.authors (name, slug, role) values ('Bima', 'bima', 'Political reporter') returning id`, []);
  id.ghost = await one(`insert into public.authors (name, slug) values ('Ghost', 'ghost') returning id`, []);
  id.rice = await one(`insert into public.tags (name, slug) values ('Rice', 'rice') returning id`, []);
  id.inflation = await one(`insert into public.tags (name, slug) values ('Inflation', 'inflation') returning id`, []);
  id.quiet = await one(`insert into public.tags (name, slug) values ('Quiet', 'quiet') returning id`, []);

  const article = (key: string, fields: { title: string; section: string; status?: string; hours?: number; type?: string; body?: unknown; lead?: string; scheduled?: string; text?: string }) =>
    one(
      `insert into public.articles (title, slug, section_id, status, published_at, scheduled_at, type, body, body_text, lead_media_id, standfirst, reading_minutes)
       values ($1, $2, $3, $4::public.article_status, $5, $6, $7::public.article_type, $8, $9, $10, 'Why it matters.', 4) returning id`,
      [
        fields.title,
        key,
        id[fields.section],
        fields.status ?? 'published',
        fields.hours === undefined ? null : hoursAgo(fields.hours),
        fields.scheduled ?? null,
        fields.type ?? 'news',
        JSON.stringify(fields.body ?? { type: 'doc', content: [] }),
        fields.text ?? '',
        fields.lead ?? null,
      ],
    ).then((value) => (id[key] = value));

  await article('d1', { title: 'Rice draft that is secret', section: 'business', status: 'draft', text: 'rice' });
  await article('a2', { title: 'Rice exports pause', section: 'business', hours: 2, text: 'Exports of rice are paused.' });
  await article('a1', {
    title: 'Rice prices fall as the harvest grows',
    section: 'business',
    hours: 1,
    lead: id.lead,
    text: 'Rice is cheaper in the fields.',
    body: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Rice is cheaper in the fields.' }] },
        { type: 'image', attrs: { mediaId: id.inline, caption: 'A mill in Subang.' } },
        { type: 'readMore', attrs: { articleId: id.a2 } },
        { type: 'readMore', attrs: { articleId: id.d1 } },
      ],
    },
  });
  await article('a3', { title: 'The court will matter more than any campaign', section: 'politics', hours: 3, type: 'opinion' });
  await article('a4', { title: 'Five provinces underspend', section: 'politics', hours: 4 });
  await article('a5', { title: 'Small lenders fill the credit gap', section: 'business', hours: 5 });
  await article('a6', { title: 'From the archive', section: 'hidden', hours: 6 });
  await article('a7', { title: 'Nickel smelters face the price of power', section: 'business', hours: 7 });
  await article('s1', { title: 'Scheduled and due but not yet published', section: 'business', status: 'scheduled', scheduled: hoursAgo(1) });
  await article('f1', { title: 'Published in the future', section: 'business', hours: -2 });
  await article('r1', { title: 'Archived story', section: 'business', status: 'archived', hours: 30 });

  const byline = (article: string, author: string, position: number) =>
    q.query(`insert into public.article_authors (article_id, author_id, position) values ($1, $2, $3)`, [id[article], id[author], position]);
  await byline('a1', 'rani', 0);
  await byline('a2', 'bima', 0);
  await byline('a2', 'rani', 1);
  await byline('a3', 'bima', 0);
  await byline('d1', 'ghost', 0);
  const tag = (article: string, tagKey: string) => q.query(`insert into public.article_tags (article_id, tag_id) values ($1, $2)`, [id[article], id[tagKey]]);
  await tag('a1', 'rice');
  await tag('a1', 'inflation');
  await tag('a2', 'rice');
  await tag('d1', 'quiet');
  await q.query(`insert into public.article_related (article_id, related_id, position) values ($1, $2, 0), ($1, $3, 1)`, [id.a1, id.d1, id.a4]);
});

afterAll(async () => {
  await db?.close();
});

const call = async <T>(q: Query, sql: string, params: unknown[] = []) => (await q<{ r: T }>(`select ${sql} as r`, params))[0].r;
const asReader = <T>(fn: (q: Query) => Promise<T>) => db.as('anon', null, fn);

describe('site_home', () => {
  it('shows top stories, a row per navigation section without repeats, and opinion', async () => {
    const home = await asReader((q) =>
      call<{ top: Card[]; sections: { slug: string; articles: Card[] }[]; opinion: Card[] }>(q, 'public.site_home(2, 2, 3)'),
    );
    expect(ids(home.top)).toEqual([id.a1, id.a2]);
    expect(home.sections.map((row) => [row.slug, ids(row.articles)])).toEqual([
      ['business', [id.a5, id.a7]],
      ['politics', [id.a4]],
    ]);
    expect(ids(home.opinion)).toEqual([id.a3]);
  });

  it('builds cards with section, byline in order and lead image', async () => {
    const home = await asReader((q) => call<{ top: Card[] }>(q, 'public.site_home(2)'));
    expect(home.top[0]).toMatchObject({
      title: 'Rice prices fall as the harvest grows',
      slug: 'a1',
      type: 'news',
      section: { name: 'Business', slug: 'business' },
      readingMinutes: 4,
      isBreaking: false,
      authors: [{ name: 'Rani', slug: 'rani', role: 'Business correspondent', photo: { publicId: 'presscompass/images/rani', width: 800 } }],
      lead: { publicId: 'presscompass/images/lead', width: 1600, height: 900, alt: 'Rice fields', credit: 'Rani/PressCompass' },
    });
    expect(home.top[1].authors.map((author) => author.name)).toEqual(['Bima', 'Rani']);
  });
});

describe('site_list', () => {
  const live = () => [id.a1, id.a2, id.a3, id.a4, id.a5, id.a6, id.a7];

  it('never returns drafts, scheduled, future or archived articles, even to staff', async () => {
    const latest = await asReader((q) => call<List>(q, `public.site_list('latest')`));
    expect(latest).toMatchObject({ subject: null, total: 7 });
    expect(ids(latest!.rows)).toEqual(live());
    const staff = await db.as('authenticated', OWNER, (q) => call<List>(q, `public.site_list('latest')`));
    expect(ids(staff!.rows)).toEqual(live());
  });

  it('pages a section and limits latest to a time window', async () => {
    const page2 = await asReader((q) => call<List>(q, `public.site_list('section', 'business', 2, 2)`));
    expect(page2).toMatchObject({ subject: { name: 'Business', slug: 'business', description: '' }, total: 4 });
    expect(ids(page2!.rows)).toEqual([id.a5, id.a7]);
    const recent = await asReader((q) => call<List>(q, `public.site_list('latest', null, 24, 0, $1)`, [hoursAgo(2.5)]));
    expect(ids(recent!.rows)).toEqual([id.a1, id.a2]);
  });

  it('keeps empty sections, but not unknown ones or authors and tags without published articles', async () => {
    await asReader(async (q) => {
      expect(await call<List>(q, `public.site_list('section', 'science')`)).toEqual({
        subject: { name: 'Science', slug: 'science', description: '' },
        total: 0,
        rows: [],
      });
      expect(await call<List>(q, `public.site_list('section', 'nope')`)).toBeNull();
      expect(await call<List>(q, `public.site_list('author', 'ghost')`)).toBeNull();
      expect(await call<List>(q, `public.site_list('tag', 'quiet')`)).toBeNull();
      const rani = await call<List>(q, `public.site_list('author', 'rani')`);
      expect(rani?.subject).toMatchObject({ name: 'Rani', role: 'Business correspondent', photo: { publicId: 'presscompass/images/rani' } });
      expect(ids(rani!.rows)).toEqual([id.a1, id.a2]);
      expect(ids((await call<List>(q, `public.site_list('tag', 'rice')`))!.rows)).toEqual([id.a1, id.a2]);
    });
    await expect(asReader((q) => call(q, `public.site_list('everything')`))).rejects.toThrow('unknown list kind');
  });
});

describe('site_article', () => {
  type Full = Card & {
    body: { content: unknown[] };
    tags: { slug: string }[];
    media: { id: string; alt: string }[];
    links: { id: string; title: string; slug: string; section: string }[];
    related: Card[];
    more: Card[];
    leadCaption: string;
  };

  it('returns the article with tags, body images, Read more links, related and more from the section', async () => {
    const article = await asReader((q) => call<Full>(q, `public.site_article('a1')`));
    expect(article).toMatchObject({ id: id.a1, title: 'Rice prices fall as the harvest grows', leadCaption: '' });
    expect(article.body.content).toHaveLength(4);
    expect(article.tags.map((tag) => tag.slug)).toEqual(['inflation', 'rice']);
    expect(article.media).toEqual([{ id: id.inline, publicId: 'presscompass/images/inline', width: 1200, height: 800, alt: 'A mill', credit: '' }]);
    expect(article.links).toEqual([{ id: id.a2, title: 'Rice exports pause', slug: 'a2', section: 'business' }]);
    // The editor's published pick first, then the article sharing a tag, then the section.
    expect(ids(article.related)).toEqual([id.a4, id.a2, id.a5]);
    expect(ids(article.more)).toEqual([id.a7]);
  });

  it('finds nothing for articles readers cannot see', async () => {
    await asReader(async (q) => {
      for (const slug of ['d1', 's1', 'f1', 'r1', 'missing']) expect(await call(q, `public.site_article($1)`, [slug])).toBeNull();
    });
    expect(await db.as('authenticated', OWNER, (q) => call(q, `public.site_article('d1')`))).toBeNull();
  });
});

describe('site_search', () => {
  it('finds published articles by their words, best match first', async () => {
    await asReader(async (q) => {
      const rice = await call<{ total: number; rows: Card[] }>(q, `public.site_search('rice')`);
      expect(rice.total).toBe(2);
      expect(ids(rice.rows).sort()).toEqual([id.a1, id.a2].sort());
      expect(ids((await call<{ rows: Card[] }>(q, `public.site_search('smelters power')`)).rows)).toEqual([id.a7]);
      expect(await call(q, `public.site_search('')`)).toEqual({ total: 0, rows: [] });
      expect(await call(q, `public.site_search('the')`)).toEqual({ total: 0, rows: [] });
      expect((await call<{ total: number }>(q, `public.site_search('secret')`)).total).toBe(0);
    });
  });
});
