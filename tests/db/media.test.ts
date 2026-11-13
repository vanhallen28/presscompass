import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from './database';

const OWNER = '11111111-1111-4111-8111-111111111111';
const STRANGER = '22222222-2222-4222-8222-222222222222';

let db: TestDatabase;
let lead: string;
let inline: string;
let photo: string;
let unused: string;
let first: string;
let second: string;
let author: string;

const image = (mediaId: string) => ({ type: 'image', attrs: { mediaId, caption: '' } });

beforeAll(async () => {
  db = await createTestDatabase();
  const q = db.client;
  await q.query(`insert into auth.users (id, email) values ($1, 'owner@example.com'), ($2, 'stranger@example.com')`, [OWNER, STRANGER]);
  await q.query(`insert into public.staff (user_id) values ($1)`, [OWNER]);
  const media = async (name: string, alt: string, created: string) =>
    (
      await q.query(
        `insert into public.media (public_id, format, width, height, bytes, alt, original_name, created_at)
         values ($1, 'png', 1600, 900, 1000, $2, $3, $4) returning id`,
        [`presscompass/images/${name}`, alt, `${name}.png`, created],
      )
    ).rows[0].id as string;
  lead = await media('lead', 'Farmers in Karawang', '2026-11-13T01:00:00Z');
  inline = await media('inline', 'A rice warehouse', '2026-11-13T02:00:00Z');
  photo = await media('photo', 'Portrait', '2026-11-13T03:00:00Z');
  unused = await media('unused', '', '2026-11-13T04:00:00Z');
  const section = (await q.query(`insert into public.sections (name, slug) values ('Business', 'business') returning id`)).rows[0].id;
  const body = (blocks: unknown[]) => JSON.stringify({ type: 'doc', content: blocks });
  first = (
    await q.query(
      `insert into public.articles (title, slug, section_id, lead_media_id, body) values ('First', 'first', $1, $2, $3) returning id`,
      [section, lead, body([{ type: 'paragraph' }, image(inline), { type: 'table', content: [] }])],
    )
  ).rows[0].id;
  second = (
    await q.query(`insert into public.articles (title, slug, section_id, body) values ('Second', 'second', $1, $2) returning id`, [
      section,
      body([image(inline), { type: 'blockquote', content: [image(inline)] }, image('not-a-uuid')]),
    ])
  ).rows[0].id;
  author = (await q.query(`insert into public.authors (name, slug, photo_media_id) values ('Rani', 'rani', $1) returning id`, [photo])).rows[0].id;
});

afterAll(async () => {
  await db?.close();
});

describe('media usage', () => {
  it('finds lead images, images in article text and author photos', async () => {
    await db.as('authenticated', OWNER, async (q) => {
      const usage = async (id: string) => (await q<{ u: unknown[] }>(`select public.media_usage($1) as u`, [id]))[0].u;
      expect(await usage(lead)).toEqual([{ kind: 'article', id: first, title: 'First', status: 'draft', role: 'lead' }]);
      expect(await usage(inline)).toEqual([
        { kind: 'article', id: first, title: 'First', status: 'draft', role: 'body' },
        { kind: 'article', id: second, title: 'Second', status: 'draft', role: 'body' },
      ]);
      expect(await usage(photo)).toEqual([{ kind: 'author', id: author, title: 'Rani', status: null, role: 'photo' }]);
      expect(await usage(unused)).toEqual([]);
    });
  });

  it('lists the library newest first with use counts, search and pages', async () => {
    await db.as('authenticated', OWNER, async (q) => {
      const list = async (args = '') =>
        (await q<{ r: { total: number; rows: { id: string; uses: number; alt: string }[] } }>(`select public.newsroom_media(${args}) as r`))[0].r;
      const all = await list();
      expect(all.total).toBe(4);
      expect(all.rows.map((row) => [row.id, row.uses])).toEqual([
        [unused, 0],
        [photo, 1],
        [inline, 2],
        [lead, 1],
      ]);
      expect((await list(`p_query => 'karawang'`)).rows.map((row) => row.id)).toEqual([lead]);
      expect((await list(`p_query => 'inline.png'`)).rows.map((row) => row.id)).toEqual([inline]);
      expect(await list(`p_limit => 2, p_offset => 2`)).toMatchObject({ total: 4, rows: [{ id: inline }, { id: lead }] });
    });
  });

  it('is only for Newsroom staff', async () => {
    await expect(db.as('anon', null, (q) => q(`select public.newsroom_media()`))).rejects.toThrow(/permission denied/);
    await expect(db.as('anon', null, (q) => q(`select public.media_usage($1)`, [lead]))).rejects.toThrow(/permission denied/);
    await expect(db.as('authenticated', STRANGER, (q) => q(`select public.media_usage($1)`, [lead]))).rejects.toThrow('not_staff');
  });
});
