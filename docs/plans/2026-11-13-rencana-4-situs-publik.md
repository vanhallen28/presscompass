# Rencana 4 · Situs publik (v0.4.0)

> **Untuk agen:** jalankan task demi task (skill executing-plans), TDD, commit per task. Kode akhir ada di lampiran di bawah (dibuat dari repo setelah eksekusi).

**Tujuan:** pembaca bisa membuka presscompass.site dan melihat artikel yang terbit dari Newsroom, dengan tata letak yang dikunci di preview: beranda, artikel, rubrik, penulis, tag, cari, 404, header dengan navigasi rubrik dan pita Latest, footer, mode gelap. Artikel terjadwal terbit sendiri lewat endpoint cron, dan setiap perubahan di Newsroom langsung tampil di situs.

**Arsitektur:**
- Situs membaca Supabase dengan publishable key (peran `anon`). Semua bacaan lewat fungsi SQL `site_*` (security invoker, jadi RLS tetap berlaku) yang mengembalikan JSON siap render; fungsi juga menyaring sendiri `status = 'published' and published_at <= now()`, jadi hasilnya sama untuk siapa pun yang memanggil.
- Fungsi baca dibungkus `'use cache'` + `cacheLife('hours')` + `cacheTag`. Tag: `site` (semua), `articles` (daftar, pencarian artikel per slug, redirect), `article:{id}`, `taxonomy` (rubrik, penulis, tag, navigasi).
- Newsroom membuang tag dengan `updateTag` di Server Action (artikel terbit, simpan artikel yang sudah terbit, status, rubrik/tag/penulis, media). Endpoint cron dan revalidasi memakai `revalidateTag(tag, { expire: 0 })`.
- Rute dinamis memakai `generateStaticParams` (contoh dari database saat build, atau placeholder bila kosong) supaya `params` bisa ditunggu di atas: status 404 dan redirect 308 sungguhan, bukan 200.
- Header (dengan rubrik aktif) dirender per halaman, jadi navigasi tidak butuh JavaScript. JavaScript klien hanya untuk sakelar tema dan tombol salin/bagikan tautan. Menu HP memakai atribut `popover` (tanpa JavaScript), cari memakai form GET biasa.
- Blok **Chart** di editor: data ditempel sebagai tabel (dari spreadsheet), disimpan sebagai label + seri, digambar SVG oleh server, dengan tabel tersembunyi untuk pembaca layar.
- `GET /api/cron/run` (Bearer `CRON_SECRET`) menerbitkan artikel yang jatuh tempo lalu membuang tag. Vercel Cron sekali sehari (`0 23 * * *`, sekitar 06.00 WIB); Supabase Cron setiap 5 menit dipasang pemilik dari panduan (langkah F).

**Stack:** tanpa dependensi baru.

## Batasan global

- Semua batasan Rencana 1 sampai 3 tetap berlaku (bahasa Inggris untuk pembaca, tanpa Docker, RLS, token desain, `CloudImage`).
- Tata letak mengikuti preview yang dikunci (`presscompass-preview.html`): baris utilitas dengan tanggal, masthead dengan logo di tengah, navigasi rubrik dengan garis merah untuk rubrik aktif, pita Latest, kartu berita, rail Top stories, halaman artikel 680 px + rail 300 px, footer navy (gelap: `paper-sunken`).
- Format: `12 Nov 2026`, `19:50 WIB`, `6 min read`; tanggal baris utilitas `Friday, 13 November 2026` (WIB).
- Situs tetap `noindex` sampai rilis (Rencana 8).
- Anggaran JS milik PressCompass di situs < 15 KB.

## Keputusan rencana

| Topik | Keputusan |
|---|---|
| Bentuk data | Fungsi SQL `site_home`, `site_list`, `site_article`, `site_search` (JSON). Supabase tiruan tidak mendukung embedding PostgREST, dan satu panggilan per halaman lebih cepat. |
| Cache | `cacheLife('hours')` di semua fungsi baca; perubahan dari Newsroom membuang tag seketika. Pita Latest dan tanggal di header ikut kedaluwarsa paling lama 1 jam. |
| Build | Prerender saat build membaca Supabase. Bila Supabase dijeda atau tidak terjangkau, build Vercel gagal dan deploy lama tetap tayang. |
| Halaman statis, Most read, Newsletter, data band, teks footer yang bisa diedit | Pindah ke Rencana 5 (page builder, penyusun beranda, newsletter) dan Rencana 7 (Most read dari Search Console). Kolom footer yang belum punya isi tidak ditampilkan. |
| Beranda v0.4.0 | Otomatis: lead + 4 Top stories (terbaru), baris per rubrik di navigasi (4 artikel, tanpa yang sudah tampil), baris Opinion (jenis opinion). |
| Penulis dan tag | Halaman hanya ada bila punya artikel terbit (selain itu 404). Rubrik selalu ada. |
| URL artikel | `/{rubrik}/{slug}`; slug unik global. Rubrik di URL salah → 308 ke URL benar. Tidak ditemukan → cek `redirects` (301/308 → 308, 410 → 404 sampai Rencana 6). |
| Pratinjau Newsroom | Memakai komponen artikel yang sama dengan situs (`ArticleView`), jadi pratinjau = tampilan asli. |
| Cron | Endpoint sekarang; Supabase Cron 5 menit dipindah dari Rencana 7 ke panduan pemilik sekarang, karena terbit terjadwal butuh itu. |
| `/api/revalidate` | POST bertanda `CRON_SECRET` dengan daftar tag. Dipakai tes E2E (data ditanam lewat SQL) dan sebagai jalan darurat. |
| Chart | Bar (1 atau 2 seri) atau garis (1 sampai 3 seri), 2 sampai 24 label. Bar satu seri menyorot nilai terakhir (seperti preview). |

## Task

### Task 1: Fungsi SQL situs
- Migrasi `20261116000100_public_site.sql`: `site_image`, `site_card`, `site_list(kind, slug, limit, offset, since)`, `site_home()`, `site_article(slug)`, `site_search(query, limit, offset)`; hak `anon`, `authenticated`, `service_role`.
- Tes database: draf, terjadwal, dan masa depan tidak pernah muncul (juga untuk staf); urutan; halaman; penulis/tag tanpa artikel terbit null; terkait (pilihan editor dulu, lalu otomatis); Read more hanya ke artikel terbit; pencarian berperingkat.

### Task 2: Modul situs dan blok Chart (murni)
- `src/modules/site/`: tipe, `kicker()`, `byline()`, `articleHref()`, format tanggal header, tag cache.
- `src/lib/doc/chart.ts`: `parseChartTable`, `chartTable`, `chartScale`, sanitasi blok `chart`. Tes unit.

### Task 3: Kerangka situs dan halaman
- Grup rute `(site)`: header (utilitas, masthead, menu popover, navigasi, pita Latest), footer (sakelar tema), skrip tema sebelum paint di root layout.
- Beranda, artikel (`ArticleView`, rail Related, More from), rubrik + `/page/{n}`, penulis, tag, cari, 404 global.
- `ChartFigure` (SVG) di `ArticleBody`; dialog Chart di editor; pratinjau Newsroom memakai `ArticleView`.

### Task 4: Revalidasi dan cron
- `src/modules/site/invalidate.ts` dipanggil dari aksi editor, rubrik/tag/penulis, media.
- `GET /api/cron/run`, `POST /api/revalidate`, `vercel.json`.

### Task 5: Verifikasi dan kiriman
- E2E situs publik (termasuk status 404, 308, cron, tema, Chart, axe terang/gelap, HP), cek visual, dokumen (langkah F: `CRON_SECRET` dan Supabase Cron), CHANGELOG, versi 0.4.0, zip.


## Hasil eksekusi (13 November 2026)

- Semua task selesai. Type check dan lint bersih; Vitest unit 90, database 43; Playwright 61 lulus (21 dilewati sengaja: alur editor dan salin tautan hanya desktop, cek tata letak HP hanya mobile); build produksi berhasil, juga build CI terhadap Supabase tiruan yang kosong. Spesifikasi situs dan editor diulang 2 kali tanpa gagal.
- Cek visual terang, gelap, dan HP (412 px): beranda, artikel (dengan pull quote, gambar, key figures, Chart garis dan batang, catatan editor), rubrik, penulis, tag, cari, 404, menu.
- Temuan saat eksekusi:
  - **Fetch cache Next.js:** permintaan Supabase di dalam `'use cache'` ikut tersimpan di fetch cache tanpa tag (bahkan POST RPC), jadi membuang tag menjalankan ulang fungsi tetapi mendapat jawaban lama. `createPublicClient` kini memakai `cache: 'no-store'`.
  - **`updateTag` merender ulang halaman Newsroom** dalam jawaban Server Action, sehingga editor (dengan `key` versi) terpasang ulang dan notifikasi hilang. Newsroom kini memakai `revalidateTag(tag, { expire: 1 })`: tanpa render ulang, dan permintaan pembaca setelah satu detik menunggu data baru.
  - **Alamat di luar `generateStaticParams`:** tanpa `instant = false` Next.js menolak merender (`blocking-prerender-dynamic`). Dengan `instant = false`, kunjungan pertama ke alamat yang tidak ada mendapat 200 + `noindex` (redirect dikirim di dalam halaman), kunjungan berikutnya dari cache mendapat 404/308 sungguhan. Dicatat di spesifikasi §4 untuk Rencana 6.
  - **Build membaca Supabase** (prerender). Job `check` di CI kini menyalakan Supabase tiruan sebelum `npm run build`.
  - Judul rubrik yang panjang membuat baris judul seksi meluap di HP; judul dan tautan "More …" kini boleh turun baris.
- Supabase Cron 5 menit dan `CRON_SECRET` ada di `docs/ops/setup.md` langkah F (tidak bisa diuji dari sesi ini; endpoint diuji E2E).

## Lampiran: kode akhir

File yang dibuat atau diubah sejak v0.3.0 (tanpa `package-lock.json` dan dokumen Markdown).

### `.env.example`

```bash
# Copy this file to .env and fill in the values from the presscompass Supabase project
# (Project Settings, API Keys). The same project serves production, Vercel Preview and this computer.
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_replace_me
SUPABASE_SECRET_KEY=sb_secret_replace_me

# Cloudinary (images). From the Cloudinary console: Settings, API Keys. Cloud name is public (it is in image
# addresses); the API key and secret stay on the server. Without them the Newsroom runs but cannot upload.
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=replace_me
CLOUDINARY_API_SECRET=replace_me

# Scheduled work (/api/cron/run) and cache refresh (/api/revalidate). At least 32 characters, e.g. the output of
# `openssl rand -hex 32`. Needed on Vercel (docs/ops/setup.md, step F); optional on this computer.
CRON_SECRET=
```

### `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  check:
    name: Type check, lint, unit, database, build
    runs-on: ubuntu-24.04
    timeout-minutes: 20
    env:
      TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres
      NEXT_PUBLIC_SUPABASE_URL: http://127.0.0.1:3101
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: sb_publishable_ci
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
      - name: Start the runner's PostgreSQL (no Docker)
        run: bash scripts/ci-postgres.sh
      - run: npm run test:db
      - name: Build (prerendering reads the database, so against the fake Supabase)
        run: |
          FAKE_SUPABASE_PORT=3101 FAKE_DATABASE_NAME=presscompass_build node tests/fake-supabase/server.mjs &
          for i in $(seq 1 30); do curl -s -o /dev/null http://127.0.0.1:3101/ && break; sleep 1; done
          npm run build

  e2e:
    name: End-to-end (Playwright)
    runs-on: ubuntu-24.04
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - name: Start the runner's PostgreSQL for the fake Supabase (no Docker)
        run: bash scripts/ci-postgres.sh
      - run: npm run test:e2e
        env:
          CI: '1'
      - name: Keep the report when tests fail
        if: failure()
        uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2
        with:
          name: playwright-report
          path: |
            playwright-report/
            test-results/
          retention-days: 14
```

### `package.json`

```json
{
  "name": "presscompass",
  "version": "0.4.0",
  "private": true,
  "engines": {
    "node": "26.x"
  },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --project unit",
    "test:db": "vitest run --project db",
    "test:e2e": "playwright test",
    "tokens": "node scripts/tokens.mjs",
    "db:login": "npx -y supabase@3.1.0 login",
    "db:link": "npx -y supabase@3.1.0 link",
    "db:push": "npx -y supabase@3.1.0 db push --remote",
    "fake:supabase": "node tests/fake-supabase/server.mjs",
    "staff:grant": "node --env-file=.env scripts/grant-staff.mjs"
  },
  "dependencies": {
    "@supabase/ssr": "0.12.7",
    "@supabase/supabase-js": "2.119.0",
    "@tiptap/core": "3.32.3",
    "@tiptap/extension-blockquote": "3.32.3",
    "@tiptap/extension-list": "3.32.3",
    "@tiptap/extension-table": "3.32.3",
    "@tiptap/extensions": "3.32.3",
    "@tiptap/pm": "3.32.3",
    "@tiptap/react": "3.32.3",
    "@tiptap/starter-kit": "3.32.3",
    "next": "16.4.6",
    "react": "19.3.0",
    "react-dom": "19.3.0",
    "server-only": "0.0.1"
  },
  "devDependencies": {
    "@axe-core/playwright": "4.14.0",
    "@playwright/test": "1.65.0",
    "@types/node": "26.6.6",
    "@types/pg": "8.23.1",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "eslint": "9.39.5",
    "eslint-config-next": "16.4.6",
    "pg": "8.23.1",
    "typescript": "5.9.3",
    "vitest": "5.1.0"
  }
}
```

### `playwright.config.ts`

```ts
import { defineConfig, devices } from '@playwright/test';

// E2E runs against a production build and a fake Supabase (tests/fake-supabase/server.mjs): fake Auth
// plus a Data API that runs real SQL on a fresh local PostgreSQL database, so no Supabase project is needed.
const PORT = 3100;
const MOCK_SUPABASE_PORT = 3101;
const E2E_ENV = {
  NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${MOCK_SUPABASE_PORT}`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_e2e',
  // The fake Supabase treats any sb_secret_ key as service_role (the cron endpoint needs it).
  SUPABASE_SECRET_KEY: 'sb_secret_e2e',
  // The fake Supabase also plays Cloudinary (tests/fake-supabase/cloudinary.mjs): signed uploads, Admin API, delivery.
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: 'demo',
  NEXT_PUBLIC_CLOUDINARY_DELIVERY_URL: `http://127.0.0.1:${MOCK_SUPABASE_PORT}/fake-cloudinary`,
  CLOUDINARY_API_URL: `http://127.0.0.1:${MOCK_SUPABASE_PORT}/fake-cloudinary`,
  CLOUDINARY_API_KEY: 'fake-key',
  CLOUDINARY_API_SECRET: 'fake-secret',
  // Lets the tests call /api/cron/run and /api/revalidate (data seeded with SQL bypasses the Newsroom).
  CRON_SECRET: 'e2e-cron-secret-that-is-long-enough-1234',
};

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    // Locally you may point at an installed Chrome: PW_CHROME_PATH=/usr/bin/google-chrome
    launchOptions: process.env.PW_CHROME_PATH ? { executablePath: process.env.PW_CHROME_PATH } : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'node tests/fake-supabase/server.mjs',
      port: MOCK_SUPABASE_PORT,
      reuseExistingServer: false,
      env: { FAKE_SUPABASE_PORT: String(MOCK_SUPABASE_PORT), FAKE_DATABASE_NAME: 'presscompass_e2e' },
    },
    {
      command: `npm run build && npm run start -- --port ${PORT}`,
      url: `http://localhost:${PORT}`,
      timeout: 240_000,
      reuseExistingServer: !process.env.CI,
      env: E2E_ENV,
    },
  ],
});
```

### `src/app/(site)/[section]/[slug]/page.tsx`

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { permanentRedirect } from 'next/navigation';
import { Icon } from '@/components/ds/Icon';
import { ArticleView } from '@/components/site/ArticleView';
import { ShareButtons } from '@/components/site/ShareButtons';
import { SitePage } from '@/components/site/SitePage';
import { CardStory, TopStory } from '@/components/site/Stories';
import styles from '@/components/site/site.module.css';
import { sanitizeDoc } from '@/lib/doc/sanitize';
import { articleHref } from '@/modules/site/format';
import { missing } from '@/modules/site/missing';
import { recentArticleParams } from '@/modules/site/params';
import { getArticle } from '@/modules/site/queries';

// Addresses missing from generateStaticParams render on their first visit, then come from the cache.
// The page needs its params to render at all (it is a 404 or a redirect without them), so it may block.
export const instant = false;

type Props = { params: Promise<{ section: string; slug: string }> };

export function generateStaticParams() {
  return recentArticleParams();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  return article ? { title: article.title, description: article.standfirst || undefined } : {};
}

export default async function ArticlePage({ params }: Props) {
  const { section, slug } = await params;
  const article = await getArticle(slug);
  if (!article) return missing(`/${section}/${slug}`);
  // One address per article: a section in the address that is not the article's own moves to the right one.
  if (article.section?.slug !== section) permanentRedirect(articleHref(article));

  const links = new Map(article.links.map((link) => [link.id, { title: link.title, href: articleHref(link) }]));
  const media = new Map(article.media.map((item) => [item.id, item]));
  const page = `article-${article.id}`;

  return (
    <SitePage page={page} active={section}>
      <div className={styles.wrap}>
        <ArticleView
          id={`article-${article.id}`}
          linked
          article={{ ...article, body: sanitizeDoc(article.body), links, media }}
          actions={<ShareButtons title={article.title} />}
          rail={
            article.related.length > 0 && (
              <div>
                <h2 className={styles.railTitle}>Related</h2>
                <ul className={styles.toplist}>
                  {article.related.map((card) => (
                    <li key={card.id}>
                      <TopStory card={card} />
                    </li>
                  ))}
                </ul>
              </div>
            )
          }
        />
        {article.more.length > 0 && article.section && (
          <section className={styles.sec} aria-label={`More from ${article.section.name}`}>
            <div className={styles.secHead}>
              <h2 className={styles.h2}>More from {article.section.name}</h2>
              <Link className={styles.more} href={`/${article.section.slug}`}>
                More {article.section.name.toLowerCase()} <Icon name="arrow-right" size={16} />
              </Link>
            </div>
            <div className={styles.cards3}>
              {article.more.map((card) => (
                <CardStory key={card.id} card={card} standfirst hideSection />
              ))}
            </div>
          </section>
        )}
      </div>
    </SitePage>
  );
}
```

### `src/app/(site)/[section]/page.tsx`

```tsx
import type { Metadata } from 'next';
import { ListView } from '@/components/site/ListView';
import { sectionParams } from '@/modules/site/params';
import { getList } from '@/modules/site/queries';

// Addresses missing from generateStaticParams render on their first visit, then come from the cache.
// The page needs its params to render at all (it is a 404 or a redirect without them), so it may block.
export const instant = false;

type Props = { params: Promise<{ section: string }> };

export function generateStaticParams() {
  return sectionParams();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section } = await params;
  const list = await getList('section', section);
  return list?.subject ? { title: list.subject.name, description: list.subject.description || undefined } : {};
}

export default async function SectionPage({ params }: Props) {
  const { section } = await params;
  return <ListView kind="section" slug={section} page={1} />;
}
```

### `src/app/(site)/[section]/page/[n]/page.tsx`

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ListView } from '@/components/site/ListView';
import { pageNumber } from '@/modules/site/format';
import { sectionParams } from '@/modules/site/params';
import { getList } from '@/modules/site/queries';

// Addresses missing from generateStaticParams render on their first visit, then come from the cache.
// The page needs its params to render at all (it is a 404 or a redirect without them), so it may block.
export const instant = false;

type Props = { params: Promise<{ section: string; n: string }> };

export async function generateStaticParams() {
  return (await sectionParams()).map((params) => ({ ...params, n: '2' }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section, n } = await params;
  const list = await getList('section', section);
  return list?.subject ? { title: `${list.subject.name}, page ${n}` } : {};
}

export default async function SectionPageN({ params }: Props) {
  const { section, n } = await params;
  const page = pageNumber(n);
  if (!page) notFound();
  return <ListView kind="section" slug={section} page={page} />;
}
```

### `src/app/(site)/author/[slug]/page.tsx`

```tsx
import type { Metadata } from 'next';
import { ListView } from '@/components/site/ListView';
import { PLACEHOLDER } from '@/modules/site/params';
import { getList } from '@/modules/site/queries';

// Addresses missing from generateStaticParams render on their first visit, then come from the cache.
// The page needs its params to render at all (it is a 404 or a redirect without them), so it may block.
export const instant = false;

type Props = { params: Promise<{ slug: string }> };

// One sample is enough (see src/modules/site/params.ts); every other author page renders on first visit.
export function generateStaticParams() {
  return [{ slug: PLACEHOLDER }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const list = await getList('author', slug);
  return list?.subject ? { title: list.subject.name } : {};
}

export default async function AuthorPage({ params }: Props) {
  const { slug } = await params;
  return <ListView kind="author" slug={slug} page={1} />;
}
```

### `src/app/(site)/author/[slug]/page/[n]/page.tsx`

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ListView } from '@/components/site/ListView';
import { pageNumber } from '@/modules/site/format';
import { PLACEHOLDER } from '@/modules/site/params';
import { getList } from '@/modules/site/queries';

// Addresses missing from generateStaticParams render on their first visit, then come from the cache.
// The page needs its params to render at all (it is a 404 or a redirect without them), so it may block.
export const instant = false;

type Props = { params: Promise<{ slug: string; n: string }> };

export function generateStaticParams() {
  return [{ slug: PLACEHOLDER, n: '2' }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, n } = await params;
  const list = await getList('author', slug);
  return list?.subject ? { title: `${list.subject.name}, page ${n}` } : {};
}

export default async function AuthorPageN({ params }: Props) {
  const { slug, n } = await params;
  const page = pageNumber(n);
  if (!page) notFound();
  return <ListView kind="author" slug={slug} page={page} />;
}
```

### `src/app/(site)/page.tsx`

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/ds/Icon';
import { SitePage } from '@/components/site/SitePage';
import { CardStory, LeadStory, OpinionStory, TopStory } from '@/components/site/Stories';
import styles from '@/components/site/site.module.css';
import { getHome } from '@/modules/site/queries';

export const metadata: Metadata = {
  title: { absolute: 'PressCompass · News with a sense of direction' },
  description: 'Independent, English-language news about Indonesia. Facts verified, context explained.',
};

// The front page (v0.4.0 fills it automatically; the homepage builder arrives in Plan 5).
export default async function HomePage() {
  const home = await getHome();
  const [lead, ...top] = home.top;

  return (
    <SitePage page="home">
      <div className={styles.wrap}>
        {lead ? (
          <section className={styles.leadGrid} aria-label="Top stories">
            <LeadStory card={lead} />
            {top.length > 0 && (
              <div className={styles.railTop}>
                <h2 className={styles.railTitle}>Top stories</h2>
                <ul className={styles.toplist}>
                  {top.map((card) => (
                    <li key={card.id}>
                      <TopStory card={card} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        ) : (
          <div className={styles.empty}>
            <h1 className={styles.h1}>News with a sense of direction.</h1>
            <p>Independent, English-language news about Indonesia. The first stories are on their way.</p>
          </div>
        )}

        {home.sections.map((section) => (
          <section key={section.slug} className={styles.sec} aria-label={section.name}>
            <div className={styles.secHead}>
              <h2 className={styles.h2}>
                <Link href={`/${section.slug}`} className={styles.secLink}>
                  {section.name}
                </Link>
              </h2>
              <Link className={styles.more} href={`/${section.slug}`}>
                More {section.name.toLowerCase()} <Icon name="arrow-right" size={16} />
              </Link>
            </div>
            <div className={styles.cards4}>
              {section.articles.map((card) => (
                <CardStory key={card.id} card={card} hideSection />
              ))}
            </div>
          </section>
        ))}

        {home.opinion.length > 0 && (
          <section className={styles.sec} aria-label="Opinion">
            <div className={styles.secHead}>
              <h2 className={styles.h2}>Opinion</h2>
            </div>
            <div className={styles.ops}>
              {home.opinion.map((card) => (
                <OpinionStory key={card.id} card={card} />
              ))}
            </div>
          </section>
        )}
      </div>
    </SitePage>
  );
}
```

### `src/app/(site)/search/page.tsx`

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { SearchForm } from '@/components/site/SearchForm';
import { SitePage } from '@/components/site/SitePage';
import { RowStory } from '@/components/site/Stories';
import styles from '@/components/site/site.module.css';
import { search } from '@/modules/site/queries';

export const metadata: Metadata = { title: 'Search', robots: { index: false, follow: true } };

const SIZE = 20;

type Props = { searchParams: Promise<{ q?: string | string[]; page?: string | string[] }> };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? '';

async function Results({ searchParams }: Props) {
  const params = await searchParams;
  const query = first(params.q).trim().slice(0, 200);
  const page = Math.max(1, Math.min(500, Number.parseInt(first(params.page), 10) || 1));
  const results = query ? await search(query, page, SIZE) : null;
  const pages = results ? Math.ceil(results.total / SIZE) : 0;
  const href = (n: number) => `/search?${new URLSearchParams({ q: query, ...(n > 1 ? { page: String(n) } : {}) })}`;

  return (
    <>
      <SearchForm query={query} />
      {results && (
        <p className={styles.count} role="status">
          {results.total === 0
            ? `Nothing found for “${query}”. Try fewer or different words.`
            : `${results.total.toLocaleString('en-GB')} ${results.total === 1 ? 'result' : 'results'} for “${query}”`}
        </p>
      )}
      {results && results.rows.length > 0 && (
        <ul className={styles.rows}>
          {results.rows.map((card) => (
            <li key={card.id}>
              <RowStory card={card} />
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && (
        <nav className={styles.pager} aria-label="Pages">
          {page > 1 ? <Link href={href(page - 1)}>Previous results</Link> : <span />}
          <span>
            Page {page} of {pages}
          </span>
          {page < pages ? <Link href={href(page + 1)}>More results</Link> : <span />}
        </nav>
      )}
    </>
  );
}

export default function SearchPage(props: Props) {
  return (
    <SitePage page="search">
      <div className={styles.wrap}>
        <header className={styles.pageHead}>
          <h1 className={styles.h1}>Search</h1>
          <Suspense fallback={<SearchForm />}>
            <Results {...props} />
          </Suspense>
        </header>
      </div>
    </SitePage>
  );
}
```

### `src/app/(site)/tag/[slug]/page.tsx`

```tsx
import type { Metadata } from 'next';
import { ListView } from '@/components/site/ListView';
import { PLACEHOLDER } from '@/modules/site/params';
import { getList } from '@/modules/site/queries';

// Addresses missing from generateStaticParams render on their first visit, then come from the cache.
// The page needs its params to render at all (it is a 404 or a redirect without them), so it may block.
export const instant = false;

type Props = { params: Promise<{ slug: string }> };

// One sample is enough (see src/modules/site/params.ts); every other tag page renders on first visit.
export function generateStaticParams() {
  return [{ slug: PLACEHOLDER }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const list = await getList('tag', slug);
  return list?.subject ? { title: list.subject.name } : {};
}

export default async function TagPage({ params }: Props) {
  const { slug } = await params;
  return <ListView kind="tag" slug={slug} page={1} />;
}
```

### `src/app/(site)/tag/[slug]/page/[n]/page.tsx`

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ListView } from '@/components/site/ListView';
import { pageNumber } from '@/modules/site/format';
import { PLACEHOLDER } from '@/modules/site/params';
import { getList } from '@/modules/site/queries';

// Addresses missing from generateStaticParams render on their first visit, then come from the cache.
// The page needs its params to render at all (it is a 404 or a redirect without them), so it may block.
export const instant = false;

type Props = { params: Promise<{ slug: string; n: string }> };

export function generateStaticParams() {
  return [{ slug: PLACEHOLDER, n: '2' }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, n } = await params;
  const list = await getList('tag', slug);
  return list?.subject ? { title: `${list.subject.name}, page ${n}` } : {};
}

export default async function TagPageN({ params }: Props) {
  const { slug, n } = await params;
  const page = pageNumber(n);
  if (!page) notFound();
  return <ListView kind="tag" slug={slug} page={page} />;
}
```

### `src/app/api/cron/run/route.ts`

```ts
import { checkCronAuth, cronAuthResponse } from '@/lib/cron-auth';
import { createAdminClient } from '@/lib/supabase/clients';
import { TAGS } from '@/modules/site/cache';
import { expireTags } from '@/modules/site/invalidate';

// Scheduled work, called by Vercel Cron once a day and by Supabase Cron every 5 minutes (docs/ops/setup.md,
// step F). Publishes scheduled articles that are due, then refreshes the site. Safe to call twice.

export async function GET(request: Request) {
  const auth = checkCronAuth(request.headers.get('authorization'), process.env.CRON_SECRET);
  if (auth !== 'ok') return cronAuthResponse(auth);

  const { data, error } = await createAdminClient().rpc('publish_due_articles');
  if (error) return Response.json({ ok: false, error: `Scheduled articles could not be published: ${error.message}` }, { status: 500 });
  const published = Number(data ?? 0);
  if (published > 0) expireTags([TAGS.articles]);
  return Response.json({ ok: true, published });
}
```

### `src/app/api/revalidate/route.ts`

```ts
import { checkCronAuth, cronAuthResponse } from '@/lib/cron-auth';
import { expireTags } from '@/modules/site/invalidate';

// Drops cached site pages by tag (src/modules/site/cache.ts). For data written outside the Newsroom:
// end-to-end tests that seed the database directly, and as a manual fix. Protected by CRON_SECRET.

const TAG = /^(site|articles|taxonomy|article:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

export async function POST(request: Request) {
  const auth = checkCronAuth(request.headers.get('authorization'), process.env.CRON_SECRET);
  if (auth !== 'ok') return cronAuthResponse(auth);
  const body = (await request.json().catch(() => null)) as { tags?: unknown } | null;
  const tags = Array.isArray(body?.tags) ? body.tags : [];
  if (!tags.length || tags.length > 20 || !tags.every((tag): tag is string => typeof tag === 'string' && TAG.test(tag))) {
    return Response.json({ ok: false, error: 'Send {"tags": [...]} with site, articles, taxonomy or article:<id>.' }, { status: 400 });
  }
  expireTags(tags);
  return Response.json({ ok: true, tags });
}
```

### `src/app/layout.tsx`

```tsx
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { THEME_SCRIPT } from '@/components/site/theme';
import { siteUrl } from '@/lib/env';
import { newsreader, plexMono, plexSans } from './fonts';
import '@/styles/tokens.css';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: 'PressCompass', template: '%s · PressCompass' },
  description: 'News with a sense of direction.',
  // Not indexed until launch (Plan 8 turns indexing on).
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f4ef' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1524' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // The theme script may set data-theme before React hydrates, hence suppressHydrationWarning.
    <html lang="en" className={`${newsreader.variable} ${plexSans.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

### `src/app/newsroom/(app)/page.tsx`

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon, type IconName } from '@/components/ds/Icon';
import { StatusBadge } from '@/components/newsroom/StatusBadge';
import { SubmitButton } from '@/components/newsroom/SubmitButton';
import { EmptyState, PageHeader } from '@/components/newsroom/ui';
import { deployEnv } from '@/lib/env';
import { createSessionClient } from '@/lib/supabase/clients';
import { formatWib, wibDayStart } from '@/lib/time';
import { requireStaff } from '@/modules/auth/staff';
import { createArticle } from '@/modules/editor/actions';
import { getDashboard, listArticles, publishDue } from '@/modules/editor/queries';
import { uploadsReady } from '@/modules/media/queries';
import styles from './newsroom.module.css';

export const metadata: Metadata = { title: 'Dashboard' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

async function databaseCheck(): Promise<{ ok: boolean; detail: string }> {
  try {
    const supabase = await createSessionClient();
    const { count, error } = await supabase.from('sections').select('id', { count: 'exact', head: true });
    if (error) return { ok: false, detail: error.message };
    return { ok: true, detail: `Connected. ${count ?? 0} ${count === 1 ? 'section' : 'sections'}.` };
  } catch (error) {
    return { ok: false, detail: (error as Error).message };
  }
}

const NEXT_STEPS = [
  ['v0.5.0', 'Homepage, navigation, pages and site settings'],
  ['v0.6.0', 'SEO tools'],
  ['v0.7.0', 'Automatic indexing and the SEO dashboard'],
] as const;

export default async function DashboardPage() {
  const staff = await requireStaff();
  await publishDue();
  const now = new Date();
  const [stats, recent, database] = await Promise.all([getDashboard(wibDayStart(now)), listArticles({ limit: 6 }), databaseCheck()]);
  const environment = deployEnv();
  const mediaReady = uploadsReady();

  const cards: { label: string; icon: IconName; value: number; note: string; href: string }[] = [
    { label: 'Published today', icon: 'check', value: stats.published_today, note: formatWib(now, 'date'), href: '/newsroom/articles?status=published' },
    { label: 'In review', icon: 'eye', value: stats.review, note: stats.review ? 'Waiting for a final read' : 'Nothing waiting', href: '/newsroom/articles?status=review' },
    {
      label: 'Scheduled',
      icon: 'clock',
      value: stats.scheduled,
      note: stats.next_scheduled_at ? `Next ${formatWib(stats.next_scheduled_at, 'short')}` : 'Nothing scheduled',
      href: '/newsroom/articles?status=scheduled',
    },
    { label: 'Drafts', icon: 'edit', value: stats.drafts, note: 'Saved as you write', href: '/newsroom/articles?status=draft' },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        actions={
          <form action={createArticle}>
            <SubmitButton icon="plus" pendingLabel="Creating…">
              New article
            </SubmitButton>
          </form>
        }
      />
      <ul className={styles.stats} aria-label="Articles at a glance">
        {cards.map((card) => (
          <li key={card.label}>
            <Link href={card.href} className={styles.stat}>
              <span className={styles.statLabel}>
                <Icon name={card.icon} size={16} />
                {card.label}
              </span>
              <b className={styles.statValue}>{card.value}</b>
              <small className={styles.statNote}>{card.note}</small>
            </Link>
          </li>
        ))}
      </ul>

      <div className={styles.grid}>
        <section className={styles.panel} aria-label="Recently updated">
          <h2 className={styles.panelTitle}>
            Recently updated
          </h2>
          {recent.rows.length === 0 ? (
            <EmptyState icon="file" title="No articles yet">
              <p>New article opens a draft that saves itself every 10 seconds.</p>
            </EmptyState>
          ) : (
            <ul className={styles.recent}>
              {recent.rows.map((row) => (
                <li key={row.id}>
                  <Link href={`/newsroom/articles/${row.id}`}>{row.title || 'Untitled'}</Link>
                  <span className={styles.recentMeta}>
                    <StatusBadge status={row.status} />
                    <time dateTime={row.updated_at}>{formatWib(row.updated_at, 'short')}</time>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className={styles.side2}>
          <section className={styles.panel} aria-label="System">
            <h2 className={styles.panelTitle}>
              System
            </h2>
            <ul className={styles.checks}>
              <li>
                <Icon name={database.ok ? 'check' : 'alert'} size={16} className={database.ok ? styles.ok : styles.bad} />
                <span>
                  <b>Database</b> {database.detail}
                </span>
              </li>
              <li>
                <Icon name={mediaReady ? 'check' : 'alert'} size={16} className={mediaReady ? styles.ok : styles.bad} />
                <span>
                  <b>Media</b>{' '}
                  {mediaReady ? (
                    'Cloudinary connected.'
                  ) : (
                    <>
                      Cloudinary is not connected. <Link href="/newsroom/media">See how</Link>.
                    </>
                  )}
                </span>
              </li>
              <li>
                <Icon name="check" size={16} className={styles.ok} />
                <span>
                  <b>Deployment</b> {environment === 'production' ? 'Production' : 'Preview or local'}
                </span>
              </li>
              <li>
                <Icon name="check" size={16} className={styles.ok} />
                <span>
                  <b>Signed in</b> {staff.email}
                </span>
              </li>
            </ul>
          </section>
          <section className={styles.panel} aria-label="Coming next">
            <h2 className={styles.panelTitle}>
              Coming next
            </h2>
            <ol className={styles.steps}>
              {NEXT_STEPS.map(([version, text]) => (
                <li key={version}>
                  <span className={styles.version}>{version}</span>
                  {text}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}
```

### `src/app/newsroom/preview/[id]/page.tsx`

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ButtonLink } from '@/components/ds/Button';
import { Logo } from '@/components/ds/Logo';
import { sanitizeDoc } from '@/lib/doc/sanitize';
import { type Block, UUID } from '@/lib/doc/schema';
import { bodyMediaIds, docText, readingMinutes, wordCount } from '@/lib/doc/text';
import { formatWib } from '@/lib/time';
import { requireStaff } from '@/modules/auth/staff';
import { ArticleView } from '@/components/site/ArticleView';
import { mediaByIds } from '@/modules/media/queries';
import { articleLinks, getArticle, getRevision } from '@/modules/editor/queries';
import { STATUS_LABELS } from '@/modules/editor/status';
import { getSection, listAuthors, listTags } from '@/modules/taxonomy/queries';
import styles from './preview.module.css';

export const metadata: Metadata = { title: 'Preview' };

// Previews read the session and drafts on every request.
export const instant = false;

export default async function PreviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ revision?: string }> }) {
  await requireStaff();
  const [{ id }, { revision: revisionParam }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const article = await getArticle(id);
  if (!article) notFound();

  const revisionId = Number(revisionParam);
  const revision = revisionParam && Number.isInteger(revisionId) ? await getRevision(id, revisionId) : null;
  const snap = revision?.snapshot ?? {};
  const view = {
    title: snap.title ?? article.title,
    standfirst: snap.standfirst ?? article.standfirst,
    kicker: snap.kicker_label ?? article.kicker_label,
    type: snap.type ?? article.type,
    sectionId: snap.section_id !== undefined ? snap.section_id : article.section_id,
    authorIds: snap.authors ?? article.authorIds,
    body: sanitizeDoc(snap.body ?? article.body),
    sources: snap.sources ?? article.sources,
    leadMediaId: snap.lead_media_id !== undefined ? snap.lead_media_id : article.lead_media_id,
    leadCaption: snap.lead_caption ?? article.lead_caption,
    isBreaking: snap.is_breaking ?? article.is_breaking,
    tagIds: snap.tags ?? article.tagIds,
  };

  const readMoreIds = view.body.content.filter((block): block is Extract<Block, { type: 'readMore' }> => block.type === 'readMore').map((block) => block.attrs.articleId);
  const [section, authors, tags, links] = await Promise.all([
    view.sectionId ? getSection(view.sectionId) : null,
    listAuthors(),
    listTags(),
    articleLinks(readMoreIds),
  ]);
  const byline = view.authorIds.map((authorId) => authors.find((a) => a.id === authorId)).filter((a) => a !== undefined);
  const media = await mediaByIds([view.leadMediaId, ...bodyMediaIds(view.body), ...byline.map((author) => author.photo_media_id)]);
  const image = (mediaId: string | null) => (mediaId ? (media.get(mediaId) ?? null) : null);
  const published = article.status === 'published' && article.published_at;
  const dateLine = published
    ? undefined
    : article.scheduled_at && article.status === 'scheduled'
      ? `Scheduled for ${formatWib(article.scheduled_at)} WIB`
      : 'Not published yet';

  return (
    <div className={styles.page}>
      <div className={styles.bar} role="region" aria-label="Preview">
        <p>
          <b>{revision ? `Version from ${formatWib(revision.created_at)} WIB` : `Preview · ${STATUS_LABELS[article.status]}`}</b>
          <span>
            {revision
              ? 'This is an older version from the history. It is not on the site.'
              : article.status === 'published'
                ? 'Readers see this version.'
                : 'Readers cannot see this page.'}
          </span>
        </p>
        <ButtonLink href={revision ? `/newsroom/articles/${id}/history` : `/newsroom/articles/${id}`} size="sm" icon="arrow-left">
          {revision ? 'Back to history' : 'Back to editor'}
        </ButtonLink>
      </div>
      <header className={styles.masthead}>
        <Logo height={30} />
      </header>
      <main className={styles.wrap}>
        <ArticleView
          linked={false}
          dateLine={dateLine}
          article={{
            title: view.title,
            standfirst: view.standfirst,
            type: view.type,
            kicker: view.kicker,
            isBreaking: view.isBreaking,
            section: section ? { name: section.name, slug: section.slug } : null,
            authors: byline.map((author) => ({ name: author.name, slug: '', role: author.role, photo: image(author.photo_media_id) })),
            publishedAt: published ? article.published_at : null,
            updatedAt: article.major_update_at,
            readingMinutes: readingMinutes(wordCount(docText(view.body))),
            lead: image(view.leadMediaId),
            leadCaption: view.leadCaption,
            body: view.body,
            links,
            media,
            sources: view.sources,
            tags: view.tagIds.map((tagId) => tags.find((tag) => tag.id === tagId)).filter((tag) => tag !== undefined),
          }}
        />
      </main>
    </div>
  );
}
```

### `src/app/newsroom/preview/[id]/preview.module.css`

```css
/* The preview bar and masthead around the site's own ArticleView. */

.page {
  min-height: 100vh;
  background: var(--paper);
  padding-bottom: var(--space-9);
}

.bar {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  padding: 10px var(--gutter, 24px);
  background: var(--meridian-soft);
  color: var(--meridian);
  border-bottom: 1px solid var(--line);
  font: 400 14px/20px var(--font-sans);
}

.bar p {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.bar b {
  font-weight: 600;
}

.masthead {
  display: flex;
  justify-content: center;
  padding: var(--space-5) var(--space-4);
  border-bottom: 1px solid var(--line);
  color: var(--ink);
}

.wrap {
  padding: 0 var(--space-4);
}
```

### `src/app/not-found.tsx`

```tsx
import type { Metadata } from 'next';
import { SearchForm } from '@/components/site/SearchForm';
import { SitePage } from '@/components/site/SitePage';
import { TopStory } from '@/components/site/Stories';
import styles from '@/components/site/site.module.css';
import { getList } from '@/modules/site/queries';

export const metadata: Metadata = { title: 'Page not found' };

// Every address without a page, and every notFound() on the site. (The Newsroom keeps its own messages.)
export default async function NotFound() {
  const latest = await getList('latest', null, 1, 5);
  return (
    <SitePage page="not-found">
      <div className={styles.wrap}>
        <header className={`${styles.pageHead} ${styles.pageHeadPlain}`}>
          <h1 className={styles.h1}>Page not found</h1>
          <p className={styles.stand}>The page may have moved or been taken down. Search for it, or start from the latest stories.</p>
          <SearchForm />
        </header>
        {latest && latest.rows.length > 0 && (
          <section className={styles.sec} aria-label="Latest stories">
            <h2 className={styles.railTitle}>Latest</h2>
            <ul className={styles.toplist}>
              {latest.rows.map((card) => (
                <li key={card.id}>
                  <TopStory card={card} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </SitePage>
  );
}
```

### `src/components/ds/Icon.tsx`

```tsx
// Outline icons on a 24-unit grid with a 1.5 stroke (design system: Iconography).
const ICONS = {
  alert: 'M12 7.5v5.5M12 16.2v.3M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0',
  archive: 'M4 5h16v4H4zM5.5 9v10h13V9M10 13h4',
  'arrow-down': 'M12 5v14M6 13l6 6 6-6',
  'arrow-left': 'M19 12H5M11 6l-6 6 6 6',
  'arrow-right': 'M5 12h14M13 6l6 6-6 6',
  'arrow-up': 'M12 19V5M6 11l6-6 6 6',
  bold: 'M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  chart: 'M4 20h16M7 16v-5M12 16V7M17 16v-8',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  clock: 'M12 7v5l3 2M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0',
  dots: 'M4 12a1 1 0 1 0 2 0 1 1 0 0 0-2 0M11 12a1 1 0 1 0 2 0 1 1 0 0 0-2 0M18 12a1 1 0 1 0 2 0 1 1 0 0 0-2 0',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  eye: 'M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12zM9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
  folder: 'M3 6h6l2 2h10v11H3z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  heading: 'M6 4v16M18 4v16M6 12h12',
  history: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2',
  image: 'M3 5h18v14H3zM7.5 10a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0M21 16l-5-5-8 8',
  info: 'M12 11v6M12 7.5v.01M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0',
  italic: 'M10 5h8M6 19h8M14 5l-4 14',
  link: 'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  'list-ordered': 'M10 6h10M10 12h10M10 18h10M4 4h1.5v4M3.5 8h3M3.5 14h3l-3 4h3',
  'log-out': 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11',
  menu: 'M4 7h16M4 12h16M4 17h16',
  minus: 'M5 12h14',
  plus: 'M12 5v14M5 12h14',
  quote: 'M5 17c2-1 3-3 3-6V7H4v5h4M15 17c2-1 3-3 3-6V7h-4v5h4',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  search: 'M4 11a7 7 0 1 0 14 0 7 7 0 0 0-14 0M20 20l-4-4',
  sliders: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 7a2 2 0 1 0 4 0 2 2 0 0 0-4 0M8 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0',
  table: 'M3 5h18v14H3zM3 10h18M3 15h18M9 5v14M15 5v14',
  tag: 'M3.5 3.5H11l9.5 9.5-7.5 7.5-9.5-9.5zM8 8h.01',
  trend: 'M4 20h16M4 16l5-5 4 3 7-7M16 7h4v4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  undo: 'M9 14l-5-5 5-5M4 9h10a6 6 0 0 1 0 12h-3',
  users: 'M5.5 8a3.5 3.5 0 1 0 7 0 3.5 3.5 0 0 0-7 0M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2 .8 3 3 3 6',
  video: 'M3 6h13v12H3zM16 10l5-3v10l-5-3',
  x: 'M6 6l12 12M18 6L6 18',
} as const;

export type IconName = keyof typeof ICONS;

type IconProps = {
  name: IconName;
  size?: number;
  /** Accessible name for an icon that stands alone; omit when visible text explains it. */
  label?: string;
  className?: string;
};

export function Icon({ name, size = 20, label, className }: IconProps) {
  const a11y = label ? { role: 'img' as const, 'aria-label': label } : { 'aria-hidden': true as const };
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...a11y}
    >
      <path d={ICONS[name]} />
    </svg>
  );
}
```

### `src/components/newsroom/editor/BlockCard.tsx`

```tsx
'use client';

import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { createContext, useContext, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { Icon, type IconName } from '@/components/ds/Icon';
import { CloudImage } from '@/components/media/CloudImage';
import { ImagePickerDialog } from '@/components/media/ImagePickerDialog';
import { BlockDialog } from './BlockDialog';
import styles from './editor.module.css';
import type { SpecialKind } from './extensions';
import { MediaLookupContext } from './media-context';
import type { MediaItem } from '@/modules/media/types';

// How a special block looks inside the editor: a labelled card with a short preview, Edit and Remove.

export const ArticleIdContext = createContext('');

const META: Record<SpecialKind, { label: string; icon: IconName }> = {
  pullQuote: { label: 'Pull quote', icon: 'quote' },
  editorNote: { label: "Editor's note", icon: 'info' },
  keyFigures: { label: 'Key figures', icon: 'chart' },
  youtube: { label: 'YouTube video', icon: 'video' },
  readMore: { label: 'Read more', icon: 'link' },
  image: { label: 'Image', icon: 'image' },
  chart: { label: 'Chart', icon: 'trend' },
};

function summary(kind: SpecialKind, attrs: Record<string, unknown>) {
  switch (kind) {
    case 'pullQuote':
      return `“${attrs.text}”${attrs.attribution ? ` — ${attrs.attribution}` : ''}`;
    case 'editorNote':
      return `${attrs.kind === 'correction' ? 'Correction' : 'Update'}${attrs.date ? ` (${attrs.date})` : ''}: ${attrs.text}`;
    case 'keyFigures':
      return (attrs.items as { value: string; label: string }[]).map((item) => `${item.value} ${item.label}`).join(' · ');
    case 'youtube':
      return `${attrs.title} (youtube.com/watch?v=${attrs.videoId})`;
    case 'readMore':
      return String(attrs.title || 'Untitled');
    case 'image':
      return String(attrs.caption || '');
    case 'chart':
      return `${attrs.title} · ${attrs.kind === 'line' ? 'line' : 'bar'} chart, ${(attrs.labels as string[]).length} rows`;
  }
}

export function BlockCard({ node, updateAttributes, deleteNode, selected, editor }: ReactNodeViewProps) {
  const kind = node.type.name as SpecialKind;
  const articleId = useContext(ArticleIdContext);
  const lookup = useContext(MediaLookupContext);
  const [editing, setEditing] = useState(false);
  const meta = META[kind];
  const editable = editor.isEditable;

  return (
    <NodeViewWrapper className={styles.card} data-selected={selected || undefined} contentEditable={false} data-drag-handle="">
      <p className={styles.cardLabel}>
        <Icon name={meta.icon} size={16} />
        {meta.label}
      </p>
      {kind === 'image' ? (
        <ImagePreview media={lookup.get(String(node.attrs.mediaId))} caption={String(node.attrs.caption ?? '')} />
      ) : (
        <p className={styles.cardText}>{summary(kind, node.attrs)}</p>
      )}
      {editable && (
        <div className={styles.cardActions}>
          <Button size="sm" variant="secondary" icon="edit" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button size="sm" variant="quiet" icon="trash" onClick={() => deleteNode()} aria-label={`Remove ${meta.label.toLowerCase()}`} />
        </div>
      )}
      {editing && kind === 'image' && (
        <ImagePickerDialog
          title="Image"
          initial={lookup.get(String(node.attrs.mediaId)) ?? null}
          caption={String(node.attrs.caption ?? '')}
          submitLabel="Save"
          onClose={() => setEditing(false)}
          onSave={({ media, caption }) => {
            lookup.remember(media);
            updateAttributes({ mediaId: media.id, caption });
            setEditing(false);
          }}
        />
      )}
      {editing && kind !== 'image' && (
        <BlockDialog
          kind={kind}
          initial={node.attrs}
          articleId={articleId}
          onClose={() => setEditing(false)}
          onRemove={() => {
            setEditing(false);
            deleteNode();
          }}
          onSave={(attrs) => {
            updateAttributes(attrs);
            setEditing(false);
          }}
        />
      )}
    </NodeViewWrapper>
  );
}

function ImagePreview({ media, caption }: { media: MediaItem | undefined; caption: string }) {
  if (!media) return <p className={styles.cardText}>This image is no longer in the media library. Choose another or remove the block.</p>;
  return (
    <div className={styles.imageCard}>
      <CloudImage image={media} alt="" preset="card" sizes="160px" className={styles.imageThumb} />
      <div>
        <p className={styles.cardText}>{caption || <span className={styles.muted}>No caption</span>}</p>
        <p className={media.alt ? styles.altOk : styles.altMissing}>{media.alt ? `Alt text: ${media.alt}` : 'No alt text yet. Needed before publishing.'}</p>
      </div>
    </div>
  );
}
```

### `src/components/newsroom/editor/BlockDialog.tsx`

```tsx
'use client';

import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ds/Button';
import { CHART_LIMITS, type ChartAttrs, chartTable, parseChartTable } from '@/lib/doc/chart';
import { LIMITS } from '@/lib/doc/schema';
import { youtubeId } from '@/lib/doc/youtube';
import { toWibInput } from '@/lib/time';
import { findArticles } from '@/modules/editor/actions';
import { STATUS_LABELS } from '@/modules/editor/status';
import { SelectField, TextArea, TextField } from '../Field';
import forms from '../forms.module.css';
import ui from '../ui.module.css';
import styles from './editor.module.css';
import type { SpecialKind } from './extensions';

// One dialog for every special block (and for links), rendered in a portal outside the editor so
// typing in it never reaches the document. Each kind checks its own fields before saving.

export type DialogKind = SpecialKind | 'link';
type Attrs = Record<string, unknown>;

const TITLES: Record<DialogKind, string> = {
  pullQuote: 'Pull quote',
  editorNote: "Editor's note",
  keyFigures: 'Key figures',
  youtube: 'YouTube video',
  readMore: 'Read more',
  image: 'Image',
  chart: 'Chart',
  link: 'Link',
};

const SAFE_HREF = /^(https?:\/\/\S+|mailto:\S+|\/(?!\/)\S*|#\S*)$/i;

type Found = Awaited<ReturnType<typeof findArticles>>;

export function BlockDialog({
  kind,
  mode = 'edit',
  initial,
  articleId,
  onSave,
  onRemove,
  onClose,
}: {
  kind: DialogKind;
  mode?: 'insert' | 'edit';
  initial: Attrs;
  articleId: string;
  onSave: (attrs: Attrs) => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const [values, setValues] = useState<Attrs>(() => ({
    ...initial,
    ...(kind === 'editorNote' && !initial.date ? { date: toWibInput(new Date()).slice(0, 10) } : {}),
    ...(kind === 'keyFigures' ? { items: padFigures(initial.items) } : {}),
    ...(kind === 'youtube' ? { link: initial.videoId ?? '' } : {}),
    ...(kind === 'chart' ? { data: chartTable(initial as ChartAttrs), kind: initial.kind === 'line' ? 'line' : 'bar' } : {}),
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Found | null>(null);
  const [searching, setSearching] = useState(false);

  // Open as a modal on mount. No close() on cleanup: in development React runs effects twice, and a
  // close event from the first cleanup would dismiss the dialog straight away.
  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  const set = (key: string, value: unknown) => setValues((current) => ({ ...current, [key]: value }));
  const text = (key: string) => String(values[key] ?? '');

  function submit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    const problems: Record<string, string> = {};
    let attrs: Attrs = {};
    if (kind === 'pullQuote') {
      if (!text('text').trim()) problems.text = 'Write the quote.';
      attrs = { text: text('text').trim(), attribution: text('attribution').trim() };
    } else if (kind === 'editorNote') {
      if (!text('text').trim()) problems.text = 'Write what changed and why.';
      attrs = { kind: values.kind === 'correction' ? 'correction' : 'update', date: text('date'), text: text('text').trim() };
    } else if (kind === 'keyFigures') {
      const items = (values.items as { value: string; label: string }[])
        .map((item) => ({ value: item.value.trim(), label: item.label.trim() }))
        .filter((item) => item.value || item.label);
      if (items.length < 2) problems.items = 'Add at least two figures, each with a value and a label.';
      else if (items.some((item) => !item.value || !item.label)) problems.items = 'Each figure needs a value and a label.';
      attrs = { title: text('title').trim(), items, source: text('source').trim() };
    } else if (kind === 'youtube') {
      const videoId = youtubeId(text('link'));
      if (!videoId) problems.link = 'Paste a YouTube link, for example https://www.youtube.com/watch?v=…';
      if (!text('title').trim()) problems.title = 'Describe the video in a few words. Screen readers announce it.';
      attrs = { videoId, title: text('title').trim() };
    } else if (kind === 'readMore') {
      if (!values.articleId) problems.article = 'Choose an article.';
      attrs = { articleId: values.articleId, title: values.title };
    } else if (kind === 'chart') {
      const chartKind = values.kind === 'line' ? 'line' : 'bar';
      const parsed = parseChartTable(text('data'), chartKind);
      if ('error' in parsed) problems.data = parsed.error;
      if (!text('title').trim()) problems.title = 'Give the chart a title that says what it shows.';
      if (!text('source').trim()) problems.source = 'Name the source of the numbers.';
      attrs = { kind: chartKind, title: text('title').trim(), subtitle: text('subtitle').trim(), source: text('source').trim(), ...('error' in parsed ? {} : parsed) };
    } else if (kind === 'link') {
      const href = text('href').trim();
      if (!SAFE_HREF.test(href)) problems.href = 'Use a full address starting with https://, or a site address starting with /.';
      attrs = { href };
    }
    setErrors(problems);
    if (Object.keys(problems).length) return;
    onSave(attrs);
  }

  async function search() {
    setSearching(true);
    try {
      setFound(await findArticles(query, articleId));
    } finally {
      setSearching(false);
    }
  }

  return createPortal(
    <dialog ref={dialog} className={`${ui.dialog} ${styles.blockDialog}`} aria-labelledby={`${uid}-heading`} onCancel={onClose} onClose={onClose}>
      <form className={forms.form} onSubmit={submit} noValidate>
        <h2 id={`${uid}-heading`} className={ui.dialogTitle}>
          {TITLES[kind]}
        </h2>

        {kind === 'pullQuote' && (
          <>
            <TextArea id={`${uid}-text`} label="Quote" rows={3} value={text('text')} onChange={(e) => set('text', e.target.value)} error={errors.text} maxLength={LIMITS.pullQuoteText} />
            <TextField
              id={`${uid}-attribution`}
              label="Who said it"
              optional
              value={text('attribution')}
              onChange={(e) => set('attribution', e.target.value)}
              placeholder="Sri Mulyani, finance minister"
              maxLength={LIMITS.attribution}
            />
          </>
        )}

        {kind === 'editorNote' && (
          <>
            <div className={forms.row}>
              <SelectField id={`${uid}-kind`} label="Type" value={text('kind') || 'update'} onChange={(e) => set('kind', e.target.value)}>
                <option value="update">Update</option>
                <option value="correction">Correction</option>
              </SelectField>
              <TextField id={`${uid}-date`} label="Date" type="date" value={text('date')} onChange={(e) => set('date', e.target.value)} />
            </div>
            <TextArea id={`${uid}-text`} label="Note" rows={3} value={text('text')} onChange={(e) => set('text', e.target.value)} error={errors.text} maxLength={LIMITS.noteText} hint="Say what changed. Corrections name the earlier mistake." />
          </>
        )}

        {kind === 'keyFigures' && (
          <>
            <TextField id={`${uid}-title`} label="Heading" optional value={text('title')} onChange={(e) => set('title', e.target.value)} placeholder="The harvest in numbers" maxLength={LIMITS.figuresTitle} />
            <fieldset className={forms.fieldset}>
              <legend className={forms.label}>Figures (two to four)</legend>
              {errors.items && <p className={forms.error}>{errors.items}</p>}
              {(values.items as { value: string; label: string }[]).map((item, index) => (
                <div className={styles.figureRow} key={index}>
                  <TextField
                    id={`${uid}-value-${index}`}
                    label={`Figure ${index + 1}`}
                    value={item.value}
                    onChange={(e) => set('items', updateItem(values.items, index, 'value', e.target.value))}
                    placeholder={index === 0 ? '31.5m' : undefined}
                    maxLength={LIMITS.figureValue}
                    mono
                  />
                  <TextField
                    id={`${uid}-label-${index}`}
                    label={`Label ${index + 1}`}
                    value={item.label}
                    onChange={(e) => set('items', updateItem(values.items, index, 'label', e.target.value))}
                    placeholder={index === 0 ? 'tonnes of rice this season' : undefined}
                    maxLength={LIMITS.figureLabel}
                  />
                </div>
              ))}
            </fieldset>
            <TextField id={`${uid}-source`} label="Source" optional value={text('source')} onChange={(e) => set('source', e.target.value)} placeholder="Statistics Indonesia (BPS)" maxLength={LIMITS.figuresSource} />
          </>
        )}

        {kind === 'youtube' && (
          <>
            <TextField id={`${uid}-link`} label="YouTube link" value={text('link')} onChange={(e) => set('link', e.target.value)} error={errors.link} placeholder="https://www.youtube.com/watch?v=…" mono />
            <TextField
              id={`${uid}-title`}
              label="What the video shows"
              value={text('title')}
              onChange={(e) => set('title', e.target.value)}
              error={errors.title}
              maxLength={LIMITS.videoTitle}
              hint="The player loads only when a reader presses play."
            />
          </>
        )}

        {kind === 'readMore' && (
          <>
            {Boolean(values.articleId) && (
              <p className={styles.chosen}>
                Linked: <b>{text('title') || 'Untitled'}</b>
              </p>
            )}
            <div className={styles.searchRow}>
              <TextField
                id={`${uid}-query`}
                label="Find an article"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void search();
                  }
                }}
                error={errors.article}
              />
              <Button onClick={() => void search()} disabled={searching}>
                {searching ? 'Searching…' : 'Search'}
              </Button>
            </div>
            {found && (
              <ul className={styles.results} aria-label="Search results">
                {found.length === 0 && <li className={forms.hint}>No articles match.</li>}
                {found.map((article) => (
                  <li key={article.id}>
                    <button
                      type="button"
                      className={styles.result}
                      aria-pressed={values.articleId === article.id}
                      onClick={() => setValues((current) => ({ ...current, articleId: article.id, title: article.title || 'Untitled' }))}
                    >
                      <span>{article.title || 'Untitled'}</span>
                      <small>
                        {article.section?.name ?? 'No section'} · {STATUS_LABELS[article.status]}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {kind === 'chart' && (
          <>
            <SelectField id={`${uid}-chart-kind`} label="Type" value={text('kind')} onChange={(e) => set('kind', e.target.value)}>
              <option value="bar">Bar chart (one or two columns of numbers)</option>
              <option value="line">Line chart (one to three columns of numbers)</option>
            </SelectField>
            <TextField id={`${uid}-title`} label="Title" value={text('title')} onChange={(e) => set('title', e.target.value)} error={errors.title} placeholder="Annual food inflation" maxLength={CHART_LIMITS.title} />
            <TextField id={`${uid}-subtitle`} label="Units and period" optional value={text('subtitle')} onChange={(e) => set('subtitle', e.target.value)} placeholder="Per cent, May–October 2026" maxLength={CHART_LIMITS.subtitle} />
            <TextArea
              id={`${uid}-data`}
              label="Data"
              rows={8}
              value={text('data')}
              onChange={(e) => set('data', e.target.value)}
              error={errors.data}
              mono
              placeholder={'Month\tFood inflation\nMay\t4.1\nJun\t3.8'}
              hint="Copy the cells from a spreadsheet and paste them here. First row: column names. First column: labels. Up to 24 rows."
            />
            <TextField id={`${uid}-source`} label="Source" value={text('source')} onChange={(e) => set('source', e.target.value)} error={errors.source} placeholder="Statistics Indonesia (BPS)" maxLength={CHART_LIMITS.source} />
          </>
        )}

        {kind === 'link' && (
          <TextField id={`${uid}-href`} label="Address" value={text('href')} onChange={(e) => set('href', e.target.value)} error={errors.href} placeholder="https://" mono />
        )}

        <div className={ui.dialogActions}>
          {onRemove && (
            <Button type="button" variant="quiet" onClick={onRemove} className={styles.remove}>
              {kind === 'link' ? 'Remove link' : 'Remove block'}
            </Button>
          )}
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {mode === 'insert' ? 'Insert' : 'Save'}
          </Button>
        </div>
      </form>
    </dialog>,
    document.body,
  );
}

function padFigures(items: unknown) {
  const list = Array.isArray(items) ? (items as { value: string; label: string }[]).map((item) => ({ value: item.value ?? '', label: item.label ?? '' })) : [];
  while (list.length < LIMITS.figuresMax) list.push({ value: '', label: '' });
  return list;
}

function updateItem(items: unknown, index: number, key: 'value' | 'label', value: string) {
  return (items as { value: string; label: string }[]).map((item, i) => (i === index ? { ...item, [key]: value } : item));
}
```

### `src/components/newsroom/editor/BodyEditor.tsx`

```tsx
'use client';

import { NodeSelection } from '@tiptap/pm/state';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { type Ref, useContext, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { Icon, type IconName } from '@/components/ds/Icon';
import type { Doc } from '@/lib/doc/schema';
import { ImagePickerDialog } from '@/components/media/ImagePickerDialog';
import { ArticleIdContext, BlockCard } from './BlockCard';
import { BlockDialog, type DialogKind } from './BlockDialog';
import styles from './editor.module.css';
import { editorExtensions, SPECIAL_DEFAULTS, type SpecialKind } from './extensions';
import { MediaLookupContext } from './media-context';

export type BodyEditorHandle = { getJSON: () => unknown; getText: () => string; focus: () => void };

type Tool = { label: string; icon?: IconName; text?: string; active?: boolean; disabled?: boolean; run: () => void };

/** The article body: Tiptap with the PressCompass blocks and a formatting toolbar. */
export function BodyEditor({
  ref,
  initial,
  articleId,
  editable,
  invalid,
  describedBy,
  onChange,
}: {
  ref: Ref<BodyEditorHandle>;
  initial: Doc;
  articleId: string;
  editable: boolean;
  invalid?: boolean;
  describedBy?: string;
  onChange: (text: string) => void;
}) {
  const extensions = useMemo(() => editorExtensions(BlockCard), []);
  const [dialog, setDialog] = useState<{ kind: DialogKind; attrs: Record<string, unknown>; mode: 'insert' | 'edit' } | null>(null);
  const [picking, setPicking] = useState(false);
  const lookup = useContext(MediaLookupContext);

  const editor = useEditor({
    extensions,
    // ProseMirror needs at least one block; a new article is stored with an empty content list.
    content: initial.content.length ? initial : { type: 'doc', content: [{ type: 'paragraph' }] },
    editable,
    immediatelyRender: false,
    editorProps: { attributes: textboxAttributes(invalid, describedBy) },
    onUpdate: ({ editor: current }) => onChange(current.getText()),
  });

  useEffect(() => {
    editor?.setOptions({ editorProps: { attributes: textboxAttributes(invalid, describedBy) } });
  }, [editor, invalid, describedBy]);

  useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable);
  }, [editor, editable]);

  useImperativeHandle(ref, () => ({
    // ProseMirror keeps attributes in null-prototype objects, which Server Action arguments drop.
    // A JSON round trip turns the document into plain objects.
    getJSON: () => JSON.parse(JSON.stringify(editor?.getJSON() ?? initial)),
    getText: () => editor?.getText() ?? '',
    focus: () => editor?.commands.focus(),
  }));

  // The store's editor stays null until the first transaction, so fall back to the instance itself.
  const state = useEditorState({
    editor,
    selector: ({ editor: fromStore }) => {
      const e = fromStore ?? editor;
      return e
        ? {
            h2: e.isActive('heading', { level: 2 }),
            h3: e.isActive('heading', { level: 3 }),
            bold: e.isActive('bold'),
            italic: e.isActive('italic'),
            link: e.isActive('link'),
            bullet: e.isActive('bulletList'),
            ordered: e.isActive('orderedList'),
            quote: e.isActive('blockquote'),
            table: e.isActive('table'),
            canUndo: e.can().undo(),
            canRedo: e.can().redo(),
          }
        : null;
    },
  });

  if (!editor || !state) return <div className={styles.bodyLoading} aria-hidden="true" />;

  const chain = () => editor.chain().focus();
  const insert = (kind: SpecialKind) => setDialog({ kind, attrs: { ...SPECIAL_DEFAULTS[kind] }, mode: 'insert' });
  // Insert after a selected block instead of replacing it, and leave a paragraph to keep writing in.
  const insertBlock = (type: string, attrs: Record<string, unknown>) => {
    const { selection } = editor.state;
    const content = [{ type, attrs }, { type: 'paragraph' }];
    if (selection instanceof NodeSelection) chain().insertContentAt(selection.to, content).run();
    else chain().insertContent(content).run();
  };

  const groups: Tool[][] = [
    [
      { label: 'H2 heading', text: 'H2', active: state.h2, run: () => chain().toggleHeading({ level: 2 }).run() },
      { label: 'H3 subheading', text: 'H3', active: state.h3, run: () => chain().toggleHeading({ level: 3 }).run() },
    ],
    [
      { label: 'Bold', icon: 'bold', active: state.bold, run: () => chain().toggleBold().run() },
      { label: 'Italic', icon: 'italic', active: state.italic, run: () => chain().toggleItalic().run() },
      {
        label: 'Link',
        icon: 'link',
        active: state.link,
        run: () => setDialog({ kind: 'link', attrs: { href: editor.getAttributes('link').href ?? '' }, mode: state.link ? 'edit' : 'insert' }),
      },
    ],
    [
      { label: 'Bulleted list', icon: 'list', active: state.bullet, run: () => chain().toggleBulletList().run() },
      { label: 'Numbered list', icon: 'list-ordered', active: state.ordered, run: () => chain().toggleOrderedList().run() },
      { label: 'Quote', icon: 'quote', active: state.quote, run: () => chain().toggleBlockquote().run() },
      { label: 'Divider', icon: 'minus', run: () => chain().setHorizontalRule().run() },
      { label: 'Table', icon: 'table', active: state.table, run: () => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    ],
    [
      { label: 'Image', icon: 'image', run: () => setPicking(true) },
      { label: 'Pull quote', text: 'Pull quote', run: () => insert('pullQuote') },
      { label: 'Key figures', text: 'Figures', run: () => insert('keyFigures') },
      { label: 'Chart', icon: 'trend', run: () => insert('chart') },
      { label: "Editor's note", text: 'Note', run: () => insert('editorNote') },
      { label: 'YouTube video', icon: 'video', run: () => insert('youtube') },
      { label: 'Read more card', text: 'Read more', run: () => insert('readMore') },
    ],
    [
      { label: 'Undo', icon: 'undo', disabled: !state.canUndo, run: () => chain().undo().run() },
      { label: 'Redo', icon: 'redo', disabled: !state.canRedo, run: () => chain().redo().run() },
    ],
  ];

  const tableTools: Tool[] = [
    { label: 'Add row', text: 'Add row', run: () => chain().addRowAfter().run() },
    { label: 'Add column', text: 'Add column', run: () => chain().addColumnAfter().run() },
    { label: 'Delete row', text: 'Delete row', run: () => chain().deleteRow().run() },
    { label: 'Delete column', text: 'Delete column', run: () => chain().deleteColumn().run() },
    { label: 'Delete table', text: 'Delete table', run: () => chain().deleteTable().run() },
  ];

  const button = (tool: Tool) => (
    <button
      key={tool.label}
      type="button"
      className={styles.tool}
      aria-label={tool.label}
      title={tool.label}
      aria-pressed={tool.active === undefined ? undefined : tool.active}
      disabled={tool.disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={tool.run}
    >
      {tool.icon ? <Icon name={tool.icon} size={18} /> : tool.text}
    </button>
  );

  return (
    <ArticleIdContext value={articleId}>
      <div className={styles.body} data-invalid={invalid || undefined}>
        {editable && (
          <div className={styles.toolbar} role="toolbar" aria-label="Formatting">
            {groups.map((group, index) => (
              <div key={index} className={styles.toolGroup}>
                {group.map(button)}
              </div>
            ))}
            {state.table && (
              <div className={`${styles.toolGroup} ${styles.tableTools}`} role="group" aria-label="Table">
                {tableTools.map(button)}
              </div>
            )}
          </div>
        )}
        <EditorContent editor={editor} />
      </div>
      {dialog && (
        <BlockDialog
          kind={dialog.kind}
          mode={dialog.mode}
          initial={dialog.attrs}
          articleId={articleId}
          onClose={() => setDialog(null)}
          onRemove={dialog.kind === 'link' && dialog.mode === 'edit' ? () => {
            chain().extendMarkRange('link').unsetLink().run();
            setDialog(null);
          } : undefined}
          onSave={(attrs) => {
            if (dialog.kind === 'link') {
              const href = String(attrs.href);
              if (editor.state.selection.empty && !state.link) chain().insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run();
              else chain().extendMarkRange('link').setLink({ href }).run();
            } else {
              insertBlock(dialog.kind, attrs);
            }
            setDialog(null);
          }}
        />
      )}
      {picking && (
        <ImagePickerDialog
          title="Insert an image"
          initial={null}
          caption=""
          submitLabel="Insert"
          onClose={() => setPicking(false)}
          onSave={({ media, caption }) => {
            lookup.remember(media);
            insertBlock('image', { mediaId: media.id, caption });
            setPicking(false);
          }}
        />
      )}
    </ArticleIdContext>
  );
}

function textboxAttributes(invalid?: boolean, describedBy?: string): Record<string, string> {
  return {
    class: styles.prose,
    role: 'textbox',
    'aria-multiline': 'true',
    'aria-label': 'Article text',
    ...(invalid ? { 'aria-invalid': 'true' } : {}),
    ...(describedBy ? { 'aria-describedby': describedBy } : {}),
  };
}
```

### `src/components/newsroom/editor/extensions.ts`

```ts
import { Node } from '@tiptap/core';
import { Blockquote } from '@tiptap/extension-blockquote';
import { ListItem } from '@tiptap/extension-list';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import { type ReactNodeViewProps, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { ComponentType } from 'react';

// The editor schema matches src/lib/doc/schema.ts exactly, so what you see is what is saved.
// Special blocks are atoms edited through a dialog (BlockCard + BlockDialog).

export const SPECIAL_DEFAULTS = {
  pullQuote: { text: '', attribution: '' },
  editorNote: { kind: 'update', date: '', text: '' },
  keyFigures: { title: '', items: [], source: '' },
  youtube: { videoId: '', title: '' },
  readMore: { articleId: '', title: '' },
  image: { mediaId: '', caption: '' },
  chart: { kind: 'bar', title: '', subtitle: '', source: '', axis: '', labels: [], series: [] },
} as const;

export type SpecialKind = keyof typeof SPECIAL_DEFAULTS;

function special(name: SpecialKind, view: ComponentType<ReactNodeViewProps>) {
  const defaults = SPECIAL_DEFAULTS[name] as Record<string, unknown>;
  return Node.create({
    name,
    group: 'block',
    atom: true,
    selectable: true,
    draggable: true,
    addAttributes() {
      return Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, { default: value, rendered: false }]));
    },
    parseHTML() {
      return [
        {
          tag: `div[data-block="${name}"]`,
          getAttrs: (element) => {
            try {
              return JSON.parse((element as HTMLElement).getAttribute('data-attrs') ?? '{}');
            } catch {
              return false;
            }
          },
        },
      ];
    },
    renderHTML({ node }) {
      return ['div', { 'data-block': name, 'data-attrs': JSON.stringify(node.attrs) }];
    },
    addNodeView() {
      return ReactNodeViewRenderer(view);
    },
  });
}

export function editorExtensions(view: ComponentType<ReactNodeViewProps>) {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      blockquote: false,
      listItem: false,
      code: false,
      codeBlock: false,
      strike: false,
      underline: false,
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        protocols: ['http', 'https', 'mailto'],
        HTMLAttributes: { rel: 'noopener', target: null },
      },
    }),
    Blockquote.extend({ content: 'paragraph+' }),
    ListItem.extend({ content: 'paragraph (paragraph | bulletList | orderedList)*' }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader.extend({ content: 'paragraph+' }),
    TableCell.extend({ content: 'paragraph+' }),
    Placeholder.configure({ placeholder: 'Start writing. Use H2 for section headings.' }),
    ...(Object.keys(SPECIAL_DEFAULTS) as SpecialKind[]).map((name) => special(name, view)),
  ];
}
```

### `src/components/site/ArticleView.tsx`

```tsx
import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { CloudImage } from '@/components/media/CloudImage';
import type { Doc } from '@/lib/doc/schema';
import { formatWib } from '@/lib/time';
import { ArticleBody, type ArticleLinks, type ArticleMedia, BODY_IMAGE_SIZES } from '@/modules/content/ArticleBody';
import type { ArticleType, Source } from '@/modules/editor/input';
import { articleDateLine, kickerFor } from '@/modules/site/format';
import type { SiteImage, SitePerson, SiteSection } from '@/modules/site/types';
import styles from './site.module.css';
import { Avatar, KickerLabel } from './Stories';

// The article as readers see it (locked preview: .art, .art-head, .byline, .lead-fig, .body, .tags).
// The public article page and the Newsroom preview both render this, so the preview is the real thing.

export type ArticleViewData = {
  title: string;
  standfirst: string;
  type: ArticleType;
  kicker: string;
  isBreaking: boolean;
  section: SiteSection | null;
  authors: SitePerson[];
  publishedAt: string | null;
  updatedAt: string | null;
  readingMinutes: number;
  lead: SiteImage | null;
  leadCaption: string;
  body: Doc;
  links: ArticleLinks;
  media: ArticleMedia;
  sources: Source[];
  tags: { name: string; slug: string }[];
};

export function ArticleView({
  article,
  id,
  linked,
  dateLine,
  actions,
  rail,
}: {
  article: ArticleViewData;
  /** id of the article element, the skip link's target. */
  id?: string;
  /** Link the section, authors and tags (the site); the Newsroom preview shows them as text. */
  linked: boolean;
  /** Replaces the published date line (the preview of an unpublished article). */
  dateLine?: string;
  actions?: ReactNode;
  rail?: ReactNode;
}) {
  const sectionKicker = article.section ? kickerFor({ ...article, kicker: '', isBreaking: false, type: 'news' }) : null;
  const ownKicker = kickerFor({ ...article, section: null });
  const writers = article.authors;
  const lead = article.lead;

  return (
    <div className={`${styles.art} ${rail ? '' : styles.artSolo}`}>
      <article id={id} tabIndex={-1}>
        <header className={styles.artHead}>
          <p className={styles.kickers}>
            {sectionKicker &&
              (linked && article.section ? (
                <Link href={`/${article.section.slug}`}>
                  <KickerLabel kicker={sectionKicker} />
                </Link>
              ) : (
                <KickerLabel kicker={sectionKicker} />
              ))}
            {ownKicker && ownKicker.text !== sectionKicker?.text && <KickerLabel kicker={ownKicker} />}
          </p>
          <h1 className={styles.h1}>{article.title || 'Untitled'}</h1>
          {article.standfirst && <p className={styles.stand}>{article.standfirst}</p>}
        </header>
        <div className={styles.byline}>
          {writers[0] && <Avatar person={writers[0]} size={40} />}
          <div>
            <p className={styles.who}>
              {writers.length ? 'By ' : <span>No author yet</span>}
              {writers.map((writer, index) => (
                <Fragment key={writer.slug || writer.name}>
                  {index > 0 && (index === writers.length - 1 ? ' and ' : ', ')}
                  {linked && writer.slug ? (
                    <Link href={`/author/${writer.slug}`}>
                      <b>{writer.name}</b>
                    </Link>
                  ) : (
                    <b>{writer.name}</b>
                  )}
                </Fragment>
              ))}
              {writers.length === 1 && writers[0].role && <span>, {writers[0].role}</span>}
            </p>
            <p className={styles.meta}>
              {dateLine ??
                (article.publishedAt ? (
                  <time dateTime={article.publishedAt}>{articleDateLine(article.publishedAt, article.updatedAt, article.readingMinutes)}</time>
                ) : (
                  'Not published yet'
                ))}
            </p>
          </div>
          {actions}
        </div>
        {lead && (
          <figure className={styles.leadFig}>
            <CloudImage image={lead} alt={lead.alt} preset="card" sizes={BODY_IMAGE_SIZES} priority />
            {(article.leadCaption || lead.credit) && (
              <figcaption className={styles.cap}>
                {article.leadCaption}
                {article.leadCaption && lead.credit && ' '}
                {lead.credit && <span className={styles.credit}>Photo: {lead.credit}</span>}
              </figcaption>
            )}
          </figure>
        )}
        <ArticleBody doc={article.body} links={article.links} media={article.media} />
        {article.sources.length > 0 && (
          <section className={styles.sources} aria-label="Sources">
            <h2>Sources</h2>
            <ol>
              {article.sources.map((source, index) => (
                <li key={index}>
                  {/^https?:\/\//i.test(source.url) ? (
                    <a href={source.url} rel="noopener">
                      {source.title}
                    </a>
                  ) : (
                    source.title
                  )}
                  {source.publisher && `, ${source.publisher}`}
                  {source.accessed && ` (accessed ${formatWib(`${source.accessed}T00:00:00+07:00`, 'date')})`}
                </li>
              ))}
            </ol>
          </section>
        )}
        {article.tags.length > 0 && (
          <ul className={styles.tags} aria-label="Tags">
            {article.tags.map((tag) => (
              <li key={tag.slug}>
                {linked ? (
                  <Link className={styles.tag} href={`/tag/${tag.slug}`}>
                    {tag.name}
                  </Link>
                ) : (
                  <span className={styles.tag}>{tag.name}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </article>
      {rail && (
        <aside className={styles.rail} aria-label="Related">
          {rail}
        </aside>
      )}
    </div>
  );
}
```

### `src/components/site/ListView.tsx`

```tsx
import { notFound } from 'next/navigation';
import { missing } from '@/modules/site/missing';
import { getList, PAGE_SIZE } from '@/modules/site/queries';
import type { ListKind, ListSubject } from '@/modules/site/types';
import { Pager } from './Pager';
import { SitePage } from './SitePage';
import styles from './site.module.css';
import { Avatar, RowStory } from './Stories';

// Section, author and tag pages: a heading for the subject, then its articles newest first, 24 a page.

const BASE: Record<Exclude<ListKind, 'latest'>, (slug: string) => string> = {
  section: (slug) => `/${slug}`,
  author: (slug) => `/author/${slug}`,
  tag: (slug) => `/tag/${slug}`,
};

export async function ListView({ kind, slug, page }: { kind: Exclude<ListKind, 'latest'>; slug: string; page: number }) {
  const base = BASE[kind](slug);
  const list = await getList(kind, slug, page);
  if (!list) return missing(page > 1 ? `${base}/page/${page}` : base);
  if (page > 1 && list.rows.length === 0) notFound();
  const subject = list.subject as ListSubject;

  return (
    <SitePage page={`${kind}-${slug}-${page}`} active={kind === 'section' ? slug : undefined} current={kind === 'section' && page === 1}>
      <div className={styles.wrap}>
        <header className={styles.pageHead}>
          {kind === 'author' ? (
            <div className={styles.profile}>
              <Avatar person={{ name: subject.name, photo: subject.photo ?? null }} size={96} />
              <div className={styles.rowText}>
                <h1 className={styles.h1}>{subject.name}</h1>
                {subject.role && <p className={styles.meta}>{subject.role}</p>}
              </div>
            </div>
          ) : (
            <>
              {kind === 'tag' && <span className={`${styles.kicker} ${styles.kickerPlain}`}>Tag</span>}
              <h1 className={styles.h1}>{subject.name}</h1>
            </>
          )}
          {(subject.bio || subject.description) && <p className={styles.stand}>{subject.bio || subject.description}</p>}
          {kind === 'author' && subject.links && subject.links.length > 0 && (
            <ul className={styles.profileLinks} aria-label="Elsewhere">
              {subject.links.map((link) => (
                <li key={link.url}>
                  <a href={link.url} rel="noopener me">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </header>
        <p className={styles.count}>
          {list.total === 0 ? 'No articles yet.' : `${list.total.toLocaleString('en-GB')} ${list.total === 1 ? 'article' : 'articles'}`}
          {page > 1 && ` · page ${page}`}
        </p>
        {list.rows.length > 0 && (
          <ul className={styles.rows}>
            {list.rows.map((card) => (
              <li key={card.id}>
                <RowStory card={card} hideSection={kind === 'section'} />
              </li>
            ))}
          </ul>
        )}
        <Pager base={base} page={page} total={list.total} size={PAGE_SIZE} />
      </div>
    </SitePage>
  );
}
```

### `src/components/site/Pager.tsx`

```tsx
import Link from 'next/link';
import styles from './site.module.css';

/** Newer and older pages of a list. Page 1 is the list's own address; later pages are `{base}/page/{n}`. */
export function Pager({ base, page, total, size }: { base: string; page: number; total: number; size: number }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return null;
  const href = (n: number) => (n <= 1 ? base || '/' : `${base}/page/${n}`);
  return (
    <nav className={styles.pager} aria-label="Pages">
      {page > 1 ? <Link href={href(page - 1)}>Newer articles</Link> : <span />}
      <span>
        Page {page} of {pages}
      </span>
      {page < pages ? <Link href={href(page + 1)}>Older articles</Link> : <span />}
    </nav>
  );
}
```

### `src/components/site/SearchForm.tsx`

```tsx
import { Button } from '@/components/ds/Button';
import styles from './site.module.css';

/** A plain GET form to /search (no JavaScript). The label wraps the field, so no id is needed. */
export function SearchForm({ query = '' }: { query?: string }) {
  return (
    <form className={styles.searchForm} action="/search" method="get" role="search">
      <label>
        <span className="sr-only">Search PressCompass</span>
        <input className={styles.input} type="search" name="q" defaultValue={query} placeholder="Search articles" maxLength={200} />
      </label>
      <Button type="submit" variant="primary">
        Search
      </Button>
    </form>
  );
}
```

### `src/components/site/ShareButtons.tsx`

```tsx
'use client';

import { useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ds/Button';
import styles from './site.module.css';

// Share (the device's share sheet, where there is one) and Copy link, next to the byline.

const noop = () => () => {};

export function ShareButtons({ title }: { title: string }) {
  const canShare = useSyncExternalStore(noop, () => typeof navigator.share === 'function', () => false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={styles.actions}>
      <span className={styles.copied} role="status">
        {copied ? 'Link copied' : ''}
      </span>
      {canShare && (
        <Button variant="quiet" icon="external" aria-label="Share" onClick={() => void navigator.share({ title, url: window.location.href }).catch(() => {})} />
      )}
      <Button variant="quiet" icon="link" aria-label="Copy link" onClick={() => void copy()} />
    </div>
  );
}
```

### `src/components/site/SiteFooter.tsx`

```tsx
import Link from 'next/link';
import { Logo } from '@/components/ds/Logo';
import { getSections, todayLine } from '@/modules/site/queries';
import styles from './site.module.css';
import { ThemeSwitch } from './ThemeSwitch';

// Navy footer (paper-sunken in dark mode). Its text becomes editable in Plan 5; columns without content
// (pages, newsletters, RSS) appear once those exist.

const ABOUT = 'Independent, English-language news about Indonesia. Facts verified, context explained.';

export async function SiteFooter() {
  const [sections, today] = await Promise.all([getSections(), todayLine()]);
  const year = today.slice(-4);
  return (
    <footer className={styles.foot}>
      <div className={styles.wrap}>
        <div className={styles.footTop}>
          <div>
            <Logo height={30} tone="inverse" className={styles.footLogo} />
            <p className={styles.footAbout}>{ABOUT}</p>
          </div>
          <div>
            <h2 className={styles.footHead}>Sections</h2>
            <ul>
              {sections
                .filter((section) => section.inNav)
                .map((section) => (
                  <li key={section.slug}>
                    <Link href={`/${section.slug}`}>{section.name}</Link>
                  </li>
                ))}
            </ul>
          </div>
          <div>
            <h2 className={styles.footHead}>PressCompass</h2>
            <ul>
              <li>
                <Link href="/">Front page</Link>
              </li>
              <li>
                <Link href="/search">Search</Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className={styles.footHead}>Theme</h2>
            <ThemeSwitch />
          </div>
        </div>
        <div className={styles.footBot}>
          <span>© {year} PressCompass · presscompass.site</span>
        </div>
      </div>
    </footer>
  );
}
```

### `src/components/site/SiteHeader.tsx`

```tsx
import Link from 'next/link';
import { Button, ButtonLink } from '@/components/ds/Button';
import { Logo } from '@/components/ds/Logo';
import { formatWib } from '@/lib/time';
import { articleHref } from '@/modules/site/format';
import { getLatestStrip, getSections, todayLine } from '@/modules/site/queries';
import { SearchForm } from './SearchForm';
import styles from './site.module.css';

// Utility bar with the date, masthead, section navigation and the Latest strip (locked preview header).
// The section menu on the left is a popover: it opens and closes without JavaScript.
//
// `page` makes element ids unique per page: Next keeps recently visited pages in the DOM (hidden), so a fixed
// id would make the menu button open another page's menu.

export async function SiteHeader({ page, active, current = false }: { page: string; active?: string; current?: boolean }) {
  const [sections, latest, today] = await Promise.all([getSections(), getLatestStrip(), todayLine()]);
  const nav = sections.filter((section) => section.inNav);
  const menu = `menu-${page}`;
  const mark = (slug: string) => (slug === active ? (current ? 'page' : 'true') : undefined);

  return (
    <header>
      <a className={styles.skip} href={`#main-${page}`}>
        Skip to content
      </a>
      <div className={styles.util}>
        <div className={`${styles.wrap} ${styles.utilInner}`}>
          <span className={styles.date}>{today}</span>
        </div>
      </div>
      <div className={styles.masthead}>
        <div className={`${styles.wrap} ${styles.mastInner}`}>
          <Button variant="quiet" icon="menu" aria-label="Menu" popoverTarget={menu} className={styles.mastLeft} />
          <Link href="/" className={styles.logoLink} aria-label="PressCompass home">
            <Logo height={36} label="" className={styles.logo} />
          </Link>
          <div className={styles.mastRight}>
            <ButtonLink href="/search" variant="quiet" icon="search" aria-label="Search" />
          </div>
        </div>
      </div>
      {nav.length > 0 && (
        <nav className={styles.nav} aria-label="Sections">
          <ul>
            {nav.map((section) => (
              <li key={section.slug}>
                <Link href={`/${section.slug}`} aria-current={mark(section.slug)}>
                  {section.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      {latest.rows.length > 0 && (
        <section className={styles.latest} aria-label="Latest">
          <div className={`${styles.wrap} ${styles.latestInner}`}>
            <span className={styles.latestLabel}>
              <span className={styles.dot} aria-hidden="true" />
              Latest
            </span>
            <ul>
              {latest.rows.map((card) => (
                <li key={card.id}>
                  <time dateTime={card.publishedAt}>{formatWib(card.publishedAt, 'time')}</time>
                  <Link href={articleHref(card)}>{card.title}</Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
      <div id={menu} popover="auto" className={styles.menu} aria-label="Menu">
        <div className={styles.menuTop}>
          <p className={styles.menuTitle}>Sections</p>
          <Button variant="quiet" icon="x" aria-label="Close menu" popoverTarget={menu} popoverTargetAction="hide" />
        </div>
        <ul className={styles.menuList}>
          <li>
            <Link href="/">Front page</Link>
          </li>
          {sections.map((section) => (
            <li key={section.slug}>
              <Link href={`/${section.slug}`} aria-current={mark(section.slug)}>
                {section.name}
              </Link>
            </li>
          ))}
        </ul>
        <SearchForm />
      </div>
    </header>
  );
}
```

### `src/components/site/SitePage.tsx`

```tsx
import type { ReactNode } from 'react';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

/**
 * Header, main and footer of a public page. `page` is a key unique to this page (used for element ids,
 * see SiteHeader); `active` marks a section in the navigation, `current` when this page is that section.
 */
export function SitePage({ page, active, current, children }: { page: string; active?: string; current?: boolean; children: ReactNode }) {
  return (
    <>
      <SiteHeader page={page} active={active} current={current} />
      <main id={`main-${page}`} tabIndex={-1}>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
```

### `src/components/site/Stories.tsx`

```tsx
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CloudImage } from '@/components/media/CloudImage';
import { articleHref, cardMeta, initials, type Kicker, kickerFor } from '@/modules/site/format';
import type { Card, SitePerson } from '@/modules/site/types';
import styles from './site.module.css';

// Story teasers in the shapes of the locked preview: lead, top story, card, opinion and list row.
// Teaser images are decorative (alt=""): the headline already names the link.

type Heading = 'h1' | 'h2' | 'h3';

export function KickerLabel({ kicker }: { kicker: Kicker }) {
  if (!kicker) return null;
  const tone = kicker.tone === 'live' ? styles.kickerLive : kicker.tone === 'plain' ? styles.kickerPlain : '';
  return (
    <span className={`${styles.kicker} ${tone}`}>
      {kicker.tone === 'live' && <span className={styles.dot} aria-hidden="true" />}
      {kicker.text}
    </span>
  );
}

export function Avatar({ person, size }: { person: Pick<SitePerson, 'name' | 'photo'>; size: number }) {
  return (
    <span className={styles.avatar} aria-hidden="true">
      {person.photo ? <CloudImage image={person.photo} alt="" preset="square" sizes={`${size}px`} /> : initials(person.name)}
    </span>
  );
}

function Headline({ as: Tag, className, children }: { as: Heading; className: string; children: ReactNode }) {
  return <Tag className={`${className} ${styles.hl}`}>{children}</Tag>;
}

/** The front page lead: wide image, display headline, standfirst. Its image is the page's LCP element. */
export function LeadStory({ card }: { card: Card }) {
  return (
    <Link className={`${styles.story} ${styles.lead}`} href={articleHref(card)}>
      {card.lead && (
        <CloudImage
          image={card.lead}
          alt=""
          preset="hero"
          sizes="(max-width: 1024px) 100vw, 800px"
          priority
          className={`${styles.ph} ${styles.phWide}`}
        />
      )}
      <KickerLabel kicker={kickerFor(card)} />
      <Headline as="h1" className={styles.display}>
        {card.title}
      </Headline>
      {card.standfirst && <p className={styles.stand}>{card.standfirst}</p>}
      <p className={styles.meta}>{cardMeta(card, { minutes: true })}</p>
    </Link>
  );
}

/** A headline in a list without an image (Top stories, Related). */
export function TopStory({ card, as = 'h3' }: { card: Card; as?: Heading }) {
  return (
    <Link className={styles.story} href={articleHref(card)}>
      <KickerLabel kicker={kickerFor(card)} />
      <Headline as={as} className={styles.h4}>
        {card.title}
      </Headline>
      <p className={styles.meta}>{cardMeta(card)}</p>
    </Link>
  );
}

/** A card with a 3:2 image; with `standfirst` it also shows the standfirst (More from …). */
export function CardStory({ card, standfirst = false, hideSection = false, as = 'h3' }: { card: Card; standfirst?: boolean; hideSection?: boolean; as?: Heading }) {
  return (
    <Link className={styles.story} href={articleHref(card)}>
      {card.lead ? (
        <CloudImage image={card.lead} alt="" preset="card" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 300px" className={styles.ph} />
      ) : (
        <span className={styles.ph} aria-hidden="true" />
      )}
      <KickerLabel kicker={kickerFor(card, { hideSection })} />
      <Headline as={as} className={styles.h3}>
        {card.title}
      </Headline>
      {standfirst && card.standfirst && <p className={styles.standSm}>{card.standfirst}</p>}
      <p className={styles.meta}>{cardMeta(card)}</p>
    </Link>
  );
}

/** An opinion piece: the writer first, the headline in italics. */
export function OpinionStory({ card }: { card: Card }) {
  const writer = card.authors[0];
  return (
    <Link className={styles.op} href={articleHref(card)}>
      {writer ? <Avatar person={writer} size={48} /> : <span />}
      <div>
        {writer && (
          <p className={styles.opName}>
            {writer.name}
            {writer.role && <span> · {writer.role}</span>}
          </p>
        )}
        <h3 className={styles.opHl}>{card.title}</h3>
      </div>
    </Link>
  );
}

/** A row in a list page: text first, image on the right. */
export function RowStory({ card, hideSection = false }: { card: Card; hideSection?: boolean }) {
  return (
    <Link className={styles.row} href={articleHref(card)}>
      <div className={styles.rowText}>
        <KickerLabel kicker={kickerFor(card, { hideSection })} />
        <Headline as="h2" className={styles.h3}>
          {card.title}
        </Headline>
        {card.standfirst && <p className={styles.standSm}>{card.standfirst}</p>}
        <p className={styles.meta}>{cardMeta(card, { minutes: true })}</p>
      </div>
      {card.lead ? <CloudImage image={card.lead} alt="" preset="card" sizes="(max-width: 640px) 96px, 240px" className={styles.ph} /> : <span />}
    </Link>
  );
}
```

### `src/components/site/ThemeSwitch.tsx`

```tsx
'use client';

import { useSyncExternalStore } from 'react';
import styles from './site.module.css';
import { THEME_KEY as KEY } from './theme';

// Auto (follow the device), Light or Dark. The choice is kept in localStorage and applied before the
// first paint by THEME_SCRIPT (./theme.ts) in the root layout, so the page never flashes the wrong theme.

type Theme = 'auto' | 'light' | 'dark';
const EVENT = 'pc-theme-change';
const OPTIONS: { value: Theme; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

function read(): Theme {
  const value = document.documentElement.getAttribute('data-theme');
  return value === 'light' || value === 'dark' ? value : 'auto';
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

function choose(theme: Theme) {
  if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
  try {
    if (theme === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // Storage can be blocked (private windows); the choice then lasts until the page is closed.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function ThemeSwitch() {
  const theme = useSyncExternalStore(subscribe, read, () => 'auto' as Theme);
  return (
    <div className={styles.theme} role="group" aria-label="Theme">
      {OPTIONS.map((option) => (
        <button key={option.value} type="button" aria-pressed={theme === option.value} onClick={() => choose(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}
```

### `src/components/site/site.module.css`

```css
/* Public site layout, ported from the locked preview (presscompass-preview.html). Tokens only. */

.wrap {
  max-width: var(--container);
  margin: 0 auto;
  padding: 0 var(--space-5);
}

.skip {
  position: absolute;
  left: 8px;
  top: -80px;
  z-index: 20;
  padding: 8px 12px;
  background: var(--navy);
  color: var(--on-navy);
  font: 500 14px/20px var(--font-sans);
  text-decoration: none;
}

.skip:focus {
  top: 8px;
}

/* ------------------------------------------------------------ header */

.util {
  border-bottom: 1px solid var(--line);
}

.utilInner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 48px;
}

.date {
  font: 400 13px/20px var(--font-mono);
  color: var(--ink-muted);
}

.mastInner {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  height: 88px;
}

.mastLeft {
  justify-self: start;
}

.mastRight {
  justify-self: end;
  display: flex;
  gap: 4px;
}

.logoLink {
  display: block;
  color: var(--ink);
}

.logo {
  display: block;
  height: 36px;
  width: auto;
}

.nav {
  border-top: 1px solid var(--line);
  border-bottom: var(--rule-heavy) solid var(--ink);
}

.nav ul {
  list-style: none;
  margin: 0 auto;
  padding: 0 var(--space-5);
  max-width: var(--container);
  display: flex;
  justify-content: center;
  gap: 28px;
  overflow-x: auto;
  scrollbar-width: none;
}

.nav a {
  display: block;
  padding: 12px 0 10px;
  font: 500 15px/22px var(--font-sans);
  color: var(--ink-secondary);
  text-decoration: none;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
}

.nav a:hover {
  color: var(--ink);
}

.nav a[aria-current] {
  color: var(--ink);
  border-bottom-color: var(--compass);
}

.latest {
  border-bottom: 1px solid var(--line);
  background: var(--paper-raised);
}

.latestInner {
  display: flex;
  align-items: stretch;
  overflow: hidden;
}

.latestLabel {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
  padding: 0 16px;
  background: var(--compass-soft);
  color: var(--compass);
  font: 600 12px/16px var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.dot {
  width: 8px;
  height: 8px;
  flex: none;
  border-radius: var(--radius-full);
  background: var(--compass);
}

.latest ul {
  display: flex;
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow: hidden;
}

.latest li {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  padding: 11px 16px;
  border-right: 1px solid var(--line);
  white-space: nowrap;
}

.latest time {
  font: 500 13px/20px var(--font-mono);
  color: var(--compass);
}

.latest a {
  overflow: hidden;
  text-overflow: ellipsis;
  font: 500 15px/20px var(--font-sans);
  text-decoration: none;
}

.latest a:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* Menu panel (popover, no JavaScript) */
.menu {
  position: fixed;
  inset: 0 auto 0 0;
  width: min(360px, 100vw);
  height: 100dvh;
  max-height: none;
  margin: 0;
  padding: var(--space-5);
  border: 0;
  border-right: 1px solid var(--line);
  background: var(--paper);
  color: var(--ink);
  box-shadow: var(--shadow-lg);
  overflow-y: auto;
}

.menu::backdrop {
  background: rgb(15 30 51 / 0.4);
}

.menuTop {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-5);
}

.menuTitle {
  font: 600 12px/16px var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-muted);
}

.menuList {
  list-style: none;
  margin: 0 0 var(--space-6);
  padding: 0;
}

.menuList a {
  display: block;
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
  font: 500 17px/24px var(--font-sans);
  text-decoration: none;
}

.menuList a:hover,
.menuList a[aria-current] {
  color: var(--compass);
}

/* ------------------------------------------------------------ editorial type */

.kicker {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font: 600 12px/16px var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--meridian);
}

.kickerLive {
  color: var(--compass);
}

.kickerPlain {
  color: var(--ink-muted);
}

.meta {
  font: 400 13px/20px var(--font-mono);
  color: var(--ink-muted);
}

.display,
.h1,
.h2,
.h3,
.h4 {
  overflow-wrap: break-word;
}

.display {
  font: 500 clamp(34px, 4.4vw, 56px) / 1.07 var(--font-serif);
  letter-spacing: -0.015em;
  font-variation-settings: 'opsz' 72;
  text-wrap: balance;
}

.h1 {
  font: 500 clamp(32px, 3.6vw, 44px) / 1.12 var(--font-serif);
  letter-spacing: -0.01em;
  font-variation-settings: 'opsz' 60;
  text-wrap: balance;
}

.h2 {
  font: 500 30px/36px var(--font-serif);
  letter-spacing: -0.005em;
  font-variation-settings: 'opsz' 48;
}

.h3 {
  font: 600 22px/28px var(--font-serif);
  font-variation-settings: 'opsz' 24;
  text-wrap: balance;
}

.h4 {
  font: 600 19px/25px var(--font-serif);
  font-variation-settings: 'opsz' 20;
  text-wrap: balance;
}

.stand {
  font: 400 21px/31px var(--font-serif);
  font-variation-settings: 'opsz' 24;
  color: var(--ink-secondary);
  text-wrap: pretty;
}

.standSm {
  font: 400 16px/24px var(--font-serif);
  font-variation-settings: 'opsz' 18;
  color: var(--ink-secondary);
}

.story {
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: inherit;
  text-decoration: none;
}

.story:hover .hl {
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 4px;
}

.ph {
  display: block;
  width: 100%;
  height: auto;
  background: var(--paper-sunken);
  aspect-ratio: 3 / 2;
  object-fit: cover;
}

.phWide {
  aspect-ratio: 16 / 9;
}

/* ------------------------------------------------------------ front page */

.leadGrid {
  display: grid;
  grid-template-columns: minmax(0, 8fr) minmax(0, 4fr);
  gap: var(--space-6);
  padding-top: var(--space-6);
}

.lead {
  gap: 16px;
}

.lead .ph {
  margin-bottom: 8px;
}

.railTop {
  border-left: 1px solid var(--line);
  padding-left: var(--space-6);
}

.railTitle {
  margin: 0;
  padding-top: 12px;
  border-top: var(--rule-heavy) solid var(--ink);
  font: 600 12px/16px var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink);
}

.toplist {
  margin: 0;
  padding: 0;
  list-style: none;
}

.toplist li {
  border-bottom: 1px solid var(--line);
}

.toplist .story {
  gap: 6px;
  padding: 16px 0;
}

.sec {
  padding-top: var(--space-7);
}

.secHead {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: baseline;
  gap: 4px 16px;
  margin-bottom: var(--space-5);
  padding-top: 12px;
  border-top: var(--rule-heavy) solid var(--ink);
}

.secHead > * {
  min-width: 0;
  overflow-wrap: anywhere;
}

.more {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font: 500 14px/20px var(--font-sans);
  color: var(--link);
  text-decoration: none;
}

.more:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.cards4 {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-5);
}

.cards3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-5);
}

.ops {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-5);
}

.op {
  display: grid;
  grid-template-columns: 48px 1fr;
  gap: 16px;
  align-items: start;
  padding-bottom: var(--space-5);
  border-bottom: 1px solid var(--line);
  color: inherit;
  text-decoration: none;
}

.opName {
  margin: 0 0 6px;
  font: 600 13px/18px var(--font-sans);
}

.opName span {
  font-weight: 400;
  color: var(--ink-secondary);
}

.opHl {
  font: italic 400 22px/29px var(--font-serif);
  font-variation-settings: 'opsz' 28;
  text-wrap: balance;
}

.op:hover .opHl {
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 4px;
}

.avatar {
  display: grid;
  place-items: center;
  flex: none;
  width: 48px;
  height: 48px;
  overflow: hidden;
  border-radius: var(--radius-full);
  background: var(--meridian-soft);
  color: var(--meridian);
  font: 500 15px/1 var(--font-mono);
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.empty {
  padding: var(--space-8) 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
}

.empty p {
  max-width: 520px;
  color: var(--ink-secondary);
}

/* ------------------------------------------------------------ lists (section, author, tag, search) */

.pageHead {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: var(--space-7) 0 var(--space-5);
  border-bottom: var(--rule-heavy) solid var(--ink);
}

.pageHead .stand {
  max-width: 760px;
}

.profile {
  display: flex;
  gap: var(--space-5);
  align-items: center;
}

.profile .avatar {
  width: 96px;
  height: 96px;
  font-size: 24px;
}

.profileLinks {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.profileLinks a {
  font: 500 14px/20px var(--font-sans);
  color: var(--link);
}

.rows {
  margin: 0;
  padding: 0;
  list-style: none;
}

.rows > li {
  border-bottom: 1px solid var(--line);
}

.row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 240px;
  gap: var(--space-5);
  padding: var(--space-5) 0;
  color: inherit;
  text-decoration: none;
}

.row:hover .hl {
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 4px;
}

.rowText {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.count {
  padding: var(--space-4) 0 0;
  font: 400 13px/20px var(--font-mono);
  color: var(--ink-muted);
}

.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: var(--space-5) 0;
  font: 400 13px/20px var(--font-mono);
  color: var(--ink-muted);
}

.pager a {
  font: 500 14px/20px var(--font-sans);
  color: var(--link);
}

.searchForm {
  display: flex;
  gap: 8px;
  max-width: 640px;
}

.searchForm label {
  flex: 1;
  min-width: 0;
}

.input {
  width: 100%;
  height: 44px;
  padding: 8px 12px;
  font: 400 16px/22px var(--font-sans);
  color: var(--ink);
  background: var(--paper-raised);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
}

.input::placeholder {
  color: var(--ink-muted);
}

.input:hover {
  border-color: var(--ink-secondary);
}

/* ------------------------------------------------------------ article */

.art {
  display: grid;
  grid-template-columns: minmax(0, 680px) 300px;
  gap: var(--space-8);
  justify-content: center;
  padding-top: var(--space-7);
}

.artSolo {
  grid-template-columns: minmax(0, 680px);
}

.artHead {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: var(--space-5);
}

.kickers {
  display: flex;
  gap: 12px;
  align-items: center;
}

.kickers a {
  text-decoration: none;
}

.byline {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: var(--space-6);
  padding: 14px 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.byline .avatar {
  width: 40px;
  height: 40px;
  font-size: 13px;
}

.who {
  font: 400 13px/18px var(--font-sans);
}

.who b {
  font-weight: 600;
}

.who a {
  text-decoration: none;
}

.who a:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.who span {
  color: var(--ink-secondary);
}

.actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.copied {
  font: 500 13px/18px var(--font-sans);
  color: var(--success);
}

.leadFig {
  margin: 0 0 var(--space-6);
}

.leadFig img {
  display: block;
  width: 100%;
  height: auto;
  background: var(--paper-sunken);
}

.cap {
  margin-top: 8px;
  font: 400 13px/18px var(--font-sans);
  color: var(--ink-secondary);
}

.credit {
  color: var(--ink-muted);
}

.sources {
  margin-top: var(--space-6);
  padding-top: var(--space-4);
  border-top: 1px solid var(--line);
  font: 400 14px/21px var(--font-sans);
  color: var(--ink-secondary);
}

.sources h2 {
  margin-bottom: var(--space-2);
  font: 600 12px/16px var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink);
}

.sources ol {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-left: 20px;
}

.sources a {
  color: var(--link);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 20px 0 0;
  padding: 0;
  list-style: none;
}

.tag {
  display: block;
  padding: 5px 10px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
  font: 500 14px/20px var(--font-sans);
  color: var(--ink-secondary);
  text-decoration: none;
}

.tag:hover {
  color: var(--ink);
  border-color: var(--ink);
}

.rail {
  position: sticky;
  top: 56px;
  align-self: start;
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

/* ------------------------------------------------------------ footer */

.foot {
  --f-bg: var(--navy);
  --f-ink: var(--on-navy);
  --f-rule: rgb(246 244 239 / 0.2);
  margin-top: var(--space-9);
  padding: var(--space-7) 0 var(--space-5);
  background: var(--f-bg);
  color: var(--f-ink);
}

:global([data-theme='dark']) .foot {
  --f-bg: var(--paper-sunken);
  --f-ink: var(--ink);
  --f-rule: var(--line);
  border-top: var(--rule-heavy) solid var(--ink);
}

@media (prefers-color-scheme: dark) {
  :global(:root:not([data-theme])) .foot {
    --f-bg: var(--paper-sunken);
    --f-ink: var(--ink);
    --f-rule: var(--line);
    border-top: var(--rule-heavy) solid var(--ink);
  }
}

.footTop {
  display: grid;
  grid-template-columns: minmax(0, 4fr) repeat(2, minmax(0, 2fr)) minmax(0, 3fr);
  gap: var(--space-5);
}

.footLogo {
  display: block;
  height: 30px;
  width: auto;
}

.footAbout {
  max-width: 340px;
  margin-top: 16px;
  opacity: 0.85;
}

.footHead {
  margin: 4px 0 12px;
  font: 600 12px/16px var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.75;
}

.foot ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.foot a {
  text-decoration: none;
}

.foot a:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.footBot {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: var(--space-7);
  padding-top: var(--space-4);
  border-top: 1px solid var(--f-rule);
  font: 400 13px/20px var(--font-mono);
  opacity: 0.8;
}

.theme {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--f-rule);
  border-radius: var(--radius-sm);
}

.theme button {
  min-height: 36px;
  padding: 0 12px;
  border: 0;
  border-radius: calc(var(--radius-sm) - 1px);
  background: transparent;
  color: var(--f-ink);
  font: 500 14px/20px var(--font-sans);
  cursor: pointer;
}

.theme button[aria-pressed='true'] {
  background: var(--f-ink);
  color: var(--f-bg);
}

/* ------------------------------------------------------------ responsive */

@media (max-width: 1024px) {
  .leadGrid {
    grid-template-columns: minmax(0, 1fr);
  }

  .railTop {
    border-left: 0;
    padding-left: 0;
  }

  .cards4 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .cards3,
  .ops {
    grid-template-columns: minmax(0, 1fr);
  }

  .art {
    grid-template-columns: minmax(0, 680px);
  }

  .rail {
    position: static;
  }

  .footTop {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .wrap {
    padding: 0 16px;
  }

  .mastInner {
    height: 64px;
  }

  .logo {
    height: 26px;
  }

  .nav ul {
    justify-content: flex-start;
    gap: 20px;
    padding: 0 16px;
  }

  .cards4 {
    grid-template-columns: minmax(0, 1fr);
  }

  .latest li:nth-child(n + 2) {
    display: none;
  }

  .stand {
    font-size: 19px;
    line-height: 28px;
  }

  .row {
    grid-template-columns: minmax(0, 1fr) 96px;
    gap: 16px;
  }

  .row .ph {
    aspect-ratio: 1;
  }

  .row .standSm {
    display: none;
  }

  .profile {
    align-items: flex-start;
  }

  .profile .avatar {
    width: 64px;
    height: 64px;
    font-size: 18px;
  }

  .footTop {
    grid-template-columns: minmax(0, 1fr);
  }
}

.secLink {
  color: inherit;
  text-decoration: none;
}

.secLink:hover {
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 4px;
}

.pageHeadPlain {
  border-bottom: 0;
}
```

### `src/components/site/theme.ts`

```ts
// The reader's theme choice (Auto, Light, Dark), shared by the footer switch and the root layout.

export const THEME_KEY = 'pc-theme';

/** Runs in <head> before the first paint so the page never flashes the wrong theme. Keep it tiny: it blocks rendering. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;
```

### `src/lib/cron-auth.ts`

```ts
import { createHash, timingSafeEqual } from 'node:crypto';

// Checks `Authorization: Bearer <CRON_SECRET>` on system endpoints (Vercel Cron and Supabase Cron send it).

export const CRON_SECRET_MIN = 32;

export type CronAuth = 'ok' | 'not-configured' | 'denied';

export function checkCronAuth(header: string | null, secret: string | undefined): CronAuth {
  const expected = secret?.trim() ?? '';
  if (expected.length < CRON_SECRET_MIN) return 'not-configured';
  const given = /^Bearer (.+)$/.exec(header ?? '')?.[1] ?? '';
  // Compare digests so the comparison takes the same time whatever the length.
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(given), digest(expected)) ? 'ok' : 'denied';
}

export function cronAuthResponse(result: Exclude<CronAuth, 'ok'>): Response {
  return result === 'not-configured'
    ? Response.json({ ok: false, error: `CRON_SECRET is not set (at least ${CRON_SECRET_MIN} characters).` }, { status: 503 })
    : Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
}
```

### `src/lib/doc/chart.ts`

```ts
// Chart blocks: small bar or line charts the site draws as SVG. The editor takes the data as a table pasted
// from a spreadsheet (first row: column names; first column: labels) and stores it parsed, so the site never
// parses text. Shared by the editor dialog, the sanitizer and the renderer.

export type ChartKind = 'bar' | 'line';
export type ChartSeries = { name: string; values: (number | null)[] };
export type ChartAttrs = {
  kind: ChartKind;
  title: string;
  /** Unit and period, e.g. "Per cent, May–October 2026". */
  subtitle: string;
  source: string;
  /** Name of the label column, e.g. "Month" (read by screen readers). */
  axis: string;
  labels: string[];
  series: ChartSeries[];
};

export const CHART_LIMITS = {
  title: 120,
  subtitle: 120,
  source: 200,
  axis: 40,
  label: 24,
  seriesName: 40,
  minRows: 2,
  maxRows: 24,
  maxSeries: { bar: 2, line: 3 },
} as const;

export const EMPTY_CHART: ChartAttrs = { kind: 'bar', title: '', subtitle: '', source: '', axis: '', labels: [], series: [] };

const MINUS = /[−–]/g;

/** A number from a table cell: `4.1`, `-2`, `−2.0`, `12%`, `12,400` (tab-separated only). Empty or a dash is a gap. */
export function parseCell(cell: string, thousands: boolean): number | null | undefined {
  let value = cell.trim().replace(MINUS, '-').replace(/%$/, '').replace(/\s+/g, '');
  if (value === '' || value === '-') return null;
  if (thousands) value = value.replace(/,(?=\d{3}(\D|$))/g, '');
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(value)) return undefined;
  return Number(value);
}

/** Reads a pasted table. Cells are separated by tabs (copied from a spreadsheet) or, without tabs, by commas. */
export function parseChartTable(text: string, kind: ChartKind): Pick<ChartAttrs, 'axis' | 'labels' | 'series'> | { error: string } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '');
  const tabbed = lines.some((line) => line.includes('\t'));
  const rows = lines.map((line) => line.split(tabbed ? '\t' : ',').map((cell) => cell.trim()));
  const [header, ...data] = rows;
  if (!header || data.length < CHART_LIMITS.minRows) {
    return { error: 'Paste a header row and at least two rows of data: labels in the first column, numbers in the next.' };
  }
  if (data.length > CHART_LIMITS.maxRows) return { error: `Use at most ${CHART_LIMITS.maxRows} rows of data.` };
  const columns = Math.max(...rows.map((row) => row.length)) - 1;
  const max = CHART_LIMITS.maxSeries[kind];
  if (columns < 1 || columns > max) {
    return { error: kind === 'bar' ? 'A bar chart takes one or two columns of numbers.' : 'A line chart takes one to three columns of numbers.' };
  }
  const labels: string[] = [];
  const series: ChartSeries[] = Array.from({ length: columns }, (_, c) => ({
    name: (header[c + 1] ?? '').slice(0, CHART_LIMITS.seriesName) || `Series ${c + 1}`,
    values: [],
  }));
  for (const [r, row] of data.entries()) {
    const label = (row[0] ?? '').slice(0, CHART_LIMITS.label);
    if (!label) return { error: `Row ${r + 2} needs a label in the first column.` };
    labels.push(label);
    for (let c = 0; c < columns; c++) {
      const value = parseCell(row[c + 1] ?? '', tabbed);
      if (value === undefined) return { error: `Row ${r + 2}: "${row[c + 1]}" is not a number.` };
      series[c].values.push(value);
    }
  }
  if (series.some((s) => s.values.every((value) => value === null))) return { error: 'Each column of numbers needs at least one value.' };
  return { axis: (header[0] ?? '').slice(0, CHART_LIMITS.axis), labels, series };
}

/** The stored data as a tab-separated table, for editing. */
export function chartTable(attrs: Pick<ChartAttrs, 'axis' | 'labels' | 'series'>): string {
  if (!attrs.labels.length) return '';
  const header = [attrs.axis || 'Label', ...attrs.series.map((s) => s.name)].join('\t');
  const rows = attrs.labels.map((label, i) => [label, ...attrs.series.map((s) => (s.values[i] === null ? '' : String(s.values[i])))].join('\t'));
  return [header, ...rows].join('\n');
}

const str = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max).trim() : '');

/** Rebuilds chart attributes from anything; null when the data cannot make a chart. Used by the sanitizer. */
export function cleanChart(raw: Record<string, unknown>): ChartAttrs | null {
  const kind: ChartKind = raw.kind === 'line' ? 'line' : 'bar';
  const labels = Array.isArray(raw.labels) ? raw.labels.slice(0, CHART_LIMITS.maxRows).map((label) => str(label, CHART_LIMITS.label)) : [];
  if (labels.length < CHART_LIMITS.minRows || labels.some((label) => !label)) return null;
  const series = (Array.isArray(raw.series) ? raw.series : [])
    .slice(0, CHART_LIMITS.maxSeries[kind])
    .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
    .map((s) => ({
      name: str(s.name, CHART_LIMITS.seriesName),
      values: labels.map((_, i) => {
        const value = Array.isArray(s.values) ? s.values[i] : null;
        return typeof value === 'number' && Number.isFinite(value) ? value : null;
      }),
    }))
    .filter((s) => s.values.some((value) => value !== null));
  if (!series.length) return null;
  return {
    kind,
    title: str(raw.title, CHART_LIMITS.title),
    subtitle: str(raw.subtitle, CHART_LIMITS.subtitle),
    source: str(raw.source, CHART_LIMITS.source),
    axis: str(raw.axis, CHART_LIMITS.axis),
    labels,
    series,
  };
}

/**
 * Axis range and ticks with round steps (1, 2, 2.5, 5 × 10ⁿ). Bars always start at zero; lines may not,
 * so a change from 99 to 88 stays visible.
 */
export function chartScale(values: number[], { zero = true, targetTicks = 4 } = {}): { min: number; max: number; ticks: number[] } {
  const lo = Math.min(...(zero ? [0] : []), ...values);
  let hi = Math.max(...(zero ? [0] : []), ...values);
  if (hi === lo) hi = lo + 1;
  const raw = (hi - lo) / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= raw) ?? 10 * magnitude;
  const round = (n: number) => Math.round(n * 1e9) / 1e9;
  const min = round(Math.floor(lo / step) * step);
  const max = round(Math.ceil(hi / step) * step);
  const ticks: number[] = [];
  for (let tick = min; tick <= max + step / 2; tick += step) ticks.push(round(tick));
  return { min, max, ticks };
}

/** `4.1`, `−2`, `12,400`: chart numbers with a true minus sign. */
export function formatChartNumber(value: number): string {
  const text = Math.abs(value).toLocaleString('en-GB', { maximumFractionDigits: 2 });
  return value < 0 ? `−${text}` : text;
}
```

### `src/lib/doc/sanitize.ts`

```ts
import {
  type Block,
  type Doc,
  EMPTY_DOC,
  type Inline,
  type KeyFigure,
  LIMITS,
  type ListItem,
  type Mark,
  type Paragraph,
  type TableCell,
  type TableRow,
  UUID,
  YOUTUBE_ID,
} from './schema';
import { cleanChart } from './chart';

// Rebuilds an editor document from scratch, keeping only the nodes, marks and attributes in
// schema.ts. Blocks that are not allowed where they appear become paragraphs, so text is not lost;
// empty or invalid special blocks are dropped. Runs on every save, whatever the browser sent.

type Raw = Record<string, unknown>;
type Context = 'doc' | 'quote' | 'item' | 'cell';

const TEXT_MAX = 20_000;
const SAFE_HREF = /^(https?:\/\/|mailto:|\/(?!\/)|#)/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SPECIAL = new Set(['pullQuote', 'editorNote', 'keyFigures', 'youtube', 'readMore', 'image', 'chart']);

const isObject = (value: unknown): value is Raw => typeof value === 'object' && value !== null && !Array.isArray(value);
const kids = (node: Raw): Raw[] => (Array.isArray(node.content) ? node.content.filter(isObject) : []);
const attrs = (node: Raw): Raw => (isObject(node.attrs) ? node.attrs : {});
const text = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max).trim() : '');
const int = (value: unknown, min: number, max: number, fallback: number) =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max ? (value as number) : fallback;
const isInlineNode = (node: Raw) => node.type === 'text' || node.type === 'hardBreak';

function cleanMarks(raw: unknown): Mark[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const marks: Mark[] = [];
  const seen = new Set<string>();
  for (const mark of raw) {
    if (!isObject(mark) || typeof mark.type !== 'string' || seen.has(mark.type)) continue;
    if (mark.type === 'bold' || mark.type === 'italic') {
      marks.push({ type: mark.type });
      seen.add(mark.type);
    } else if (mark.type === 'link') {
      const href = typeof attrs(mark).href === 'string' ? (attrs(mark).href as string).trim() : '';
      if (href.length <= 2000 && SAFE_HREF.test(href)) {
        marks.push({ type: 'link', attrs: { href } });
        seen.add('link');
      }
    }
  }
  return marks.length ? marks : undefined;
}

function cleanInline(nodes: Raw[]): Inline[] {
  const out: Inline[] = [];
  for (const node of nodes) {
    if (node.type === 'text' && typeof node.text === 'string' && node.text.length > 0) {
      const marks = cleanMarks(node.marks);
      out.push(marks ? { type: 'text', text: node.text.slice(0, TEXT_MAX), marks } : { type: 'text', text: node.text.slice(0, TEXT_MAX) });
    } else if (node.type === 'hardBreak') {
      out.push({ type: 'hardBreak' });
    } else {
      out.push(...cleanInline(kids(node)));
    }
  }
  return out;
}

function paragraph(nodes: Raw[]): Paragraph {
  const content = cleanInline(nodes);
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' };
}

function cleanItem(node: Raw): ListItem {
  const content = cleanBlocks(kids(node), 'item') as ListItem['content'];
  if (content[0]?.type !== 'paragraph') content.unshift({ type: 'paragraph' });
  return { type: 'listItem', content };
}

function cleanList(node: Raw): Block | null {
  const items = kids(node)
    .filter((child) => child.type === 'listItem')
    .map(cleanItem);
  if (!items.length) return null;
  if (node.type === 'orderedList') return { type: 'orderedList', attrs: { start: int(attrs(node).start, 1, 100_000, 1) }, content: items };
  return { type: 'bulletList', content: items };
}

function cleanTable(node: Raw): Block | null {
  const rows: TableRow[] = [];
  for (const row of kids(node).filter((child) => child.type === 'tableRow').slice(0, 100)) {
    const cells: TableCell[] = kids(row)
      .filter((cell) => cell.type === 'tableCell' || cell.type === 'tableHeader')
      .slice(0, 20)
      .map((cell) => {
        const content = cleanBlocks(kids(cell), 'cell') as Paragraph[];
        return {
          type: cell.type as TableCell['type'],
          attrs: { colspan: int(attrs(cell).colspan, 1, 20, 1), rowspan: int(attrs(cell).rowspan, 1, 100, 1) },
          content: content.length ? content : [{ type: 'paragraph' }],
        };
      });
    if (cells.length) rows.push({ type: 'tableRow', content: cells });
  }
  return rows.length ? { type: 'table', content: rows } : null;
}

function cleanSpecial(node: Raw): Block | null {
  const a = attrs(node);
  switch (node.type) {
    case 'pullQuote': {
      const quote = text(a.text, LIMITS.pullQuoteText);
      return quote ? { type: 'pullQuote', attrs: { text: quote, attribution: text(a.attribution, LIMITS.attribution) } } : null;
    }
    case 'editorNote': {
      const note = text(a.text, LIMITS.noteText);
      const date = typeof a.date === 'string' && DATE.test(a.date) ? a.date : '';
      return note ? { type: 'editorNote', attrs: { kind: a.kind === 'correction' ? 'correction' : 'update', date, text: note } } : null;
    }
    case 'keyFigures': {
      const items: KeyFigure[] = (Array.isArray(a.items) ? a.items.filter(isObject) : [])
        .map((item) => ({ value: text(item.value, LIMITS.figureValue), label: text(item.label, LIMITS.figureLabel) }))
        .filter((item) => item.value || item.label)
        .slice(0, LIMITS.figuresMax);
      if (!items.length) return null;
      return { type: 'keyFigures', attrs: { title: text(a.title, LIMITS.figuresTitle), items, source: text(a.source, LIMITS.figuresSource) } };
    }
    case 'youtube':
      return typeof a.videoId === 'string' && YOUTUBE_ID.test(a.videoId)
        ? { type: 'youtube', attrs: { videoId: a.videoId, title: text(a.title, LIMITS.videoTitle) } }
        : null;
    case 'readMore':
      return typeof a.articleId === 'string' && UUID.test(a.articleId)
        ? { type: 'readMore', attrs: { articleId: a.articleId.toLowerCase(), title: text(a.title, LIMITS.readMoreTitle) } }
        : null;
    case 'image':
      return typeof a.mediaId === 'string' && UUID.test(a.mediaId)
        ? { type: 'image', attrs: { mediaId: a.mediaId.toLowerCase(), caption: text(a.caption, LIMITS.imageCaption) } }
        : null;
    case 'chart': {
      const chart = cleanChart(a);
      return chart ? { type: 'chart', attrs: chart } : null;
    }
    default:
      return null;
  }
}

function cleanBlocks(nodes: Raw[], context: Context): Block[] {
  const out: Block[] = [];
  for (const node of nodes) {
    const type = node.type;
    const inDoc = context === 'doc';
    if (type === 'paragraph') {
      out.push(paragraph(kids(node)));
    } else if (type === 'heading' && inDoc) {
      const level = Number(attrs(node).level);
      const content = cleanInline(kids(node));
      out.push({ type: 'heading', attrs: { level: level <= 2 ? 2 : 3 }, ...(content.length ? { content } : {}) });
    } else if ((type === 'bulletList' || type === 'orderedList') && (inDoc || context === 'item')) {
      const list = cleanList(node);
      if (list) out.push(list);
    } else if (type === 'blockquote' && inDoc) {
      const content = cleanBlocks(kids(node), 'quote') as Paragraph[];
      if (content.length) out.push({ type: 'blockquote', content });
    } else if (type === 'horizontalRule' && inDoc) {
      out.push({ type: 'horizontalRule' });
    } else if (type === 'table' && inDoc) {
      const table = cleanTable(node);
      if (table) out.push(table);
    } else if (typeof type === 'string' && SPECIAL.has(type) && inDoc) {
      const block = cleanSpecial(node);
      if (block) out.push(block);
    } else {
      // Not allowed here: keep its text as a paragraph, or its blocks in this context.
      const children = kids(node);
      if (children.length && children.every(isInlineNode)) {
        const content = paragraph(children);
        if (content.content) out.push(content);
      } else if (children.length) {
        out.push(...cleanBlocks(children, context));
      }
    }
  }
  return out;
}

export function sanitizeDoc(input: unknown): Doc {
  if (!isObject(input) || input.type !== 'doc') return EMPTY_DOC;
  return { type: 'doc', content: cleanBlocks(kids(input), 'doc') };
}
```

### `src/lib/doc/schema.ts`

```ts
import type { ChartAttrs } from './chart';

// The article body is stored as the editor's JSON document (Tiptap/ProseMirror) restricted to these nodes.
// src/lib/doc/sanitize.ts enforces this shape on every save; the site renders it with ArticleBody.

export type Mark = { type: 'bold' } | { type: 'italic' } | { type: 'link'; attrs: { href: string } };

export type TextNode = { type: 'text'; text: string; marks?: Mark[] };
export type HardBreak = { type: 'hardBreak' };
export type Inline = TextNode | HardBreak;

export type Paragraph = { type: 'paragraph'; content?: Inline[] };
export type Heading = { type: 'heading'; attrs: { level: 2 | 3 }; content?: Inline[] };
export type ListItem = { type: 'listItem'; content: (Paragraph | BulletList | OrderedList)[] };
export type BulletList = { type: 'bulletList'; content: ListItem[] };
export type OrderedList = { type: 'orderedList'; attrs: { start: number }; content: ListItem[] };
export type Blockquote = { type: 'blockquote'; content: Paragraph[] };
export type HorizontalRule = { type: 'horizontalRule' };
export type TableCell = { type: 'tableCell' | 'tableHeader'; attrs: { colspan: number; rowspan: number }; content: Paragraph[] };
export type TableRow = { type: 'tableRow'; content: TableCell[] };
export type Table = { type: 'table'; content: TableRow[] };

export type PullQuote = { type: 'pullQuote'; attrs: { text: string; attribution: string } };
export type EditorNote = { type: 'editorNote'; attrs: { kind: 'update' | 'correction'; date: string; text: string } };
export type KeyFigure = { value: string; label: string };
export type KeyFigures = { type: 'keyFigures'; attrs: { title: string; items: KeyFigure[]; source: string } };
export type YouTube = { type: 'youtube'; attrs: { videoId: string; title: string } };
export type ReadMore = { type: 'readMore'; attrs: { articleId: string; title: string } };
/** An image from the media library. Alt text and credit come from the media item; the caption is per use. */
export type ImageBlock = { type: 'image'; attrs: { mediaId: string; caption: string } };
/** A bar or line chart drawn by the site (src/lib/doc/chart.ts). */
export type ChartBlock = { type: 'chart'; attrs: ChartAttrs };

export type Block =
  | Paragraph
  | Heading
  | BulletList
  | OrderedList
  | Blockquote
  | HorizontalRule
  | Table
  | PullQuote
  | EditorNote
  | KeyFigures
  | YouTube
  | ReadMore
  | ImageBlock
  | ChartBlock;

export type Doc = { type: 'doc'; content: Block[] };

export const EMPTY_DOC: Doc = { type: 'doc', content: [] };

/** Character limits for the special blocks, shared by the editor dialogs and the sanitizer. */
export const LIMITS = {
  pullQuoteText: 500,
  attribution: 120,
  noteText: 1000,
  figuresTitle: 120,
  figureValue: 24,
  figureLabel: 120,
  figuresSource: 200,
  figuresMax: 4,
  videoTitle: 200,
  readMoreTitle: 200,
  imageCaption: 300,
} as const;

export const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
```

### `src/lib/doc/text.ts`

```ts
import type { Block, Doc, Inline, ListItem } from './schema';

const WORD = /[\p{L}\p{N}]+(?:['’.\-][\p{L}\p{N}]+)*/gu;
const WORDS_PER_MINUTE = 230;

function inlineText(nodes: Inline[] | undefined): string {
  return (nodes ?? [])
    .map((node) => (node.type === 'text' ? node.text : ' '))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function collect(blocks: (Block | ListItem)[], lines: string[]): void {
  for (const block of blocks) {
    switch (block.type) {
      case 'paragraph':
      case 'heading':
        lines.push(inlineText(block.content));
        break;
      case 'bulletList':
      case 'orderedList':
      case 'listItem':
      case 'blockquote':
        collect(block.content as (Block | ListItem)[], lines);
        break;
      case 'table':
        for (const row of block.content) for (const cell of row.content) collect(cell.content, lines);
        break;
      case 'pullQuote':
      case 'editorNote':
        lines.push(block.attrs.text);
        break;
      case 'keyFigures':
        lines.push(block.attrs.title, ...block.attrs.items.map((item) => `${item.value} ${item.label}`.trim()));
        break;
      case 'image':
        lines.push(block.attrs.caption);
        break;
      case 'chart':
        lines.push(block.attrs.title, block.attrs.subtitle);
        break;
      default:
        break;
    }
  }
}

/** Plain text of the body, one line per block, for search and word counts. */
export function docText(doc: Doc): string {
  const lines: string[] = [];
  collect(doc.content, lines);
  return lines.filter(Boolean).join('\n');
}

export function wordCount(text: string): number {
  return text.match(WORD)?.length ?? 0;
}

export function readingMinutes(words: number): number {
  return words > 0 ? Math.ceil(words / WORDS_PER_MINUTE) : 0;
}

/** Media ids of the images in the text, in order, each once. */
export function bodyMediaIds(doc: Doc): string[] {
  const ids: string[] = [];
  for (const block of doc.content) if (block.type === 'image' && !ids.includes(block.attrs.mediaId)) ids.push(block.attrs.mediaId);
  return ids;
}
```

### `src/lib/supabase/clients.ts`

```ts
import 'server-only';
import { cookies } from 'next/headers';
import { connection } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { publicEnv, secretKey } from '@/lib/env';

const NO_SESSION = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;

/**
 * Public reads for the site, with the publishable key and no session (`anon` role).
 * Row Level Security only returns published rows.
 */
export function createPublicClient() {
  const { supabaseUrl, publishableKey } = publicEnv();
  return createClient(supabaseUrl, publishableKey, { auth: NO_SESSION, global: { fetch: uncachedFetch } });
}

/**
 * The site caches whole reads with 'use cache' and tags (src/modules/site/queries.ts). Next.js would otherwise
 * also keep the raw responses in its fetch cache, untagged, so a dropped tag would re-run the read and get
 * the old response back.
 */
const uncachedFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });

/**
 * The signed-in Newsroom user's client (`authenticated` role), with the session kept in cookies.
 * Writes are allowed only when `public.is_staff()` is true.
 */
export async function createSessionClient() {
  // Supabase Auth reads the clock (token expiry); under Cache Components that must happen at request time.
  await connection();
  const cookieStore = await cookies();
  const { supabaseUrl, publishableKey } = publicEnv();
  return createServerClient(supabaseUrl, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components cannot set cookies; src/proxy.ts refreshes the session on every Newsroom request.
        }
      },
    },
  });
}

/**
 * System work (cron, indexing, reader forms, logs) with the secret key.
 * Bypasses Row Level Security: never import from client components or pass its results to the browser unfiltered.
 */
export function createAdminClient() {
  const { supabaseUrl } = publicEnv();
  return createClient(supabaseUrl, secretKey(), { auth: NO_SESSION });
}
```

### `src/modules/content/ArticleBody.tsx`

```tsx
import type { ReactNode } from 'react';
import { CloudImage } from '@/components/media/CloudImage';
import type { Block, Doc, Inline, ListItem, Mark, TableRow } from '@/lib/doc/schema';
import styles from './article.module.css';
import { ChartFigure } from './ChartFigure';
import { YouTubeEmbed } from './YouTubeEmbed';

// Renders a sanitized editor document as React elements (no raw HTML). Used by the public article page
// and the Newsroom preview. Read more cards resolve through `links`; a card whose
// article no longer exists is left out.

export type ArticleLinks = Map<string, { title: string; href: string }>;
/** Media library items used by image blocks, by id. An image whose item was deleted is left out. */
export type ArticleMedia = Map<string, { publicId: string; width: number; height: number; alt: string; credit: string }>;

/** Images fill the article column: full width on phones, at most 680 px elsewhere. */
export const BODY_IMAGE_SIZES = '(max-width: 720px) 100vw, 680px';

const SAFE_HREF = /^(https?:\/\/|mailto:|\/(?!\/)|#)/i;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function noteDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return year ? ` · ${day} ${MONTHS[month - 1]} ${year}` : '';
}

function withMark(node: ReactNode, mark: Mark, key: number): ReactNode {
  if (mark.type === 'bold') return <strong key={key}>{node}</strong>;
  if (mark.type === 'italic') return <em key={key}>{node}</em>;
  if (mark.type === 'link' && SAFE_HREF.test(mark.attrs.href)) {
    return (
      <a key={key} href={mark.attrs.href} rel={/^https?:/i.test(mark.attrs.href) ? 'noopener' : undefined}>
        {node}
      </a>
    );
  }
  return node;
}

function inline(nodes: Inline[] | undefined): ReactNode[] {
  return (nodes ?? []).map((node, index) => {
    if (node.type === 'hardBreak') return <br key={index} />;
    const marks = [...(node.marks ?? [])].sort((a, b) => Number(a.type === 'link') - Number(b.type === 'link'));
    return marks.reduce<ReactNode>((child, mark) => withMark(child, mark, index), node.text);
  });
}

function rows(table: TableRow[]) {
  return table.map((row, r) => (
    <tr key={r}>
      {row.content.map((cell, c) => {
        const Cell = cell.type === 'tableHeader' ? 'th' : 'td';
        return (
          <Cell
            key={c}
            colSpan={cell.attrs.colspan > 1 ? cell.attrs.colspan : undefined}
            rowSpan={cell.attrs.rowspan > 1 ? cell.attrs.rowspan : undefined}
            scope={cell.type === 'tableHeader' ? (r === 0 ? 'col' : 'row') : undefined}
          >
            {blocks(cell.content, undefined)}
          </Cell>
        );
      })}
    </tr>
  ));
}

function blocks(content: (Block | ListItem)[], links: ArticleLinks | undefined, media?: ArticleMedia): ReactNode[] {
  return content.map((block, index) => {
    switch (block.type) {
      case 'paragraph':
        return block.content?.length ? <p key={index}>{inline(block.content)}</p> : null;
      case 'heading':
        return block.attrs.level === 2 ? <h2 key={index}>{inline(block.content)}</h2> : <h3 key={index}>{inline(block.content)}</h3>;
      case 'bulletList':
        return <ul key={index}>{blocks(block.content, links)}</ul>;
      case 'orderedList':
        return (
          <ol key={index} start={block.attrs.start > 1 ? block.attrs.start : undefined}>
            {blocks(block.content, links)}
          </ol>
        );
      case 'listItem':
        return <li key={index}>{blocks(block.content, links)}</li>;
      case 'blockquote':
        return <blockquote key={index}>{blocks(block.content, links)}</blockquote>;
      case 'horizontalRule':
        return <hr key={index} />;
      case 'table':
        return (
          <div key={index} className={styles.tableWrap}>
            <table>
              <tbody>{rows(block.content)}</tbody>
            </table>
          </div>
        );
      case 'pullQuote':
        return (
          <figure key={index} className={styles.pq}>
            <span className={styles.pqRule} aria-hidden="true" />
            <blockquote>
              <p>{block.attrs.text}</p>
            </blockquote>
            {block.attrs.attribution && <figcaption>{block.attrs.attribution}</figcaption>}
          </figure>
        );
      case 'editorNote':
        return (
          <aside key={index} className={styles.note}>
            <p>
              <b>
                {block.attrs.kind === 'correction' ? 'Correction' : 'Update'}
                {noteDate(block.attrs.date)}.
              </b>{' '}
              {block.attrs.text}
            </p>
          </aside>
        );
      case 'keyFigures':
        return (
          <section key={index} className={styles.facts} aria-label={block.attrs.title || 'Key figures'}>
            <p className={styles.factsKicker}>Key figures</p>
            {block.attrs.title && <h3 className={styles.factsTitle}>{block.attrs.title}</h3>}
            <dl className={styles.figs}>
              {block.attrs.items.map((item, i) => (
                <div key={i} className={styles.fig}>
                  <dt className={styles.figLabel}>{item.label}</dt>
                  <dd className={styles.figValue}>{item.value}</dd>
                </div>
              ))}
            </dl>
            {block.attrs.source && <p className={styles.source}>Source: {block.attrs.source}</p>}
          </section>
        );
      case 'youtube':
        return <YouTubeEmbed key={index} videoId={block.attrs.videoId} title={block.attrs.title} />;
      case 'image': {
        const item = media?.get(block.attrs.mediaId);
        if (!item) return null;
        return (
          <figure key={index} className={styles.figure}>
            <CloudImage image={item} alt={item.alt} sizes={BODY_IMAGE_SIZES} className={styles.image} />
            {(block.attrs.caption || item.credit) && (
              <figcaption>
                {block.attrs.caption}
                {block.attrs.caption && item.credit && ' '}
                {item.credit && <span className={styles.credit}>Photo: {item.credit}</span>}
              </figcaption>
            )}
          </figure>
        );
      }
      case 'chart':
        return <ChartFigure key={index} chart={block.attrs} />;
      case 'readMore': {
        const link = links?.get(block.attrs.articleId);
        if (!link) return null;
        return (
          <aside key={index} className={styles.readMore}>
            <span className={styles.readMoreLabel}>Read more</span>
            <a href={link.href}>{link.title}</a>
          </aside>
        );
      }
      default:
        return null;
    }
  });
}

export function ArticleBody({ doc, links, media }: { doc: Doc; links?: ArticleLinks; media?: ArticleMedia }) {
  return <div className={styles.body}>{blocks(doc.content, links, media)}</div>;
}
```

### `src/modules/content/ChartFigure.tsx`

```tsx
import { type ChartAttrs, chartScale, formatChartNumber } from '@/lib/doc/chart';
import styles from './article.module.css';

// Draws a chart block as SVG on the server (no chart library, no client JavaScript). The drawing is hidden
// from screen readers; a visually hidden table carries the same numbers.

const WIDTH = 640;
const MAX_X_LABELS = 12;
const SERIES = ['one', 'two', 'three'] as const;

function xLabelShown(index: number, count: number) {
  if (count <= MAX_X_LABELS) return true;
  const every = Math.ceil(count / MAX_X_LABELS);
  return index % every === 0 || index === count - 1;
}

/** Moves end labels apart so they do not overlap (at least `gap` px between baselines). */
function spread(ys: number[], gap: number, top: number, bottom: number): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < order.length; k++) order[k].y = Math.max(order[k].y, order[k - 1].y + gap);
  const overflow = (order.at(-1)?.y ?? 0) - bottom;
  if (overflow > 0) for (const item of order) item.y -= overflow;
  for (const item of order) item.y = Math.max(item.y, top);
  const out = [...ys];
  for (const item of order) out[item.i] = item.y;
  return out;
}

export function ChartFigure({ chart }: { chart: ChartAttrs }) {
  const { kind, labels, series } = chart;
  const isBar = kind === 'bar';
  const height = isBar ? 260 : 300;
  const plot = { left: 44, right: WIDTH - (isBar ? 8 : 104), top: 24, bottom: height - 34 };
  const values = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const scale = chartScale(values, { zero: isBar });
  const y = (value: number) => plot.bottom - ((value - scale.min) / (scale.max - scale.min)) * (plot.bottom - plot.top);
  const count = labels.length;
  const band = (plot.right - plot.left) / count;
  const xOf = (i: number) => (isBar ? plot.left + band * (i + 0.5) : plot.left + (count === 1 ? 0 : (i * (plot.right - plot.left)) / (count - 1)));
  const base = y(Math.min(Math.max(0, scale.min), scale.max));

  const ends = isBar
    ? []
    : series.map((s, j) => {
        const last = s.values.findLastIndex((v) => v !== null);
        return { j, x: xOf(last), y: y(s.values[last] as number), text: `${s.name} ${formatChartNumber(s.values[last] as number)}` };
      });
  const endYs = spread(
    ends.map((end) => end.y + 4),
    16,
    plot.top,
    plot.bottom + 4,
  );

  return (
    <figure className={styles.chart}>
      {chart.title && <p className={styles.chartTitle}>{chart.title}</p>}
      {chart.subtitle && <p className={styles.chartSub}>{chart.subtitle}</p>}
      {isBar && series.length > 1 && (
        <ul className={styles.legend} aria-hidden="true">
          {series.map((s, j) => (
            <li key={j}>
              <span className={`${styles.swatch} ${styles[SERIES[j]]}`} />
              {s.name}
            </li>
          ))}
        </ul>
      )}
      <svg viewBox={`0 0 ${WIDTH} ${height}`} aria-hidden="true" focusable="false">
        {scale.ticks.map((tick) => (
          <g key={tick}>
            <line className={styles.grid} x1={plot.left} x2={plot.right} y1={y(tick)} y2={y(tick)} />
            <text className={styles.axis} x={0} y={y(tick) + 4}>
              {formatChartNumber(tick)}
            </text>
          </g>
        ))}
        {isBar &&
          series.map((s, j) => {
            const group = band * 0.64;
            const width = group / series.length;
            return s.values.map((value, i) => {
              if (value === null) return null;
              const x = plot.left + band * i + (band - group) / 2 + width * j;
              const top = Math.min(y(value), base);
              const highlight = series.length === 1 && i === count - 1;
              return (
                <g key={`${j}-${i}`}>
                  <rect className={`${styles.bar} ${styles[SERIES[highlight ? 1 : j]]}`} x={x} y={top} width={width} height={Math.max(Math.abs(base - y(value)), 1)} />
                  {series.length === 1 && count <= MAX_X_LABELS && (
                    <text className={styles.value} x={x + width / 2} y={value >= 0 ? y(value) - 7 : y(value) + 15} textAnchor="middle">
                      {formatChartNumber(value)}
                    </text>
                  )}
                </g>
              );
            });
          })}
        {!isBar &&
          series.map((s, j) => {
            const segments: string[][] = [[]];
            s.values.forEach((value, i) => {
              if (value === null) segments.push([]);
              else segments.at(-1)?.push(`${xOf(i).toFixed(1)},${y(value).toFixed(1)}`);
            });
            return segments
              .filter((points) => points.length)
              .map((points, k) =>
                points.length === 1 ? (
                  <circle key={`${j}-${k}`} className={`${styles.dot} ${styles[SERIES[j]]}`} cx={points[0].split(',')[0]} cy={points[0].split(',')[1]} r={3} />
                ) : (
                  <polyline key={`${j}-${k}`} className={`${styles.line} ${styles[SERIES[j]]}`} points={points.join(' ')} />
                ),
              );
          })}
        <line className={styles.base} x1={plot.left} x2={plot.right} y1={base} y2={base} />
        {ends.map((end, k) => (
          <text key={end.j} className={`${styles.endLabel} ${styles[SERIES[end.j]]}`} x={end.x + 8} y={endYs[k]}>
            {end.text}
          </text>
        ))}
        {labels.map((label, i) =>
          xLabelShown(i, count) ? (
            <text key={i} className={styles.axis} x={xOf(i)} y={height - 10} textAnchor="middle">
              {label}
            </text>
          ) : null,
        )}
      </svg>
      <table className="sr-only">
        <caption>{[chart.title, chart.subtitle].filter(Boolean).join('. ') || 'Chart data'}</caption>
        <thead>
          <tr>
            <th scope="col">{chart.axis || 'Label'}</th>
            {series.map((s, j) => (
              <th key={j} scope="col">
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((label, i) => (
            <tr key={i}>
              <th scope="row">{label}</th>
              {series.map((s, j) => (
                <td key={j}>{s.values[i] === null ? 'No data' : formatChartNumber(s.values[i] as number)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {chart.source && <figcaption className={styles.source}>Source: {chart.source}</figcaption>}
    </figure>
  );
}
```

### `src/modules/content/article.module.css`

```css
/* Article body typography (locked preview: .body, .pq, .facts, .note). */

.body {
  color: var(--ink);
}

.body > p,
.body li p,
.body blockquote p {
  font: 400 19px/31px var(--font-serif);
  font-variation-settings: 'opsz' 16;
  text-wrap: pretty;
}

.body > p {
  margin: 0 0 24px;
}

.body h2 {
  margin: 40px 0 16px;
  font: 600 26px/32px var(--font-serif);
  font-variation-settings: 'opsz' 36;
  text-wrap: balance;
}

.body h3 {
  margin: 32px 0 12px;
  font: 600 21px/28px var(--font-serif);
  font-variation-settings: 'opsz' 24;
  text-wrap: balance;
}

.body a {
  color: var(--link);
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-thickness: 1px;
}

.body ul,
.body ol {
  margin: 0 0 24px;
  padding-left: 26px;
}

.body li {
  margin-bottom: 8px;
}

.body li p {
  margin: 0;
}

.body li ul,
.body li ol {
  margin: 8px 0 0;
}

.body > blockquote {
  margin: 0 0 24px;
  padding-left: 20px;
  border-left: 3px solid var(--line-strong);
  color: var(--ink-secondary);
}

.body > blockquote p + p {
  margin-top: 12px;
}

.body hr {
  margin: 40px auto;
  width: 80px;
  border: 0;
  border-top: 1px solid var(--line-strong);
}

.tableWrap {
  margin: 32px 0;
  overflow-x: auto;
}

.tableWrap table {
  width: 100%;
  border-collapse: collapse;
  font: 400 15px/22px var(--font-sans);
}

.tableWrap th,
.tableWrap td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: top;
}

.tableWrap th {
  font-weight: 600;
  border-bottom-color: var(--ink);
}

.tableWrap p {
  margin: 0;
}

.pq {
  margin: 40px 0;
}

.pqRule {
  display: block;
  width: 32px;
  height: 3px;
  margin-bottom: 16px;
  background: var(--compass-mark);
}

.pq blockquote {
  margin: 0;
}

.pq blockquote p {
  margin: 0;
  font: italic 400 28px/38px var(--font-serif);
  font-variation-settings: 'opsz' 36;
  text-wrap: pretty;
}

.pq figcaption {
  margin-top: 12px;
  font: 600 13px/18px var(--font-sans);
}

.note {
  margin: 32px 0;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}

.note p {
  font: 400 15px/22px var(--font-sans);
  color: var(--ink-secondary);
}

.note b {
  color: var(--ink);
  font-weight: 600;
}

.facts {
  margin: 32px 0;
  padding: var(--space-5);
  background: var(--paper-sunken);
  border-top: var(--rule-heavy) solid var(--ink);
}

.factsKicker {
  font: 600 12px/16px var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--meridian);
}

.factsTitle {
  margin-top: 6px;
  font: 600 19px/25px var(--font-serif);
  font-variation-settings: 'opsz' 20;
}

.figs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
  margin: 16px 0 0;
}

.fig {
  display: flex;
  flex-direction: column-reverse;
  justify-content: flex-end;
  gap: 4px;
}

.figValue {
  margin: 0;
  font: 500 30px/34px var(--font-mono);
  letter-spacing: -0.02em;
  color: var(--ink);
}

.figLabel {
  font: 400 13px/18px var(--font-sans);
  color: var(--ink-secondary);
}

.source {
  margin-top: 20px;
  padding-top: 10px;
  border-top: 1px solid var(--line);
  font: 400 12px/18px var(--font-mono);
  color: var(--ink-muted);
}

.readMore {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 32px 0;
  padding: 14px 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.readMoreLabel {
  font: 600 12px/16px var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--meridian);
}

.readMore a {
  font: 600 19px/25px var(--font-serif);
  color: var(--ink);
  text-decoration: none;
}

.readMore a:hover {
  text-decoration: underline;
  text-underline-offset: 4px;
}

.video {
  margin: 32px 0;
  aspect-ratio: 16 / 9;
  background: var(--navy);
}

.video iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}

.videoButton {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 0;
  background: transparent;
  color: var(--on-navy);
  font: 500 16px/22px var(--font-sans);
  cursor: pointer;
  padding: var(--space-4);
}

.videoButton svg {
  color: var(--compass);
}

.videoButton small {
  font: 400 13px/18px var(--font-sans);
  opacity: 0.75;
}

.figure {
  margin: 32px 0;
}

.image {
  display: block;
  width: 100%;
  height: auto;
  background: var(--paper-sunken);
}

.figure figcaption,
.leadCaption {
  margin-top: 8px;
  font: 400 13px/18px var(--font-sans);
  color: var(--ink-secondary);
}

.credit {
  color: var(--ink-muted);
}

/* Chart block (locked preview: .chart, .c-grid, .c-bar, .c-l1). */
.chart {
  margin: 32px 0;
  padding: var(--space-5);
  background: var(--paper-raised);
  border: 1px solid var(--line);
}

.chartTitle {
  font: 600 15px/22px var(--font-sans);
  color: var(--ink);
}

.chartSub {
  margin: 2px 0 16px;
  font: 400 13px/18px var(--font-sans);
  color: var(--ink-secondary);
}

.chart svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

.chart .source {
  margin-top: 14px;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin: 0 0 12px;
  padding: 0;
  list-style: none;
  font: 500 13px/18px var(--font-sans);
  color: var(--ink-secondary);
}

.legend li {
  display: flex;
  align-items: center;
  gap: 6px;
}

.swatch {
  width: 12px;
  height: 12px;
  background: currentColor;
}

.grid {
  stroke: var(--line);
  stroke-width: 1;
}

.base {
  stroke: var(--ink-muted);
  stroke-width: 1;
}

.axis {
  font: 400 12px var(--font-mono);
  fill: var(--ink-muted);
}

.value {
  font: 500 13px var(--font-mono);
  fill: var(--ink);
}

.endLabel {
  font: 500 13px var(--font-sans);
}

.one {
  color: var(--data-1);
  fill: var(--data-1);
  stroke: var(--data-1);
}

.two {
  color: var(--data-2);
  fill: var(--data-2);
  stroke: var(--data-2);
}

.three {
  color: var(--data-3);
  fill: var(--data-3);
  stroke: var(--data-3);
}

.bar {
  stroke: none;
}

.line {
  fill: none;
  stroke-width: 2.5;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.endLabel,
.dot {
  stroke: none;
}
```

### `src/modules/editor/actions.ts`

```ts
'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { UUID } from '@/lib/doc/schema';
import { sanitizeDoc } from '@/lib/doc/sanitize';
import { bodyMediaIds, docText, readingMinutes, wordCount } from '@/lib/doc/text';
import { createSessionClient } from '@/lib/supabase/clients';
import { formatWib } from '@/lib/time';
import { requireStaff } from '@/modules/auth/staff';
import { mediaByIds } from '@/modules/media/queries';
import { refreshArticles } from '@/modules/site/invalidate';
import { type FieldErrors, parseArticleInput } from './input';
import { type ArticleListRow, getRevision, listArticles } from './queries';
import { publishProblems } from './rules';
import { prepareSave } from './save';
import type { ArticleStatus, Intent } from './status';

// Server Actions for articles. Each checks the session; the database checks it again (RLS + is_staff).

const INTENTS: Intent[] = ['autosave', 'save', 'review', 'draft', 'publish', 'schedule', 'update', 'unschedule', 'unpublish', 'archive', 'restore'];
const MAX_REQUEST = 1_000_000;

export type SaveResult =
  | {
      ok: true;
      version: number;
      slug: string;
      status: ArticleStatus;
      publishedAt: string | null;
      scheduledAt: string | null;
      savedAt: string;
    }
  | { ok: false; errors?: FieldErrors; conflict?: boolean; message?: string };

/** Creates an empty draft and opens it in the editor. A form action, so a link prefetch never creates drafts. */
export async function createArticle() {
  await requireStaff();
  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from('articles')
    .insert({ title: '', slug: `untitled-${crypto.randomUUID().slice(0, 8)}` })
    .select('id')
    .single();
  if (error || !data) throw new Error(`The article could not be created. ${error?.message ?? ''}`);
  redirect(`/newsroom/articles/${(data as { id: string }).id}`);
}

export async function saveArticle(raw: unknown, intent: Intent): Promise<SaveResult> {
  await requireStaff();
  if (!INTENTS.includes(intent)) return { ok: false, message: 'Unknown action.' };
  if (JSON.stringify(raw ?? null).length > MAX_REQUEST) {
    return { ok: false, message: 'This article is too long to save in one go. Split it into two articles.' };
  }
  const input = parseArticleInput(raw);
  if (!input.ok) return { ok: false, message: input.error };

  const supabase = await createSessionClient();
  const { data: current, error: readError } = await supabase
    .from('articles')
    .select('status,published_at,scheduled_at')
    .eq('id', input.value.id)
    .maybeSingle();
  if (readError) return { ok: false, message: `The article could not be saved. ${readError.message}` };
  if (!current) return { ok: false, message: 'This article no longer exists.' };

  const media = await mediaByIds([input.value.leadMediaId, ...bodyMediaIds(sanitizeDoc(input.value.body))]);
  const plan = prepareSave({
    input,
    current: current as { status: ArticleStatus; published_at: string | null; scheduled_at: string | null },
    intent,
    now: new Date(),
    media,
  });
  if (!plan.ok) return { ok: false, errors: plan.errors };

  const { data, error } = await supabase.rpc('save_article', {
    p_id: input.value.id,
    p_version: input.value.version,
    p_fields: plan.fields,
    p_authors: plan.authors,
    p_tags: plan.tags,
    p_related: plan.related,
    p_revision: intent === 'autosave' ? 'Autosaved' : plan.revision,
    p_throttle: plan.throttle,
  });
  if (error) {
    if (error.message.includes('version_conflict')) return { ok: false, conflict: true };
    if (error.message.includes('slug_taken') || error.code === '23505') {
      return { ok: false, errors: { slug: 'Another article already uses this address. Change it, for example by adding a keyword.' } };
    }
    return { ok: false, message: `The article could not be saved. ${error.message}` };
  }
  const saved = data as { version: number; slug: string; status: ArticleStatus; published_at: string | null; scheduled_at: string | null; updated_at: string };
  // Readers only see published articles: refresh the site when this one is, or just stopped being, published.
  if (saved.status === 'published' || (current as { status: ArticleStatus }).status === 'published') refreshArticles([input.value.id]);
  return {
    ok: true,
    version: saved.version,
    slug: saved.slug,
    status: saved.status,
    publishedAt: saved.published_at,
    scheduledAt: saved.scheduled_at,
    savedAt: saved.updated_at,
  };
}

/** Deletes an article that is not published. Published articles must be unpublished or archived first. */
export async function deleteArticle(form: FormData) {
  await requireStaff();
  const id = String(form.get('id') ?? '');
  if (!UUID.test(id)) redirect('/newsroom/articles');
  const supabase = await createSessionClient();
  const { data, error } = await supabase.from('articles').delete().eq('id', id).neq('status', 'published').select('id');
  if (error || !(data as unknown[] | null)?.length) redirect(`/newsroom/articles/${id}?notice=delete-failed`);
  redirect('/newsroom/articles?notice=deleted');
}

export type BulkState = { tone?: 'success' | 'error'; message?: string; problems?: { title: string; reasons: string[] }[] };

const BULK = ['publish', 'unpublish', 'archive', 'delete'] as const;
type BulkAction = (typeof BULK)[number];
const PAST: Record<BulkAction, string> = { publish: 'published', unpublish: 'unpublished', archive: 'archived', delete: 'deleted' };
const count = (n: number) => (n === 1 ? '1 article' : `${n} articles`);

export async function bulkArticles(_prev: BulkState, form: FormData): Promise<BulkState> {
  await requireStaff();
  const action = form.get('action') as BulkAction;
  const ids = form.getAll('ids').map(String).filter((id) => UUID.test(id));
  if (!BULK.includes(action)) return { tone: 'error', message: 'Choose what to do with the selected articles.' };
  if (!ids.length) return { tone: 'error', message: 'Select at least one article first.' };
  const supabase = await createSessionClient();

  if (action === 'delete') {
    const { data, error } = await supabase.from('articles').delete().in('id', ids).neq('status', 'published').select('id');
    if (error) return { tone: 'error', message: `Nothing was deleted. ${error.message}` };
    const deleted = (data as unknown[]).length;
    refresh();
    const skipped = ids.length - deleted;
    return {
      tone: 'success',
      message: `${count(deleted)} deleted.${skipped ? ` ${count(skipped)} skipped: published articles must be unpublished or archived first.` : ''}`,
    };
  }

  let ready = ids;
  const problems: { title: string; reasons: string[] }[] = [];
  if (action === 'publish') {
    const [{ data: rows }, { data: bylines }] = await Promise.all([
      supabase.from('articles').select('id,title,slug,section_id,standfirst,word_count,status,lead_media_id,body').in('id', ids),
      supabase.from('article_authors').select('article_id,author_id').in('article_id', ids),
    ]);
    type Row = { id: string; title: string; slug: string; section_id: string | null; standfirst: string; word_count: number; lead_media_id: string | null; body: unknown };
    const list = (rows ?? []) as Row[];
    const images = new Map(list.map((row) => [row.id, bodyMediaIds(sanitizeDoc(row.body))]));
    const media = await mediaByIds(list.flatMap((row) => [row.lead_media_id, ...(images.get(row.id) ?? [])]));
    ready = [];
    for (const row of list) {
      const found = publishProblems({
        leadImage: row.lead_media_id ? (media.get(row.lead_media_id) ?? null) : null,
        imagesWithoutAlt: (images.get(row.id) ?? []).filter((id) => !media.get(id)?.alt.trim()).length,
        title: row.title,
        slug: row.slug,
        sectionId: row.section_id,
        authorIds: ((bylines ?? []) as { article_id: string; author_id: string }[]).filter((b) => b.article_id === row.id).map((b) => b.author_id),
        standfirst: row.standfirst,
        wordCount: row.word_count,
      });
      if (Object.keys(found).length) problems.push({ title: row.title || 'Untitled', reasons: Object.values(found) as string[] });
      else ready.push(row.id);
    }
  }

  let moved = 0;
  if (ready.length) {
    const { data, error } = await supabase.rpc('set_article_status', { p_ids: ready, p_action: action });
    if (error) return { tone: 'error', message: `Nothing changed. ${error.message}` };
    moved = Number(data ?? 0);
    if (moved) refreshArticles(ready);
  }
  refresh();
  return {
    tone: problems.length ? 'error' : 'success',
    message: `${count(moved)} ${PAST[action]}.${problems.length ? ` ${problems.length === 1 ? '1 article needs' : `${problems.length} articles need`} work before publishing:` : ''}`,
    problems,
  };
}

/** Puts a stored version back into the article. The current state is kept in history first. */
export async function restoreRevision(form: FormData) {
  await requireStaff();
  const articleId = String(form.get('articleId') ?? '');
  const revisionId = Number(form.get('revisionId'));
  if (!UUID.test(articleId) || !Number.isInteger(revisionId)) redirect('/newsroom/articles');
  const revision = await getRevision(articleId, revisionId);
  if (!revision) redirect(`/newsroom/articles/${articleId}/history?notice=missing`);
  const supabase = await createSessionClient();
  const { data: current } = await supabase.from('articles').select('version').eq('id', articleId).maybeSingle();
  if (!current) redirect('/newsroom/articles');

  await supabase.rpc('record_revision', { p_id: articleId, p_note: 'Before restore' });
  const snap = revision.snapshot;
  const fields: Record<string, unknown> = {};
  for (const key of ['title', 'standfirst', 'body', 'type', 'kicker_label', 'is_breaking', 'sources', 'section_id', 'lead_media_id', 'lead_caption'] as const) {
    if (key in snap) fields[key] = (snap as Record<string, unknown>)[key];
  }
  const body = sanitizeDoc(snap.body);
  const text = docText(body);
  Object.assign(fields, { body, body_text: text, word_count: wordCount(text), reading_minutes: readingMinutes(wordCount(text)) });
  const { error } = await supabase.rpc('save_article', {
    p_id: articleId,
    p_version: (current as { version: number }).version,
    p_fields: fields,
    p_authors: snap.authors ?? null,
    p_tags: snap.tags ?? null,
    p_related: snap.related ?? null,
    p_revision: `Restored the version from ${formatWib(revision.created_at)} WIB`,
  });
  if (error) redirect(`/newsroom/articles/${articleId}/history?notice=restore-failed`);
  refreshArticles([articleId]);
  redirect(`/newsroom/articles/${articleId}?notice=restored`);
}

/** Articles for the Related and Read more pickers. */
export async function findArticles(query: string, excludeId: string): Promise<Pick<ArticleListRow, 'id' | 'title' | 'status' | 'section'>[]> {
  await requireStaff();
  const { rows } = await listArticles({ q: query.slice(0, 100), limit: 8 });
  return rows.filter((row) => row.id !== excludeId).map(({ id, title, status, section }) => ({ id, title, status, section }));
}
```

### `src/modules/media/actions.ts`

```ts
'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { UUID } from '@/lib/doc/schema';
import { createSessionClient } from '@/lib/supabase/clients';
import { requireStaff } from '@/modules/auth/staff';
import { cloudinaryConfig, destroyAsset, FOLDER, fetchResource, type UploadPlan, uploadPlan } from './cloudinary';
import { listMedia, mediaUsage } from './queries';
import { MEDIA_COLUMNS, type MediaItem, type MediaRow, toMediaItem } from './types';
import { checkFile, type MediaDetails, parseMediaDetails } from './validate';
import { refreshSite } from '@/modules/site/invalidate';

// Server Actions for media. Uploads go browser → Cloudinary directly; the server signs the request
// first and checks the result with the Admin API afterwards, so only real uploads are recorded.

const NOT_CONNECTED = 'Cloudinary is not connected yet. Add the three Cloudinary keys to .env on your computer and to Vercel, then try again.';

export type PrepareResult = { ok: true; plan: UploadPlan } | { ok: false; error: string };

export async function prepareUpload(file: { name: string; type: string; size: number }): Promise<PrepareResult> {
  await requireStaff();
  const config = cloudinaryConfig();
  if (!config) return { ok: false, error: NOT_CONNECTED };
  const problem = checkFile({ type: String(file?.type ?? ''), size: Number(file?.size ?? 0) });
  if (problem) return { ok: false, error: problem };
  return { ok: true, plan: uploadPlan(config, { fileName: String(file.name ?? 'image'), now: Math.floor(Date.now() / 1000) }) };
}

export type MediaResult = { ok: true; media: MediaItem } | { ok: false; error?: string; errors?: Partial<Record<keyof MediaDetails, string>> };

/** Records an upload after Cloudinary confirms it has the image. Sizes come from Cloudinary, not the browser. */
export async function registerUpload(input: { publicId: string; originalName: string } & Partial<MediaDetails>): Promise<MediaResult> {
  await requireStaff();
  const config = cloudinaryConfig();
  if (!config) return { ok: false, error: NOT_CONNECTED };
  const publicId = String(input?.publicId ?? '');
  if (!publicId.startsWith(`${FOLDER}/`) || publicId.includes('..')) return { ok: false, error: 'This upload cannot be recorded.' };
  const { values, errors } = parseMediaDetails(input as Record<string, unknown>);
  if (Object.keys(errors).length) return { ok: false, errors };

  let resource;
  try {
    resource = await fetchResource(config, publicId);
  } catch (error) {
    return { ok: false, error: `Cloudinary could not be reached. ${(error as Error).message}` };
  }
  if (!resource) return { ok: false, error: 'The file did not reach Cloudinary. Upload it again.' };

  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from('media')
    .upsert(
      {
        public_id: resource.publicId,
        format: resource.format,
        width: resource.width,
        height: resource.height,
        bytes: resource.bytes,
        original_name: String(input.originalName ?? '').slice(0, 200),
        ...values,
      },
      { onConflict: 'public_id' },
    )
    .select(MEDIA_COLUMNS)
    .single();
  if (error || !data) return { ok: false, error: `The image is on Cloudinary but could not be saved here. ${error?.message ?? ''}` };
  return { ok: true, media: toMediaItem(data as MediaRow) };
}

/** Saves alt text, caption and credit (used by the image picker). */
export async function saveMediaDetails(id: string, details: Partial<MediaDetails>): Promise<MediaResult> {
  await requireStaff();
  if (!UUID.test(String(id))) return { ok: false, error: 'Unknown image.' };
  const { values, errors } = parseMediaDetails(details as Record<string, unknown>);
  if (Object.keys(errors).length) return { ok: false, errors };
  const supabase = await createSessionClient();
  const { data, error } = await supabase.from('media').update(values).eq('id', id).select(MEDIA_COLUMNS).single();
  if (error || !data) return { ok: false, error: `The details could not be saved. ${error?.message ?? ''}` };
  // Alt text and credit show wherever the image is used on the site.
  refreshSite();
  return { ok: true, media: toMediaItem(data as MediaRow) };
}

export type MediaFormState = { errors: Partial<Record<keyof MediaDetails, string>>; values?: MediaDetails; message?: string; saved?: boolean };

/** The details form on a media page. */
export async function updateMedia(_prev: MediaFormState, form: FormData): Promise<MediaFormState> {
  const result = await saveMediaDetails(String(form.get('id') ?? ''), Object.fromEntries(form) as Partial<MediaDetails>);
  if (result.ok) {
    refresh();
    return { errors: {}, values: { alt: result.media.alt, caption: result.media.caption, credit: result.media.credit }, saved: true };
  }
  return { errors: result.errors ?? {}, values: parseMediaDetails(Object.fromEntries(form)).values, message: result.error };
}

/** Deletes an unused image: the record first, then the file on Cloudinary. */
export async function deleteMedia(form: FormData) {
  await requireStaff();
  const id = String(form.get('id') ?? '');
  if (!UUID.test(id)) redirect('/newsroom/media');
  if ((await mediaUsage(id)).length) redirect(`/newsroom/media/${id}?notice=in-use`);
  const supabase = await createSessionClient();
  const { data, error } = await supabase.from('media').delete().eq('id', id).select('public_id');
  const row = (data as { public_id: string }[] | null)?.[0];
  if (error || !row) redirect(`/newsroom/media/${id}?notice=delete-failed`);
  const config = cloudinaryConfig();
  if (config) {
    const removed = await destroyAsset(config, row.public_id, Math.floor(Date.now() / 1000)).catch(() => false);
    if (!removed) console.error(`Cloudinary did not delete ${row.public_id}. Remove it in the Cloudinary Media Library.`);
  }
  redirect('/newsroom/media?notice=deleted');
}

/** Pages of the library for the image picker. */
export async function searchMedia(query: string, page = 1): Promise<{ total: number; items: MediaItem[] }> {
  await requireStaff();
  return listMedia({ q: String(query ?? '').slice(0, 100), page: Math.max(1, Math.floor(Number(page) || 1)), limit: 12 });
}
```

### `src/modules/site/cache.ts`

```ts
// Cache tags for the public site. Every cached read carries `site`; lists and slug lookups carry `articles`;
// an article page carries `article:{id}`; sections, authors, tags and the navigation carry `taxonomy`.
// src/modules/site/invalidate.ts drops them when the Newsroom changes something readers can see.

export const TAGS = {
  site: 'site',
  articles: 'articles',
  taxonomy: 'taxonomy',
  article: (id: string) => `article:${id}`,
} as const;
```

### `src/modules/site/format.ts`

```ts
import { formatWib } from '@/lib/time';
import { TYPE_LABELS } from '@/modules/editor/input';
import type { Card, SitePerson } from './types';

// Small pure helpers for how articles read on the site: addresses, kickers, bylines, date lines.

/** `/business/rice-prices-fall`. Published articles always have a section; `news` is a safe fallback. */
export function articleHref(article: { slug: string; section: { slug: string } | null | string }): string {
  const section = typeof article.section === 'string' ? article.section : article.section?.slug;
  return `/${section || 'news'}/${article.slug}`;
}

export type Kicker = { text: string; tone: 'default' | 'plain' | 'live' } | null;

/**
 * The small label above a headline: Breaking, then the editor's kicker, then the article type when it is
 * not plain news, then the section (left out where the page is already that section).
 */
export function kickerFor(card: Pick<Card, 'isBreaking' | 'kicker' | 'type' | 'section'>, { hideSection = false } = {}): Kicker {
  if (card.isBreaking) return { text: 'Breaking', tone: 'live' };
  if (card.kicker) return { text: card.kicker, tone: 'default' };
  if (card.type !== 'news') return { text: TYPE_LABELS[card.type], tone: 'plain' };
  if (!hideSection && card.section) return { text: card.section.name, tone: 'default' };
  return null;
}

/** `Rani`, `Rani and Bima`, `Rani, Bima and Ayu`. */
export function names(people: Pick<SitePerson, 'name'>[]): string {
  const list = people.map((person) => person.name);
  if (list.length <= 1) return list[0] ?? '';
  return `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`;
}

/** `RP` for Rani Prameswari: the avatar when an author has no photo. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')).toUpperCase();
}

/** The line under a card's headline: `Rani Prameswari · 12 Nov 2026`, optionally with the reading time. */
export function cardMeta(card: Pick<Card, 'authors' | 'publishedAt' | 'readingMinutes'>, { minutes = false } = {}): string {
  return [names(card.authors), formatWib(card.publishedAt, 'date'), minutes && card.readingMinutes > 0 ? `${card.readingMinutes} min read` : '']
    .filter(Boolean)
    .join(' · ');
}

/** `12 Nov 2026 · 19:50 WIB · Updated 20:15 · 6 min read` for an article's byline. */
export function articleDateLine(publishedAt: string, updatedAt: string | null, minutes: number): string {
  const parts = [formatWib(publishedAt, 'date'), `${formatWib(publishedAt, 'time')} WIB`];
  if (updatedAt && new Date(updatedAt).getTime() > new Date(publishedAt).getTime() + 60_000) {
    const sameDay = formatWib(updatedAt, 'date') === formatWib(publishedAt, 'date');
    parts.push(`Updated ${sameDay ? formatWib(updatedAt, 'time') : formatWib(updatedAt, 'short')}`);
  }
  if (minutes > 0) parts.push(`${minutes} min read`);
  return parts.join(' · ');
}

/** A positive page number from a URL segment, or null. Page 1 lives at the list's own address. */
export function pageNumber(segment: string): number | null {
  if (!/^[1-9]\d{0,4}$/.test(segment)) return null;
  const page = Number(segment);
  return page >= 2 ? page : null;
}
```

### `src/modules/site/invalidate.ts`

```ts
import 'server-only';
import { revalidateTag } from 'next/cache';
import { TAGS } from './cache';

// Drops cached site pages after the Newsroom changes what readers see.
//
// From Server Actions the tags expire after one second instead of at once: an immediate expiry (updateTag,
// or expire: 0) makes Next.js re-render the current Newsroom page in the action's response, which remounts
// the article editor mid-session. With one second, the first reader request after it waits for fresh data.

const FROM_NEWSROOM = { expire: 1 };

/** Articles were published, unpublished, archived or edited while published. */
export function refreshArticles(ids: string[]) {
  revalidateTag(TAGS.articles, FROM_NEWSROOM);
  for (const id of ids) revalidateTag(TAGS.article(id), FROM_NEWSROOM);
}

/** Something used across the site changed: sections, tags, authors, image details. */
export function refreshSite() {
  revalidateTag(TAGS.site, FROM_NEWSROOM);
}

/** For route handlers (cron, /api/revalidate): expire at once. */
export function expireTags(tags: string[]) {
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
}
```

### `src/modules/site/missing.ts`

```ts
import 'server-only';
import { notFound, permanentRedirect } from 'next/navigation';
import { findRedirect } from './queries';

/** For an address with nothing to show: follow an automatic redirect (308) if the content moved, else 404. */
export async function missing(path: string): Promise<never> {
  const redirect = await findRedirect(path);
  if (redirect && redirect.code !== 410 && redirect.to) permanentRedirect(redirect.to);
  notFound();
}
```

### `src/modules/site/params.ts`

```ts
import 'server-only';
import { createPublicClient } from '@/lib/supabase/clients';

// Sample params for generateStaticParams. With Cache Components a dynamic route needs at least one, and
// having them lets pages await params outside Suspense, so a missing article answers with a real 404 (and
// a moved one with a real 308) instead of a streamed page. Other addresses render on first visit and are
// cached from then on. When the database is still empty, a placeholder stands in.

export const PLACEHOLDER = 'pc-placeholder';

export async function recentArticleParams(limit = 20): Promise<{ section: string; slug: string }[]> {
  const { data, error } = await createPublicClient().rpc('site_list', { p_kind: 'latest', p_limit: limit });
  if (error) throw new Error(`site_list: ${error.message}`);
  const rows = ((data as { rows: { slug: string; section: { slug: string } | null }[] } | null)?.rows ?? []).filter((row) => row.section);
  return rows.length ? rows.map((row) => ({ section: row.section!.slug, slug: row.slug })) : [{ section: PLACEHOLDER, slug: PLACEHOLDER }];
}

export async function sectionParams(): Promise<{ section: string }[]> {
  const { data, error } = await createPublicClient().from('sections').select('slug');
  if (error) throw new Error(`sections: ${error.message}`);
  const rows = (data as { slug: string }[]) ?? [];
  return rows.length ? rows.map((row) => ({ section: row.slug })) : [{ section: PLACEHOLDER }];
}
```

### `src/modules/site/queries.ts`

```ts
import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/clients';
import { TAGS } from './cache';
import type { ArticlePage, Home, ListKind, ListPage, NavSection, Redirect, SearchPage } from './types';

// Reads for the public site: the publishable key (role anon, Row Level Security) and the site_* SQL
// functions, cached with Cache Components. Readers see changes from the Newsroom straight away because
// the Newsroom drops the tags (src/modules/site/invalidate.ts); otherwise entries refresh hourly.

export const PAGE_SIZE = 24;
export const LATEST_HOURS = 24;

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await createPublicClient().rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

export async function getHome(): Promise<Home> {
  'use cache';
  cacheLife('hours');
  cacheTag(TAGS.site, TAGS.articles, TAGS.taxonomy);
  return rpc<Home>('site_home');
}

/** A page of articles (1-based `page`); null for an unknown section, or an author or tag with nothing published. */
export async function getList(kind: ListKind, slug: string | null, page = 1, limit = PAGE_SIZE): Promise<ListPage | null> {
  'use cache';
  cacheLife('hours');
  cacheTag(TAGS.site, TAGS.articles, TAGS.taxonomy);
  return rpc<ListPage | null>('site_list', { p_kind: kind, p_slug: slug, p_limit: limit, p_offset: (page - 1) * limit });
}

/** Articles published in the last day, for the Latest strip under the navigation. */
export async function getLatestStrip(limit = 3): Promise<ListPage> {
  'use cache';
  cacheLife('hours');
  cacheTag(TAGS.site, TAGS.articles);
  const since = new Date(Date.now() - LATEST_HOURS * 3600_000).toISOString();
  return (await rpc<ListPage | null>('site_list', { p_kind: 'latest', p_limit: limit, p_since: since })) ?? { subject: null, total: 0, rows: [] };
}

export async function getArticle(slug: string): Promise<ArticlePage | null> {
  'use cache';
  cacheLife('hours');
  cacheTag(TAGS.site, TAGS.articles);
  const article = await rpc<ArticlePage | null>('site_article', { p_slug: slug });
  if (article) cacheTag(TAGS.article(article.id));
  return article;
}

export async function search(query: string, page = 1, limit = 20): Promise<SearchPage> {
  'use cache';
  cacheLife('hours');
  cacheTag(TAGS.site, TAGS.articles);
  return rpc<SearchPage>('site_search', { p_query: query, p_limit: limit, p_offset: (page - 1) * limit });
}

/** Sections in navigation order. */
export async function getSections(): Promise<NavSection[]> {
  'use cache';
  cacheLife('hours');
  cacheTag(TAGS.site, TAGS.taxonomy);
  const { data, error } = await createPublicClient().from('sections').select('name,slug,in_nav').order('position').order('name');
  if (error) throw new Error(`sections: ${error.message}`);
  return (data as { name: string; slug: string; in_nav: boolean }[]).map((s) => ({ name: s.name, slug: s.slug, inNav: s.in_nav }));
}

/** Where an old address now lives (automatic redirects after an address changed). */
export async function findRedirect(path: string): Promise<Redirect | null> {
  'use cache';
  cacheLife('hours');
  cacheTag(TAGS.site, TAGS.articles, TAGS.taxonomy);
  const { data, error } = await createPublicClient().from('redirects').select('to_path,code').eq('from_path', path).maybeSingle();
  if (error) throw new Error(`redirects: ${error.message}`);
  return data ? { to: (data as { to_path: string }).to_path, code: (data as { code: number }).code } : null;
}

/** Today's date in WIB for the top of every page, e.g. "Friday, 13 November 2026". */
export async function todayLine(): Promise<string> {
  'use cache';
  cacheLife('hours');
  cacheTag(TAGS.site);
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date());
}
```

### `src/modules/site/types.ts`

```ts
import type { Doc } from '@/lib/doc/schema';
import type { ArticleType, Source } from '@/modules/editor/input';

// Shapes returned by the site_* SQL functions (supabase/migrations/20261116000100_public_site.sql).

export type SiteImage = { publicId: string; width: number; height: number; alt: string; credit: string };
export type SitePerson = { name: string; slug: string; role: string; photo: SiteImage | null };
export type SiteSection = { name: string; slug: string };

export type Card = {
  id: string;
  title: string;
  slug: string;
  type: ArticleType;
  kicker: string;
  standfirst: string;
  publishedAt: string;
  updatedAt: string | null;
  readingMinutes: number;
  isBreaking: boolean;
  section: SiteSection | null;
  authors: SitePerson[];
  lead: SiteImage | null;
};

export type ArticlePage = Card & {
  body: Doc;
  sources: Source[];
  leadCaption: string;
  tags: { name: string; slug: string }[];
  media: (SiteImage & { id: string })[];
  links: { id: string; title: string; slug: string; section: string | null }[];
  related: Card[];
  more: Card[];
};

export type Home = { top: Card[]; sections: (SiteSection & { articles: Card[] })[]; opinion: Card[] };

export type ListKind = 'latest' | 'section' | 'author' | 'tag';
export type ListSubject = SiteSection & { description?: string; role?: string; bio?: string; links?: { label: string; url: string }[]; photo?: SiteImage | null };
export type ListPage = { subject: ListSubject | null; total: number; rows: Card[] };
export type SearchPage = { total: number; rows: Card[] };

export type NavSection = SiteSection & { inNav: boolean };
export type Redirect = { to: string; code: number };
```

### `src/modules/taxonomy/actions.ts`

```ts
'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { UUID } from '@/lib/doc/schema';
import { createSessionClient } from '@/lib/supabase/clients';
import { requireStaff } from '@/modules/auth/staff';
import { refreshSite } from '@/modules/site/invalidate';
import { type Errors, parseAuthor, parseSection, parseTag } from './validate';

// Server Actions for Sections, Tags and Authors. Each one checks the session itself.

export type FormState = { errors: Errors; values?: Record<string, unknown>; message?: string };

type Kind = 'section' | 'tag' | 'author';
const TABLE: Record<Kind, 'sections' | 'tags' | 'authors'> = { section: 'sections', tag: 'tags', author: 'authors' };
const LIST: Record<Kind, string> = { section: '/newsroom/sections', tag: '/newsroom/tags', author: '/newsroom/authors' };

function idFrom(form: FormData): string | null {
  const id = form.get('id');
  return typeof id === 'string' && UUID.test(id) ? id : null;
}

async function store(kind: Kind, id: string | null, row: Record<string, unknown>, values: Record<string, unknown>): Promise<FormState> {
  const supabase = await createSessionClient();
  let error: { code?: string; message: string } | null;
  if (id) {
    ({ error } = await supabase.from(TABLE[kind]).update(row).eq('id', id));
  } else {
    let position = {};
    if (kind === 'section') {
      const { count } = await supabase.from('sections').select('id', { count: 'exact', head: true });
      position = { position: count ?? 0 };
    }
    ({ error } = await supabase.from(TABLE[kind]).insert({ ...row, ...position }));
  }
  if (error?.code === '23505') return { errors: { slug: `Another ${kind} already uses this address.` }, values };
  if (error) return { errors: {}, values, message: `The ${kind} could not be saved. ${error.message}` };
  refreshSite();
  redirect(`${LIST[kind]}?notice=${id ? 'updated' : 'created'}`);
}

export async function saveSection(_prev: FormState, form: FormData): Promise<FormState> {
  await requireStaff();
  const { values, errors } = parseSection(form);
  if (Object.keys(errors).length) return { errors, values };
  const supabase = await createSessionClient();
  const { data: page } = await supabase.from('pages').select('id').eq('slug', values.slug).maybeSingle();
  if (page) return { errors: { slug: 'A page already uses this address. Choose another.' }, values };
  return store('section', idFrom(form), { name: values.name, slug: values.slug, description: values.description, in_nav: values.inNav }, values);
}

export async function saveTag(_prev: FormState, form: FormData): Promise<FormState> {
  await requireStaff();
  const { values, errors } = parseTag(form);
  if (Object.keys(errors).length) return { errors, values };
  return store('tag', idFrom(form), values, values);
}

export async function saveAuthor(_prev: FormState, form: FormData): Promise<FormState> {
  await requireStaff();
  const { values, errors } = parseAuthor(form);
  if (Object.keys(errors).length) return { errors, values };
  const { photoMediaId, ...rest } = values;
  return store('author', idFrom(form), { ...rest, photo_media_id: photoMediaId }, values);
}

async function remove(kind: Kind, form: FormData) {
  await requireStaff();
  const id = idFrom(form);
  if (!id) redirect(LIST[kind]);
  const supabase = await createSessionClient();
  const { error } = await supabase.from(TABLE[kind]).delete().eq('id', id);
  if (error) redirect(`${LIST[kind]}/${id}?notice=${error.code === '23503' ? 'in-use' : 'failed'}`);
  refreshSite();
  redirect(`${LIST[kind]}?notice=deleted`);
}

export async function deleteSection(form: FormData) {
  await remove('section', form);
}

export async function deleteTag(form: FormData) {
  await remove('tag', form);
}

export async function deleteAuthor(form: FormData) {
  await remove('author', form);
}

/** Moves a section one place up or down in the navigation order. */
export async function moveSection(form: FormData) {
  await requireStaff();
  const id = idFrom(form);
  const direction = form.get('direction') === 'up' ? -1 : 1;
  const supabase = await createSessionClient();
  const { data, error } = await supabase.from('sections').select('id,position').order('position').order('name');
  if (error || !data || !id) return;
  const order = (data as { id: string; position: number }[]).map((row) => row.id);
  const from = order.indexOf(id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= order.length) return;
  [order[from], order[to]] = [order[to], order[from]];
  const current = new Map((data as { id: string; position: number }[]).map((row) => [row.id, row.position]));
  for (const [position, sectionId] of order.entries()) {
    if (current.get(sectionId) !== position) await supabase.from('sections').update({ position }).eq('id', sectionId);
  }
  refreshSite();
  refresh();
}
```

### `supabase/migrations/20261116000100_public_site.sql`

```sql
-- PressCompass Plan 4 (public site): read functions for the site.
-- The site calls these with the publishable key (role anon). They run as the caller, so Row Level Security
-- still applies, and they also filter on "published and due" themselves: staff calling them get the same
-- public view, never drafts. Each returns JSON shaped for the page that renders it.

-- An image from the media library, or null.
create or replace function public.site_image(p_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('publicId', m.public_id, 'width', m.width, 'height', m.height, 'alt', m.alt, 'credit', m.credit)
  from public.media m
  where m.id = p_id;
$$;

-- True when an article row is published and due.
create or replace function public.site_is_live(p_status public.article_status, p_published_at timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_status = 'published' and p_published_at is not null and p_published_at <= now();
$$;

-- One published article as a card for lists, or null.
create or replace function public.site_card(p_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', a.id,
    'title', a.title,
    'slug', a.slug,
    'type', a.type,
    'kicker', a.kicker_label,
    'standfirst', a.standfirst,
    'publishedAt', a.published_at,
    'updatedAt', a.major_update_at,
    'readingMinutes', a.reading_minutes,
    'isBreaking', a.is_breaking,
    'section', (select jsonb_build_object('name', s.name, 'slug', s.slug) from public.sections s where s.id = a.section_id),
    'authors', coalesce((
      select jsonb_agg(jsonb_build_object('name', au.name, 'slug', au.slug, 'role', au.role, 'photo', public.site_image(au.photo_media_id)) order by aa.position, au.name)
      from public.article_authors aa
      join public.authors au on au.id = aa.author_id
      where aa.article_id = a.id
    ), '[]'::jsonb),
    'lead', public.site_image(a.lead_media_id)
  )
  from public.articles a
  where a.id = p_id and public.site_is_live(a.status, a.published_at);
$$;

-- Cards for a list of article ids, in the given order.
create or replace function public.site_cards(p_ids uuid[])
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(c.card order by c.n), '[]'::jsonb)
  from (select public.site_card(i.id) as card, i.n from unnest(p_ids) with ordinality as i(id, n)) c
  where c.card is not null;
$$;

-- A page of published articles, newest first.
--   p_kind 'latest': every article (p_since limits to articles published after that moment)
--   p_kind 'section' | 'author' | 'tag': the articles of that section, author or tag (by slug)
-- Returns {subject, total, rows}, or null when the section, author or tag does not exist, and for authors
-- and tags that have no published article.
create or replace function public.site_list(
  p_kind text,
  p_slug text default null,
  p_limit integer default 24,
  p_offset integer default 0,
  p_since timestamptz default null
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_id uuid;
  v_subject jsonb;
  v_total integer;
  v_ids uuid[];
begin
  if p_kind = 'section' then
    select s.id, jsonb_build_object('name', s.name, 'slug', s.slug, 'description', s.description)
    into v_id, v_subject from public.sections s where s.slug = p_slug;
  elsif p_kind = 'author' then
    select au.id, jsonb_build_object('name', au.name, 'slug', au.slug, 'role', au.role, 'bio', au.bio, 'links', au.links, 'photo', public.site_image(au.photo_media_id))
    into v_id, v_subject from public.authors au where au.slug = p_slug;
  elsif p_kind = 'tag' then
    select t.id, jsonb_build_object('name', t.name, 'slug', t.slug, 'description', t.description)
    into v_id, v_subject from public.tags t where t.slug = p_slug;
  elsif p_kind <> 'latest' then
    raise exception 'unknown list kind %', p_kind using errcode = '22023';
  end if;
  if p_kind <> 'latest' and v_id is null then
    return null;
  end if;

  with matching as (
    select a.id, a.published_at
    from public.articles a
    where public.site_is_live(a.status, a.published_at)
      and (p_since is null or a.published_at >= p_since)
      and case p_kind
        when 'section' then a.section_id = v_id
        when 'author' then exists (select 1 from public.article_authors aa where aa.article_id = a.id and aa.author_id = v_id)
        when 'tag' then exists (select 1 from public.article_tags tg where tg.article_id = a.id and tg.tag_id = v_id)
        else true
      end
  )
  select
    (select count(*)::integer from matching),
    array(select m.id from matching m order by m.published_at desc, m.id limit greatest(p_limit, 0) offset greatest(p_offset, 0))
  into v_total, v_ids;

  if p_kind in ('author', 'tag') and v_total = 0 then
    return null;
  end if;
  return jsonb_build_object('subject', v_subject, 'total', v_total, 'rows', public.site_cards(v_ids));
end;
$$;

-- The front page: lead and top stories, a row per section in the navigation, and opinion.
-- Each article appears once: section rows and opinion leave out what is already shown above them.
create or replace function public.site_home(p_top integer default 5, p_per_section integer default 4, p_opinion integer default 3)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_shown uuid[];
  v_top uuid[];
  v_ids uuid[];
  v_sections jsonb := '[]'::jsonb;
  v_opinion uuid[];
  s record;
begin
  v_top := array(
    select a.id from public.articles a
    where public.site_is_live(a.status, a.published_at)
    order by a.published_at desc, a.id
    limit p_top
  );
  v_shown := v_top;

  for s in select sec.id, sec.name, sec.slug from public.sections sec where sec.in_nav order by sec.position, sec.name loop
    v_ids := array(
      select a.id from public.articles a
      where public.site_is_live(a.status, a.published_at) and a.section_id = s.id and a.id <> all(v_shown) and a.type <> 'opinion'
      order by a.published_at desc, a.id
      limit p_per_section
    );
    if cardinality(v_ids) > 0 then
      v_sections := v_sections || jsonb_build_array(jsonb_build_object('name', s.name, 'slug', s.slug, 'articles', public.site_cards(v_ids)));
      v_shown := v_shown || v_ids;
    end if;
  end loop;

  v_opinion := array(
    select a.id from public.articles a
    where public.site_is_live(a.status, a.published_at) and a.type = 'opinion' and a.id <> all(v_top)
    order by a.published_at desc, a.id
    limit p_opinion
  );

  return jsonb_build_object('top', public.site_cards(v_top), 'sections', v_sections, 'opinion', public.site_cards(v_opinion));
end;
$$;

-- One published article with everything its page shows, or null.
--   related: the editor's picks first, then the newest articles sharing a tag or the section (3 in all)
--   more: other articles from the same section that are not already related (3)
--   links: titles and addresses for the Read more cards in the body (published articles only)
--   media: images used by image blocks in the body
create or replace function public.site_article(p_slug text)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  a public.articles;
  v_related uuid[];
  v_more uuid[];
begin
  select * into a from public.articles x where x.slug = p_slug and public.site_is_live(x.status, x.published_at);
  if not found then
    return null;
  end if;

  v_related := array(
    select r.related_id from public.article_related r
    join public.articles x on x.id = r.related_id
    where r.article_id = a.id and public.site_is_live(x.status, x.published_at)
    order by r.position
    limit 3
  );
  if cardinality(v_related) < 3 then
    v_related := v_related || array(
      select x.id from public.articles x
      where public.site_is_live(x.status, x.published_at) and x.id <> a.id and x.id <> all(v_related)
        and (
          exists (
            select 1 from public.article_tags mine join public.article_tags theirs on theirs.tag_id = mine.tag_id
            where mine.article_id = a.id and theirs.article_id = x.id
          )
          or x.section_id = a.section_id
        )
      order by
        (select count(*) from public.article_tags mine join public.article_tags theirs on theirs.tag_id = mine.tag_id
         where mine.article_id = a.id and theirs.article_id = x.id) desc,
        x.published_at desc, x.id
      limit 3 - cardinality(v_related)
    );
  end if;

  v_more := array(
    select x.id from public.articles x
    where public.site_is_live(x.status, x.published_at) and x.section_id = a.section_id and x.id <> a.id and x.id <> all(v_related)
    order by x.published_at desc, x.id
    limit 3
  );

  return public.site_card(a.id) || jsonb_build_object(
    'body', a.body,
    'sources', a.sources,
    'leadCaption', a.lead_caption,
    'tags', coalesce((
      select jsonb_agg(jsonb_build_object('name', t.name, 'slug', t.slug) order by t.name)
      from public.article_tags tg join public.tags t on t.id = tg.tag_id
      where tg.article_id = a.id
    ), '[]'::jsonb),
    'media', coalesce((
      select jsonb_agg(public.site_image(m.id) || jsonb_build_object('id', m.id))
      from public.media m
      where m.id in (select public.body_media_ids(a.body))
    ), '[]'::jsonb),
    'links', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'slug', x.slug, 'section', s.slug))
      from public.articles x
      left join public.sections s on s.id = x.section_id
      where public.site_is_live(x.status, x.published_at)
        and x.id::text in (
          select v #>> '{}' from jsonb_path_query(a.body, 'lax $.content[*] ? (@.type == "readMore").attrs.articleId') as v
        )
    ), '[]'::jsonb),
    'related', public.site_cards(v_related),
    'more', public.site_cards(v_more)
  );
end;
$$;

-- Full-text search over published articles (headline, standfirst, text), best match first.
-- Returns {total, rows}; an empty or stop-word-only query finds nothing.
create or replace function public.site_search(p_query text, p_limit integer default 20, p_offset integer default 0)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_query tsquery;
  v_total integer;
  v_ids uuid[];
begin
  v_query := websearch_to_tsquery('english', left(coalesce(p_query, ''), 200));
  if numnode(v_query) = 0 then
    return jsonb_build_object('total', 0, 'rows', '[]'::jsonb);
  end if;
  with matching as (
    select a.id, a.published_at, ts_rank(a.search, v_query) as rank
    from public.articles a
    where public.site_is_live(a.status, a.published_at) and a.search @@ v_query
  )
  select
    (select count(*)::integer from matching),
    array(select m.id from matching m order by m.rank desc, m.published_at desc, m.id limit greatest(p_limit, 0) offset greatest(p_offset, 0))
  into v_total, v_ids;
  return jsonb_build_object('total', v_total, 'rows', public.site_cards(v_ids));
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.site_image(uuid)',
    'public.site_is_live(public.article_status, timestamptz)',
    'public.site_card(uuid)',
    'public.site_cards(uuid[])',
    'public.site_list(text, text, integer, integer, timestamptz)',
    'public.site_home(integer, integer, integer)',
    'public.site_article(text)',
    'public.site_search(text, integer, integer)',
    -- Pure helper from Plan 3, needed by site_article for body images.
    'public.body_media_ids(jsonb)'
  ] loop
    execute format('revoke all on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated, service_role', f);
  end loop;
end;
$$;
```

### `tests/db/site.test.ts`

```ts
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
```

### `tests/e2e/foundation.spec.ts`

```ts
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
```

### `tests/e2e/helpers.ts`

```ts
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
```

### `tests/e2e/site.spec.ts`

```ts
import { expect, type Page, test } from '@playwright/test';
import { CRON_SECRET, expectNoAxeViolations, READY_BODY, revalidateSite, seedArticle, seedTaxonomy, signIn, slugFor, sql, unique } from './helpers';

// The public site against the fake Supabase. Tests seed with SQL, so they drop the cache themselves
// (revalidateSite); the Newsroom flow at the end checks that the Newsroom does it on its own.

const main = (page: Page) => page.getByRole('main');

/** Seeds a section, author and tag, a published article in them and a draft in the same section. */
async function seedStory(label: string, extra: Partial<Parameters<typeof seedArticle>[0]> = {}) {
  const taxonomy = await seedTaxonomy(label);
  const title = extra.title ?? unique(`${label} story`);
  const draft = unique(`${label} draft`);
  const id = await seedArticle({ ready: true, status: 'published', sectionId: taxonomy.section.id, authorId: taxonomy.author.id, tagId: taxonomy.tag.id, ...extra, title });
  await seedArticle({ title: draft, ready: true, status: 'draft', sectionId: taxonomy.section.id, authorId: taxonomy.author.id });
  await revalidateSite();
  return { ...taxonomy, id, title, draft, href: `/${taxonomy.section.slug}/${slugFor(title)}` };
}

/** A missing page is a soft 404 (noindex) on its first visit and a real 404 once cached. */
async function expectMissing(page: Page, path: string) {
  const first = await page.request.get(path);
  if (first.status() === 200) expect(await first.text()).toContain('<meta name="robots" content="noindex"/>');
  else expect(first.status()).toBe(404);
  await expect.poll(async () => (await page.request.get(path)).status()).toBe(404);
}

test('shows published articles on the front page, their section, author and tag pages, and hides drafts', async ({ page }) => {
  const story = await seedStory('Site');
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: story.section.name })).toBeVisible();
  await expect(main(page).getByRole('link', { name: new RegExp(story.title) }).first()).toBeVisible();
  await expect(page.getByText(story.draft)).toHaveCount(0);

  await page.goto(story.href);
  await expect(page.getByRole('heading', { level: 1, name: story.title })).toBeVisible();
  await expect(page).toHaveTitle(`${story.title} · PressCompass`);
  await expect(page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: story.section.name })).toHaveAttribute('aria-current', 'true');
  await expect(main(page).getByRole('link', { name: story.author.name })).toHaveAttribute('href', `/author/a-${story.key}`);
  await main(page).getByRole('link', { name: story.tag.name }).click();
  await page.waitForURL(`**/tag/t-${story.key}`);
  await expect(page.getByRole('heading', { level: 1, name: story.tag.name })).toBeVisible();
  await expect(main(page).getByRole('link', { name: new RegExp(story.title) })).toBeVisible();

  await page.goto(`/author/a-${story.key}`);
  await expect(page.getByRole('heading', { level: 1, name: story.author.name })).toBeVisible();
  await expect(main(page).getByText('1 article', { exact: true })).toBeVisible();

  await page.goto(`/${story.section.slug}`);
  await expect(page.getByRole('heading', { level: 1, name: story.section.name })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: story.section.name })).toHaveAttribute('aria-current', 'page');
  await expect(main(page).getByRole('link', { name: new RegExp(story.title) })).toBeVisible();
  await expect(page.getByText(story.draft)).toHaveCount(0);

  await expectMissing(page, `/${story.section.slug}/${slugFor(story.draft)}`);
  await expectMissing(page, `/${unique('nowhere').replace(/\W+/g, '-')}`);
});

test('sends wrong sections and changed addresses to the article with a permanent redirect', async ({ page }) => {
  const story = await seedStory('Moved');
  await page.goto(`/news-${story.key}/${slugFor(story.title)}`);
  await expect(page).toHaveURL(new RegExp(`${story.href}$`));

  const newSlug = `${slugFor(story.title)}-updated`;
  await sql(`update public.articles set slug = $1 where id = $2`, [newSlug, story.id]);
  await revalidateSite();
  await page.goto(story.href);
  await expect(page).toHaveURL(new RegExp(`/${story.section.slug}/${newSlug}$`));
  await expect(page.getByRole('heading', { level: 1, name: story.title })).toBeVisible();
  await expect.poll(async () => (await page.request.get(story.href, { maxRedirects: 0 })).status()).toBe(308);
});

test('pages through a section', async ({ page }) => {
  const { section } = await seedTaxonomy('Paged');
  await sql(
    `insert into public.articles (title, slug, section_id, status, published_at)
     select 'Paged story ' || n, $2 || '-' || n, $1, 'published', now() - (n || ' minutes')::interval from generate_series(1, 25) n`,
    [section.id, section.slug],
  );
  await revalidateSite();
  await page.goto(`/${section.slug}`);
  await expect(main(page).getByText('25 articles')).toBeVisible();
  await expect(main(page).getByRole('link', { name: /Paged story/ })).toHaveCount(24);
  await page.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name: 'Older articles' }).click();
  await page.waitForURL(`**/${section.slug}/page/2`);
  await expect(main(page).getByRole('link', { name: /Paged story 25/ })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Pages' })).toContainText('Page 2 of 2');
  await expectMissing(page, `/${section.slug}/page/3`);
});

test('finds published articles by their words', async ({ page }) => {
  const word = `zq${Date.now().toString(36)}`;
  const story = await seedStory('Search', { title: `The ${word} harbour reopens` });
  await sql(`update public.articles set title = $1 where title = $2`, [`The ${word} harbour draft`, story.draft]);
  await revalidateSite();
  await page.goto('/search');
  await page.getByRole('searchbox', { name: 'Search PressCompass' }).first().fill(word);
  await main(page).getByRole('button', { name: 'Search' }).click();
  await page.waitForURL(`**/search?q=${word}`);
  await expect(main(page).getByRole('status')).toHaveText(`1 result for “${word}”`);
  await expect(main(page).getByRole('link', { name: new RegExp(`The ${word} harbour reopens`) })).toBeVisible();
  await page.goto(`/search?q=${word}nothing`);
  await expect(main(page).getByRole('status')).toContainText('Nothing found');
});

test('draws chart blocks with a table for screen readers', async ({ page }) => {
  const body = {
    type: 'doc',
    content: [
      ...READY_BODY.content,
      {
        type: 'chart',
        attrs: { kind: 'bar', title: 'Annual food inflation', subtitle: 'Per cent', source: 'BPS', axis: 'Month', labels: ['May', 'Jun', 'Jul'], series: [{ name: 'Inflation', values: [4.1, 3.8, 2.1] }] },
      },
    ],
  };
  const story = await seedStory('Chart', { body });
  await page.goto(story.href);
  const chart = main(page).getByRole('figure').filter({ hasText: 'Annual food inflation' });
  await expect(chart.locator('svg rect')).toHaveCount(3);
  await expect(chart.getByRole('table', { name: 'Annual food inflation. Per cent' })).toBeAttached();
  await expect(chart).toContainText('Source: BPS');
});

test('publishes scheduled articles when the cron endpoint runs', async ({ page }) => {
  const { section, author } = await seedTaxonomy('Cron');
  const title = unique('Cron story');
  const id = await seedArticle({ title, ready: true, status: 'scheduled', scheduledAt: new Date(Date.now() - 60_000), sectionId: section.id, authorId: author.id });
  expect((await page.request.get('/api/cron/run')).status()).toBe(401);
  const run = await page.request.get('/api/cron/run', { headers: { authorization: `Bearer ${CRON_SECRET}` } });
  expect(run.status()).toBe(200);
  expect(await run.json()).toMatchObject({ ok: true });
  expect((await sql<{ status: string }>(`select status from public.articles where id = $1`, [id]))[0].status).toBe('published');
  await page.goto(`/${section.slug}/${slugFor(title)}`);
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
});

test('keeps the reader’s theme choice', async ({ page }) => {
  await page.goto('/');
  const theme = page.getByRole('group', { name: 'Theme' });
  await theme.getByRole('button', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(11, 21, 36)');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(theme.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
  await theme.getByRole('button', { name: 'Auto' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./);
});

test('opens the section menu and copies an article link', async ({ page, context }, testInfo) => {
  const story = await seedStory('Menu');
  await page.goto('/');
  await page.getByRole('button', { name: 'Menu' }).click();
  const menu = page.locator('[popover]:popover-open');
  await expect(menu.getByRole('link', { name: story.section.name })).toBeVisible();
  await menu.getByRole('button', { name: 'Close menu' }).click();
  await expect(menu).toHaveCount(0);

  test.skip(testInfo.project.name === 'mobile', 'Clipboard permissions are a desktop browser feature here.');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(story.href);
  await main(page).getByRole('button', { name: 'Copy link' }).click();
  await expect(main(page).getByRole('status').filter({ hasText: 'Link copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`http://localhost:3100${story.href}`);
});

test('public pages are accessible in both themes and fit a phone', async ({ page }, testInfo) => {
  const story = await seedStory('Axe');
  for (const path of ['/', story.href, `/${story.section.slug}`, `/author/a-${story.key}`, '/search?q=story', '/not-a-page']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expectNoAxeViolations(page);
    await page.emulateMedia({ colorScheme: 'dark' });
    await expectNoAxeViolations(page);
    await page.emulateMedia({ colorScheme: 'light' });
    if (testInfo.project.name === 'mobile') {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBe(0);
    }
  }
});

test.describe('from the Newsroom', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'Editor flows run on desktop.');
  });

  test('publishing in the Newsroom shows the article on the site straight away', async ({ page }) => {
    const { section, author } = await seedTaxonomy('Live');
    const title = unique('Live story');
    const id = await seedArticle({ title, ready: true, sectionId: section.id, authorId: author.id });
    const href = `/${section.slug}/${slugFor(title)}`;
    await page.goto(href);
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();

    await signIn(page, `/newsroom/articles/${id}`);
    await page.getByRole('button', { name: 'Publish now' }).click();
    await expect(main(page).getByRole('status').filter({ hasText: 'Published.' })).toBeVisible();
    // The Newsroom expires the cache after one second (src/modules/site/invalidate.ts).
    await expect(async () => {
      await page.goto(href);
      await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible({ timeout: 1000 });
    }).toPass();

    await page.goto(`/newsroom/articles/${id}`);
    await page.getByRole('textbox', { name: 'Headline' }).fill(`${title} (updated)`);
    await page.getByRole('button', { name: 'Update', exact: true }).click();
    await expect(main(page).getByRole('status').filter({ hasText: 'Update published.' })).toBeVisible();
    await expect(async () => {
      await page.goto(href);
      await expect(page.getByRole('heading', { level: 1, name: `${title} (updated)` })).toBeVisible({ timeout: 1000 });
    }).toPass();
  });
});
```

### `tests/unit/article-body.test.tsx`

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Doc } from '@/lib/doc/schema';
import { ArticleBody } from '@/modules/content/ArticleBody';

const doc = (content: unknown[]) => ({ type: 'doc', content }) as Doc;

const IMAGE = '2c9e7a2b-3d4f-4a5b-8c6d-7e8f9a0b1c2d';

describe('ArticleBody', () => {
  it('renders images from the media library with caption and credit, and skips deleted ones', () => {
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = 'demo';
    const html = renderToStaticMarkup(
      <ArticleBody
        media={new Map([[IMAGE, { publicId: 'presscompass/images/rice-abcd1234', width: 1600, height: 900, alt: 'Farmers in Karawang', credit: 'Rani/PressCompass' }]])}
        doc={doc([
          { type: 'image', attrs: { mediaId: IMAGE, caption: 'The harvest came early.' } },
          { type: 'image', attrs: { mediaId: '3c9e7a2b-3d4f-4a5b-8c6d-7e8f9a0b1c2d', caption: 'Gone' } },
        ])}
      />,
    );
    expect(html).toContain('alt="Farmers in Karawang"');
    expect(html).toContain('width="1600" height="900"');
    expect(html).toContain('srcSet="https://res.cloudinary.com/demo/image/upload/c_limit,w_320,f_auto,q_auto/presscompass/images/rice-abcd1234 320w');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('<figcaption>The harvest came early. <span class="credit">Photo: Rani/PressCompass</span></figcaption>');
    expect(html).not.toContain('Gone');
  });

  it('draws bar charts as SVG with a data table for screen readers', () => {
    const html = renderToStaticMarkup(
      <ArticleBody
        doc={doc([
          {
            type: 'chart',
            attrs: { kind: 'bar', title: 'Annual food inflation', subtitle: 'Per cent', source: 'BPS', axis: 'Month', labels: ['May', 'Jun', 'Jul'], series: [{ name: 'Inflation', values: [4.1, -0.5, 2.1] }] },
          },
        ])}
      />,
    );
    expect(html.match(/<rect /g)).toHaveLength(3);
    // The last bar is highlighted, like the locked preview; negative values get a true minus sign.
    expect(html).toContain('class="bar two"');
    expect(html).toContain('>\u22120.5</text>');
    expect(html).toContain('<svg viewBox="0 0 640 260" aria-hidden="true" focusable="false">');
    expect(html).toContain('<caption>Annual food inflation. Per cent</caption>');
    expect(html).toContain('<th scope="col">Month</th><th scope="col">Inflation</th>');
    expect(html).toContain('<tr><th scope="row">Jun</th><td>\u22120.5</td></tr>');
    expect(html).toContain('<figcaption class="source">Source: BPS</figcaption>');
  });

  it('draws line charts with end labels and gaps for missing values', () => {
    const html = renderToStaticMarkup(
      <ArticleBody
        doc={doc([
          {
            type: 'chart',
            attrs: {
              kind: 'line',
              title: 'Prices',
              subtitle: '',
              source: '',
              axis: '',
              labels: ['W1', 'W2', 'W3', 'W4'],
              series: [
                { name: 'Retail', values: [100, 99, 99, 99] },
                { name: 'Farm', values: [100, null, 92, 88] },
              ],
            },
          },
        ])}
      />,
    );
    expect(html.match(/<polyline /g)).toHaveLength(2);
    expect(html.match(/<circle /g)).toHaveLength(1);
    expect(html).toContain('>Retail 99</text>');
    expect(html).toContain('>Farm 88</text>');
    expect(html).toContain('<td>No data</td>');
    expect(html).not.toContain('Source:');
  });

  it('renders text blocks with their marks', () => {
    const html = renderToStaticMarkup(
      <ArticleBody
        doc={doc([
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'What changed' }] },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Prices ' },
              { type: 'text', text: 'rose', marks: [{ type: 'bold' }, { type: 'link', attrs: { href: 'https://bps.go.id' } }] },
              { type: 'hardBreak' },
              { type: 'text', text: 'again', marks: [{ type: 'italic' }] },
            ],
          },
          { type: 'paragraph' },
          { type: 'orderedList', attrs: { start: 2 }, content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Two' }] }] }] },
        ])}
      />,
    );
    expect(html).toContain('<h2>What changed</h2>');
    expect(html).toContain('<a href="https://bps.go.id" rel="noopener"><strong>rose</strong></a><br/><em>again</em>');
    expect(html).toContain('<ol start="2"><li><p>Two</p></li></ol>');
    expect(html.match(/<p>/g)).toHaveLength(2);
  });

  it('never renders a link it does not trust', () => {
    const html = renderToStaticMarkup(
      <ArticleBody doc={doc([{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }])} />,
    );
    expect(html).toBe('<div class="body"><p>x</p></div>');
  });

  it('renders the special blocks', () => {
    const id = '0b8a6f5e-58a8-4d5c-9b8e-0a5b8a1c2d3e';
    const html = renderToStaticMarkup(
      <ArticleBody
        links={new Map([[id, { title: 'Earlier story', href: '/business/earlier-story' }]])}
        doc={doc([
          { type: 'pullQuote', attrs: { text: 'We are not done.', attribution: 'Finance minister' } },
          { type: 'editorNote', attrs: { kind: 'correction', date: '2026-11-13', text: 'An earlier version misstated the figure.' } },
          { type: 'keyFigures', attrs: { title: 'Harvest', items: [{ value: '31.5m', label: 'tonnes' }], source: 'BPS' } },
          { type: 'readMore', attrs: { articleId: id, title: 'Old title' } },
          { type: 'readMore', attrs: { articleId: '1b8a6f5e-58a8-4d5c-9b8e-0a5b8a1c2d3e', title: 'Deleted story' } },
          { type: 'youtube', attrs: { videoId: 'dQw4w9WgXcQ', title: 'Briefing' } },
        ])}
      />,
    );
    expect(html).toContain('<blockquote><p>We are not done.</p></blockquote><figcaption>Finance minister</figcaption>');
    expect(html).toContain('<b>Correction · 13 Nov 2026.</b> An earlier version misstated the figure.');
    expect(html).toContain('<dd class="figValue">31.5m</dd>');
    expect(html).toContain('Source: BPS');
    expect(html).toContain('<a href="/business/earlier-story">Earlier story</a>');
    expect(html).not.toContain('Deleted story');
    expect(html).toContain('Play video: Briefing');
    expect(html).not.toContain('<iframe');
  });
});
```

### `tests/unit/chart.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { chartScale, chartTable, cleanChart, formatChartNumber, parseCell, parseChartTable } from '@/lib/doc/chart';
import { sanitizeDoc } from '@/lib/doc/sanitize';

describe('parseChartTable', () => {
  it('reads a table pasted from a spreadsheet', () => {
    const text = 'Month\tFood inflation\nMay\t4.1%\nJun\t3.8\nJul\t−0.5\nAug\t\n';
    expect(parseChartTable(text, 'bar')).toEqual({
      axis: 'Month',
      labels: ['May', 'Jun', 'Jul', 'Aug'],
      series: [{ name: 'Food inflation', values: [4.1, 3.8, -0.5, null] }],
    });
  });

  it('reads comma-separated text and names unnamed columns', () => {
    expect(parseChartTable('Week,Retail,\nW1,100,100\nW2,99,96', 'line')).toEqual({
      axis: 'Week',
      labels: ['W1', 'W2'],
      series: [
        { name: 'Retail', values: [100, 99] },
        { name: 'Series 2', values: [100, 96] },
      ],
    });
  });

  it('explains what is wrong with the data', () => {
    expect(parseChartTable('Month\tValue\nMay\t4', 'bar')).toEqual({
      error: 'Paste a header row and at least two rows of data: labels in the first column, numbers in the next.',
    });
    expect(parseChartTable('M\tA\tB\tC\nx\t1\t2\t3\ny\t1\t2\t3', 'bar')).toEqual({ error: 'A bar chart takes one or two columns of numbers.' });
    expect(parseChartTable('M\tA\tB\tC\tD\nx\t1\t2\t3\t4\ny\t1\t2\t3\t4', 'line')).toEqual({ error: 'A line chart takes one to three columns of numbers.' });
    expect(parseChartTable('M\tA\nx\t1\ny\tlots', 'bar')).toEqual({ error: 'Row 3: "lots" is not a number.' });
    expect(parseChartTable('M\tA\nx\t1\n\t2', 'bar')).toEqual({ error: 'Row 3 needs a label in the first column.' });
    expect(parseChartTable('M\tA\nx\t\ny\t-', 'bar')).toEqual({ error: 'Each column of numbers needs at least one value.' });
    expect(parseChartTable(['M\tA', ...Array.from({ length: 25 }, (_, i) => `r${i}\t${i}`)].join('\n'), 'bar')).toEqual({
      error: 'Use at most 24 rows of data.',
    });
  });

  it('round-trips through the editing table', () => {
    const parsed = parseChartTable('Week\tRetail\tFarm\nW1\t100\t100\nW2\t99\t', 'line');
    expect('error' in parsed).toBe(false);
    if ('error' in parsed) return;
    expect(chartTable(parsed)).toBe('Week\tRetail\tFarm\nW1\t100\t100\nW2\t99\t');
    expect(parseChartTable(chartTable(parsed), 'line')).toEqual(parsed);
  });
});

describe('chart numbers', () => {
  it('parses cells and keeps thousands separators only in tab-separated tables', () => {
    expect(parseCell('12,400', true)).toBe(12400);
    expect(parseCell(' 2.5 % ', false)).toBe(2.5);
    expect(parseCell('–', false)).toBeNull();
    expect(parseCell('1e5', false)).toBeUndefined();
    expect(formatChartNumber(-2)).toBe('−2');
    expect(formatChartNumber(12400.5)).toBe('12,400.5');
  });

  it('picks round axis steps that include zero', () => {
    expect(chartScale([4.1, 3.8, 2.1])).toEqual({ min: 0, max: 6, ticks: [0, 2, 4, 6] });
    expect(chartScale([88, 105])).toEqual({ min: 0, max: 150, ticks: [0, 50, 100, 150] });
    expect(chartScale([-3, 2])).toEqual({ min: -4, max: 2, ticks: [-4, -2, 0, 2] });
    expect(chartScale([0])).toEqual({ min: 0, max: 1, ticks: [0, 0.25, 0.5, 0.75, 1] });
    expect(chartScale([88, 92, 99], { zero: false })).toEqual({ min: 85, max: 100, ticks: [85, 90, 95, 100] });
  });
});

describe('chart blocks in the body', () => {
  it('keeps valid charts and drops ones without data', () => {
    const chart = { kind: 'line', title: ' Prices ', subtitle: 'Index', source: 'BPS', axis: 'Week', labels: ['W1', 'W2'], series: [{ name: 'Retail', values: [100, '99'] }], extra: 1 };
    expect(sanitizeDoc({ type: 'doc', content: [{ type: 'chart', attrs: chart }, { type: 'chart', attrs: { labels: ['a'] } }] }).content).toEqual([
      { type: 'chart', attrs: { kind: 'line', title: 'Prices', subtitle: 'Index', source: 'BPS', axis: 'Week', labels: ['W1', 'W2'], series: [{ name: 'Retail', values: [100, null] }] } },
    ]);
    expect(cleanChart({ kind: 'bar', labels: ['a', 'b'], series: [{ name: 'x', values: [null, null] }] })).toBeNull();
    expect(cleanChart({ kind: 'bar', labels: ['a', 'b'], series: [1, 2, 3].map((n) => ({ name: `s${n}`, values: [n, n] })) })?.series).toHaveLength(2);
  });
});
```

### `tests/unit/cron-auth.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { checkCronAuth, cronAuthResponse } from '@/lib/cron-auth';

const SECRET = 'a'.repeat(40);

describe('checkCronAuth', () => {
  it('accepts only the exact bearer secret', () => {
    expect(checkCronAuth(`Bearer ${SECRET}`, SECRET)).toBe('ok');
    expect(checkCronAuth(`Bearer ${SECRET}x`, SECRET)).toBe('denied');
    expect(checkCronAuth(SECRET, SECRET)).toBe('denied');
    expect(checkCronAuth(null, SECRET)).toBe('denied');
  });

  it('refuses everything until a long enough secret is set', async () => {
    expect(checkCronAuth('Bearer short', 'short')).toBe('not-configured');
    expect(checkCronAuth('Bearer ', undefined)).toBe('not-configured');
    const response = cronAuthResponse('not-configured');
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: 'CRON_SECRET is not set (at least 32 characters).' });
    expect(cronAuthResponse('denied').status).toBe(401);
  });
});
```

### `tests/unit/site-format.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { articleDateLine, articleHref, cardMeta, initials, kickerFor, names, pageNumber } from '@/modules/site/format';

const card = { isBreaking: false, kicker: '', type: 'news' as const, section: { name: 'Business', slug: 'business' } };

describe('site formatting', () => {
  it('builds article addresses', () => {
    expect(articleHref({ slug: 'rice-prices', section: { slug: 'business' } })).toBe('/business/rice-prices');
    expect(articleHref({ slug: 'rice-prices', section: 'politics' })).toBe('/politics/rice-prices');
    expect(articleHref({ slug: 'orphan', section: null })).toBe('/news/orphan');
  });

  it('chooses the kicker: breaking, editor label, type, then section', () => {
    expect(kickerFor({ ...card, isBreaking: true, kicker: 'Markets' })).toEqual({ text: 'Breaking', tone: 'live' });
    expect(kickerFor({ ...card, kicker: 'Markets', type: 'analysis' })).toEqual({ text: 'Markets', tone: 'default' });
    expect(kickerFor({ ...card, type: 'explainer' })).toEqual({ text: 'Explainer', tone: 'plain' });
    expect(kickerFor(card)).toEqual({ text: 'Business', tone: 'default' });
    expect(kickerFor(card, { hideSection: true })).toBeNull();
  });

  it('writes bylines, initials and card lines', () => {
    expect(names([])).toBe('');
    expect(names([{ name: 'Rani' }, { name: 'Bima' }, { name: 'Ayu' }])).toBe('Rani, Bima and Ayu');
    expect(initials('Rani Prameswari')).toBe('RP');
    expect(initials('Plato')).toBe('P');
    const article = { authors: [{ name: 'Rani', slug: 'rani', role: '', photo: null }], publishedAt: '2026-11-12T12:50:00Z', readingMinutes: 6 };
    expect(cardMeta(article)).toBe('Rani · 12 Nov 2026');
    expect(cardMeta({ ...article, authors: [] }, { minutes: true })).toBe('12 Nov 2026 · 6 min read');
  });

  it('dates articles in WIB with the update time when it changed later', () => {
    expect(articleDateLine('2026-11-12T12:50:00Z', null, 6)).toBe('12 Nov 2026 · 19:50 WIB · 6 min read');
    expect(articleDateLine('2026-11-12T12:50:00Z', '2026-11-12T13:15:00Z', 6)).toBe('12 Nov 2026 · 19:50 WIB · Updated 20:15 · 6 min read');
    expect(articleDateLine('2026-11-12T12:50:00Z', '2026-11-13T01:00:00Z', 0)).toBe('12 Nov 2026 · 19:50 WIB · Updated 13 Nov · 08:00');
    expect(articleDateLine('2026-11-12T12:50:00Z', '2026-11-12T12:50:20Z', 0)).toBe('12 Nov 2026 · 19:50 WIB');
  });

  it('reads page numbers from addresses', () => {
    expect(pageNumber('2')).toBe(2);
    expect(pageNumber('1')).toBeNull();
    expect(pageNumber('02')).toBeNull();
    expect(pageNumber('x')).toBeNull();
  });
});
```

### `vercel.json`

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["sin1"],
  "crons": [{ "path": "/api/cron/run", "schedule": "0 23 * * *" }]
}
```
