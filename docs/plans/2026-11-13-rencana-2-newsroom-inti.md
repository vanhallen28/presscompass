# Rencana 2 · Newsroom inti (v0.2.0)

> **Untuk agen:** jalankan task demi task (skill executing-plans), TDD, commit per task. Kode akhir setiap file ada di lampiran di bagian bawah dokumen ini (dibuat dari repo setelah eksekusi).

**Tujuan:** pemilik bisa mengelola rubrik, tag, dan penulis, lalu menulis artikel di editor blok dengan alur draf → review → jadwal/terbit → arsip, autosave, riwayat versi, dan pratinjau.

**Arsitektur:**
- Logika murni (slug, dokumen editor, alur status, aturan terbit, waktu WIB) diuji unit.
- Penyimpanan artikel atomik lewat satu fungsi SQL `save_article` (cek versi, slug unik, relasi, riwayat) yang berjalan dengan sesi pemilik, jadi RLS tetap berlaku.
- Redirect 308 otomatis dibuat trigger database saat alamat publik berubah.
- E2E memakai PostgreSQL sungguhan lewat Supabase tiruan yang menerjemahkan permintaan supabase-js ke SQL dengan peran dan RLS yang sama.

**Stack:** Next.js 16.4.6 (Cache Components), Supabase (`@supabase/ssr`, `@supabase/supabase-js`), Tiptap 3.32.3 (inti MIT), Vitest, Playwright.

## Batasan global

- Semua teks yang dilihat pemilik di Newsroom berbahasa Inggris (British, sentence case, tanpa tanda seru).
- Tanpa Docker. Tes database dan E2E memakai PostgreSQL biasa.
- Setiap halaman, layout, dan Server Action Newsroom memanggil `requireStaff()`.
- Migrasi hanya menambah, dengan RLS dan tes di `tests/db/`.
- Komponen memakai token CSS design system, bukan warna tetap.
- Zona waktu tampilan dan input jadwal: WIB (Asia/Jakarta, UTC+7). Database tetap UTC.

## Keputusan rencana

| Topik | Keputusan |
|---|---|
| Lingkup blok isi | Paragraf, H2, H3, daftar, kutipan, Pull quote, Editor's note (update atau koreksi), Key figures (2 sampai 4), tabel, YouTube (klik untuk memuat), kartu Read more, pemisah. **Gambar** (blok dan gambar utama) ikut Rencana 3 karena butuh pustaka media. **Chart** ikut Rencana 4 karena digambar SVG oleh situs. |
| Aturan terbit v0.2.0 | Judul, slug sudah diisi (bukan `untitled-…`) dan unik, rubrik, minimal satu penulis, standfirst, isi minimal 150 kata. Aturan gambar utama dengan alt ditambahkan di Rencana 3. |
| Tab SEO di editor | Rencana 6. Kolom `seo` tidak diubah editor v0.2.0. |
| Alur status | draft → review → published/scheduled → archived. Satu tombol utama per status (langkah maju berikutnya), aksi lain di bawahnya. Unpublish, Archive, dan Delete meminta konfirmasi. Artikel terbit tidak bisa dihapus; batalkan terbit atau arsipkan dulu. |
| Autosave | Setiap 10 detik bila ada perubahan, hanya untuk Draft dan In review. Artikel terjadwal dan terbit disimpan lewat tombol (Save changes / Update) supaya perubahan ke situs live selalu disengaja. |
| Riwayat versi | Satu versi per simpan manual dan per perubahan status; autosave paling banyak satu versi per 10 menit; 50 versi terakhir per artikel. Restore menyimpan keadaan sekarang dulu ("Before restore"). |
| Tabrakan dua jendela | Kolom `version` naik di setiap update (trigger). Simpan dengan versi lama ditolak: "This article changed in another window." |
| Slug | Otomatis dari judul sampai diubah manual atau artikel pernah terbit. Slug otomatis yang bentrok diberi akhiran `-2`, `-3`; slug manual yang bentrok ditolak dengan pesan di kolom slug. |
| Redirect otomatis | Trigger: alamat artikel terbit berubah (slug atau rubrik), slug rubrik berubah (rubrik + artikel terbitnya), slug tag atau penulis berubah (bila punya artikel terbit). Rantai dipendekkan jadi satu lompatan. |
| Terbit terjadwal | Fungsi `publish_due_articles()` dipanggil setiap halaman Newsroom dibuka. Pemanggil otomatis (cron `/api/cron/run`) datang bersama situs publik dan revalidasi cache. |
| Tag baru dari editor | Belum: tag dibuat di halaman Tags. Ditinjau lagi setelah dipakai. |
| E2E | `tests/fake-supabase/` menggantikan `tests/e2e/mock-supabase.mjs`: Auth tiruan + REST yang menjalankan SQL sungguhan di PostgreSQL lokal (database `presscompass_e2e`) dengan peran `anon`/`authenticated`/`service_role` dan klaim JWT. Data API yang kompleks dibaca lewat fungsi SQL (RPC), jadi penerjemah cukup mendukung filter sederhana. |

## Struktur file

| File | Tanggung jawab |
|---|---|
| `supabase/migrations/20261114000100_newsroom_core.sql` | trigger versi, redirect otomatis, pangkas riwayat; fungsi `save_article`, `record_revision`, `set_article_status`, `publish_due_articles`, `newsroom_articles`, `article_status_counts`, `newsroom_usage`, `newsroom_dashboard` |
| `src/lib/slug.ts` | `slugify`, `isSlug`, `RESERVED_SLUGS` |
| `src/lib/time.ts` | `parseWibInput`, `toWibInput`, `formatWib`, `wibDayStart` |
| `src/lib/doc/schema.ts`, `sanitize.ts`, `text.ts` | model dokumen editor, sanitasi allowlist, teks polos dan hitung kata |
| `src/modules/editor/status.ts` | aksi per status, rencana transisi, label dan catatan riwayat |
| `src/modules/editor/rules.ts` | aturan terbit → galat per kolom |
| `src/modules/editor/input.ts` | validasi bentuk input editor dari klien |
| `src/modules/editor/queries.ts`, `actions.ts` | baca dan tulis artikel (server) |
| `src/modules/taxonomy/validate.ts`, `queries.ts`, `actions.ts` | rubrik, tag, penulis |
| `src/modules/content/ArticleBody.tsx` | render dokumen ke React (pratinjau sekarang, situs di Rencana 4) |
| `src/components/newsroom/*` | kit UI Newsroom: Field, SelectField, StatusBadge, Notice, ConfirmButton, PageHeader, tabel |
| `src/components/newsroom/editor/*` | editor Tiptap, toolbar, node view, dialog blok |
| `src/app/newsroom/(app)/{articles,sections,tags,authors}/…` | halaman Newsroom |
| `src/app/newsroom/preview/[id]/page.tsx` | pratinjau artikel |
| `tests/fake-supabase/*` | Supabase tiruan untuk E2E dan pratinjau lokal |

## Task

### Task 1: Supabase tiruan dengan PostgreSQL sungguhan
- Pindahkan Auth tiruan ke `tests/fake-supabase/auth.mjs`; tambah `rest.mjs` (select dengan kolom, filter `eq/neq/gt/gte/lt/lte/like/ilike/is/in`, `order`, `limit/offset`, `count=exact`, objek tunggal; insert/upsert; update; delete; RPC dengan argumen bernama); `database.mjs` membuat database baru dari stub + migrasi + dua pengguna.
- Playwright dan CI job `e2e` menjalankan PostgreSQL runner (`scripts/ci-postgres.sh`).
- Tes: E2E fondasi lama tetap lulus dengan Supabase tiruan baru.

### Task 2: Migrasi newsroom_core + tes database
- Tes dulu (`tests/db/newsroom.test.ts`): versi naik; konflik versi; slug bentrok (manual ditolak, otomatis diberi akhiran); relasi berurutan; riwayat (dicatat, dibatasi 10 menit untuk autosave, dipangkas ke 50); redirect artikel, rubrik, rantai, kembali ke alamat lama; `publish_due_articles`; daftar dan hitungan; non-staf dan `anon` ditolak.

### Task 3: Kit UI Newsroom dan menu
- Field, SelectField, Checkbox, StatusBadge (ikon + kata), Notice, ConfirmButton (`<dialog>`), PageHeader, gaya tabel dari preview terkunci; menu sidebar Content: Articles, Sections, Tags, Authors.

### Task 4: Rubrik, tag, penulis
- Tes unit validasi (nama, slug otomatis, slug dicadangkan, deskripsi, tautan penulis https).
- Halaman daftar (jumlah artikel), buat, ubah, hapus (diblokir bila dipakai artikel), urutan rubrik (naik/turun), tampil di navigasi.
- E2E: buat rubrik, ubah slug, hapus; tag; penulis.

### Task 5: Inti editor murni
- `slugify`, dokumen (sanitasi, teks, kata, menit baca), alur status, aturan terbit, waktu WIB, validasi input. Semua TDD.

### Task 6: Render artikel dan pratinjau
- `ArticleBody` (tanpa `dangerouslySetInnerHTML`; tautan hanya http, https, mailto, relatif; YouTube `youtube-nocookie.com` setelah klik).
- Halaman pratinjau dengan tipografi artikel dari preview terkunci dan pita "Preview".

### Task 7: Daftar artikel
- Tab status dengan jumlah, cari, filter rubrik dan penulis, halaman 25 baris, aksi massal (Publish, Unpublish, Archive, Delete) dengan laporan artikel yang belum memenuhi aturan terbit; tombol New article (Server Action, bukan GET).

### Task 8: Editor artikel
- Judul, standfirst, isi Tiptap dengan toolbar dan blok khusus (dialog di portal), panel: status, slug, rubrik, jenis, label kicker, penulis berurutan, tag, breaking, sumber, artikel terkait, Major update.
- Autosave, status simpan, peringatan saat meninggalkan halaman, konflik versi, galat aturan terbit di kolomnya.
- E2E: tulis artikel → autosave → kirim review → terbit; jadwal; batalkan terbit; arsip; konflik dua tab; pratinjau.

### Task 9: Riwayat versi
- Daftar versi (waktu WIB, catatan), pratinjau versi, Restore dengan konfirmasi.

### Task 10: Dashboard
- Kartu Published today, In review, Scheduled (berikutnya), Drafts; pemeriksaan fondasi tetap; daftar "Coming next" diperbarui.

### Task 11: Verifikasi dan kiriman
- Type check, lint, unit, database, E2E, build; cek visual terang/gelap, desktop/HP; CHANGELOG, versi 0.2.0, tag, zip, dokumen proyek.


## Hasil eksekusi (13 November 2026)

- Semua task selesai. Type check dan lint bersih; Vitest unit 59, database 32; Playwright 35 lulus (15 dilewati sengaja: alur editor hanya desktop, cek tata letak HP hanya mobile); build produksi berhasil.
- Temuan saat eksekusi yang menjadi aturan di `CLAUDE.md`:
  - Next.js menyimpan halaman yang baru dikunjungi di DOM (tersembunyi), jadi `id` tetap menimbulkan label ganda: pakai `useId()` atau `aria-label`, dan tes memakai `getByRole`.
  - Atribut node ProseMirror berupa objek tanpa prototype dan hilang saat dikirim lewat Server Action: editor mengirim `JSON.parse(JSON.stringify(editor.getJSON()))`.
  - Dokumen kosong (`content: []`) tidak valid untuk ProseMirror: editor mulai dengan satu paragraf.
  - Store `useEditorState` Tiptap masih `null` sebelum transaksi pertama: selector memakai instance editor langsung.
  - Dialog `<dialog>` tidak ditutup di cleanup effect (React dev menjalankan effect dua kali).
  - Peringatan validasi *instant navigation* di mode dev hilang setelah setiap halaman Newsroom mengekspor `instant = false`; `loading.tsx` memberi tampilan langsung saat berpindah halaman.
- Repo GitHub tidak bisa dibaca dari sesi ini, jadi panduan push (`docs/ops/update.md`) memuat jalan keluar bila push ditolak.

## Lampiran: kode akhir

File yang dibuat atau diubah sejak v0.1.1 (tanpa `package-lock.json`, dokumen pemilik, dan dokumen ini).


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
      - run: npm run build

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


### `CLAUDE.md`

```markdown
# PressCompass: rules for agents

English-language news site about Indonesia with its own CMS (the Newsroom). Next.js on Vercel Hobby,
Supabase Free (Postgres, Auth), Cloudinary Free for images. No Docker anywhere. Node 26, npm only.

Read first: `docs/specs/2026-11-13-presscompass-design.md` (spec), the current plan in `docs/plans/`,
and `AGENTS.md` (this Next.js version differs from training data: read `node_modules/next/dist/docs/`).

## Language

- Everything a reader or the Newsroom user sees is **English** (British spelling, sentence case, no exclamation marks).
- Owner documents (`README.md`, `CHANGELOG.md`, `docs/ops/`, plans) are **Indonesian**.
- Code, comments, commit messages and test names are English.

## Architecture rules

- Supabase is reached only with the project's own keys: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  (`sb_publishable_`), `SUPABASE_SECRET_KEY` (`sb_secret_`, server only). Legacy `anon`/`service_role` JWT keys are rejected.
- Three clients in `src/lib/supabase/clients.ts`: `createPublicClient` (site reads, anon + RLS), `createSessionClient`
  (Newsroom, authenticated + `is_staff()`), `createAdminClient` (secret key: cron, indexing, reader forms). Never import
  these from client components.
- One Supabase project serves production, Vercel Preview and the owner's computer (v0.1.1). Anything that talks to
  outside services (Google, IndexNow) must use a fake adapter outside Vercel Production. `src/instrumentation.ts`
  refuses to start when `app_meta.project` is not `presscompass` (wrong keys or migrations missing).
- Every table has Row Level Security. A migration that adds a table also adds its policies and a test in `tests/db/`.
- Migrations live in `supabase/migrations/`, are additive, and are applied with `npm run db:push` (Supabase CLI, no Docker).
- Every protected Newsroom layout, page and Server Action calls `requireStaff()`. `src/proxy.ts` is only an optimistic check.
- Cache Components is on. Newsroom segments export `instant = false`; anything that reads the session goes through
  `createSessionClient()`, which calls `connection()` first.
- Next keeps recently visited pages in the DOM (hidden) for instant back navigation, so never hard-code element
  ids in Newsroom components: use `useId()` (client) or `aria-label` (server), or labels point at a hidden page's field.
- Design tokens come from `src/styles/tokens.json` (the design system). Run `npm run tokens` after editing it.
  Components use the CSS variables and the `.type-*` classes, never hard-coded colours.

## Article body

- The stored body is the editor's JSON restricted to `src/lib/doc/schema.ts`. Four places must agree when a block is
  added or changed: the schema, `src/lib/doc/sanitize.ts` (runs on every save), the Tiptap extensions in
  `src/components/newsroom/editor/extensions.ts`, and `src/modules/content/ArticleBody.tsx` (renders it, no raw HTML).
- ProseMirror keeps attributes in null-prototype objects, which Server Action arguments drop: the editor sends
  `JSON.parse(JSON.stringify(editor.getJSON()))`.
- Saving goes through the SQL function `save_article` (version check, slug, relations, revision) via `prepareSave()`.
  Status rules live in `src/modules/editor/status.ts`, publish rules in `rules.ts`.

## Tests (all without Docker)

- `npm test`: unit (Vitest).
- `npm run test:db`: migrations + RLS on plain PostgreSQL with a Supabase stub (`tests/db/supabase-stub.sql`).
  Locally: `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres`.
- `npm run test:e2e`: Playwright against a production build and the fake Supabase in `tests/fake-supabase/`
  (fake Auth + a Data API that runs real SQL on a fresh local PostgreSQL database `presscompass_e2e`).
  Locally you can use an installed Chrome: `PW_CHROME_PATH=/usr/bin/google-chrome`.
- Locators for alerts are scoped to `main`: Next.js renders its own route announcer with `role="alert"`.
- E2E locators use roles (`getByRole`), not `getByLabel`: hidden, kept-alive pages still match labels.
- `npm run fake:supabase` plus `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3101 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_dev npm run dev`
  runs the site against the fake Supabase for local checks (user `owner@example.com`, password in `tests/fake-supabase/auth.mjs`).

## Delivering updates to the owner

- Each finished plan ships as `presscompass-vX.Y.Z.zip`: a clean clone of `main` with history and the version tag,
  no `.env`, no `node_modules`. `package.json` version, tag and `CHANGELOG.md` match.
- Terminal commands for the owner use npm and contain no `#` comments (zsh passes them on as arguments).
- The owner pushes from their Mac. Install commands end with `git commit --amend --no-edit --reset-author` before
  `git push`, because Vercel Hobby only deploys commits authored by the account owner.
```


### `docs/ops/setup.md`

````markdown
# Pemasangan PressCompass

Panduan sekali jalan untuk pemilik: Supabase, komputer, GitHub, dan Vercel. Semua gratis dan tanpa Docker.
Rahasia (password database, secret key) tidak pernah dikirim lewat percakapan; isi langsung di tempatnya.

PressCompass memakai **satu** proyek Supabase (`presscompass`) untuk situs produksi, deploy Preview Vercel, dan komputer Anda (keputusan pemilik 13 November 2026). Artinya `npm run dev` di komputer membaca dan menulis data yang sama dengan situs live. Draf tetap tidak terlihat pembaca, karena hanya konten terbit yang bisa dibaca publik.

## A. Supabase (satu proyek gratis)

1. Buka https://supabase.com/dashboard, pilih **New project**.
   - Nama `presscompass`, region **Southeast Asia (Singapore)**.
   - Password database: buat yang panjang dan **hanya huruf dan angka** (tanda seperti `#`, `/`, `?` merusak perintah). Simpan di pengelola password.
2. **Authentication, Sign In / Providers:** matikan izin pendaftaran pengguna baru (Allow new users to sign up). Newsroom hanya untuk Anda.
3. **Authentication, Users, Add user, Create new user:** email Anda, password minimal 15 karakter, centang **Auto Confirm User**.
4. **Project Settings, API Keys:** catat **Project URL**, **publishable key** (`sb_publishable_...`), dan **secret key** (`sb_secret_...`). Jangan pakai kunci lama `anon` atau `service_role`.
5. Catat **kode proyek** (20 huruf di URL dashboard, `supabase.com/dashboard/project/KODE`).

## B. Komputer (Mac)

1. Pasang zip (perintah ada di pesan pengiriman).
2. Buat `.env` dari contoh, lalu isi dengan tiga nilai dari langkah A4:

   ```bash
   cp .env.example .env
   open -e .env
   ```

3. Terapkan skema. `db:login` membuka browser untuk masuk Supabase (sekali saja); `db:link` meminta password database (sekali saja); `db:push` menanyakan konfirmasi:

   ```bash
   npm run db:login
   npm run db:link -- --project-ref KODE_PROYEK
   npm run db:push
   ```

4. Beri akses Newsroom ke akun Anda, lalu jalankan situs di komputer:

   ```bash
   npm run staff:grant -- email@anda.com
   npm run dev
   ```

5. Buka http://localhost:3000/newsroom dan masuk. Kartu **Foundation** di Dashboard harus menunjukkan **Database Connected** dan **Deployment Preview or local**.

Setiap pembaruan yang membawa migrasi cukup menjalankan `npm run db:push` sekali. Langkah memasang versi baru: `docs/ops/update.md`.

## C. GitHub

1. Buat repo **privat** baru bernama `presscompass` di GitHub, tanpa README.
2. Kirim kode (perintah push ada di pesan pengiriman). CI berjalan otomatis; tunggu centang hijau.

## D. Vercel (Hobby)

1. **Add New, Project**, impor repo `presscompass`. Framework terdeteksi Next.js.
2. **Environment Variables** sebelum deploy pertama. Biarkan semua lingkungan (Production, Preview, Development) tercentang, karena semuanya memakai proyek yang sama:

   | Nama | Nilai |
   |---|---|
   | `NEXT_PUBLIC_SITE_URL` | `https://presscompass.site` |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key |
   | `SUPABASE_SECRET_KEY` | secret key |

3. Deploy. Region fungsi sudah dikunci ke Singapura (`sin1`) lewat `vercel.json`.
4. **Settings, Domains:** tambahkan `presscompass.site` dan ikuti petunjuk DNS Vercel di tempat domain dibeli.
5. Periksa:
   - https://presscompass.site menampilkan halaman "Launching soon";
   - https://presscompass.site/newsroom meminta masuk, lalu Dashboard menunjukkan **Database Connected** dan **Deployment Production**.

## Bila ada masalah

| Gejala | Penyebab dan jalan keluar |
|---|---|
| Halaman masuk: "The Newsroom is not configured yet" | env Supabase belum diisi atau salah ketik; periksa `.env` atau env Vercel, lalu deploy ulang |
| Semua halaman Vercel galat 500, log: "no PressCompass marker" atau "belong to ..., not PressCompass" | kunci Supabase milik proyek lain (misalnya point.lat), atau `npm run db:push` belum dijalankan |
| Masuk ditolak: "This account does not have Newsroom access" | jalankan `npm run staff:grant -- email@anda.com` (langkah B4) |
| `db:push`: IPv6 is not supported | jalankan `npm run db:link` lagi (link memakai pooler IPv4), lalu ulangi `db:push` |
| Deploy Vercel diblokir: commit author tidak punya akses | perintah pasang selalu memuat `git commit --amend --no-edit --reset-author` sebelum push; jalankan lalu push lagi |
````


### `docs/ops/update.md`

````markdown
# Memasang versi baru PressCompass

Setiap versi dikirim sebagai `presscompass-vX.Y.Z.zip`. Perintah di bawah berlaku untuk semua versi; langkah tambahan khusus satu versi ditulis di pesan pengirimannya dan di `CHANGELOG.md`.

## 1. Ganti folder dengan versi baru

Folder lama disimpan sebagai `presscompass-lama` (beserta `.env`-nya), lalu `.env` disalin ke folder baru.

```bash
cd "$HOME/Documents/Virgiawan/website done"
rm -rf presscompass-lama
mv presscompass presscompass-lama
unzip -q "$(ls -t ~/Downloads/presscompass*.zip | head -1)"
cp presscompass-lama/.env presscompass/.env
cd presscompass
nvm use
npm ci
```

## 2. Terapkan migrasi database (bila versi itu membawanya)

`db:push` hanya menerapkan migrasi yang belum ada di proyek Supabase dan menanyakan konfirmasi dulu. Bila tidak ada yang baru, ia menulis `Remote database is up to date`.

```bash
npm run db:link -- --project-ref KODE_PROYEK
npm run db:push
```

`db:link` cukup sekali per folder baru (kode proyek ada di URL dashboard Supabase, 20 huruf). Jalankan `db:push` **sebelum** push ke GitHub, supaya situs live tidak berjalan dengan kode baru di atas skema lama.

## 3. Kirim ke GitHub (Vercel deploy otomatis)

Pesan pengiriman memuat perintah siap tempel dengan nomor versinya. Bentuk umumnya (ganti `vX.Y.Z`):

```bash
git commit --amend --no-edit --reset-author
git tag -f -a vX.Y.Z -m "PressCompass vX.Y.Z"
git push origin main
git push origin vX.Y.Z
```

- `--reset-author` menjadikan commit terakhir milik Anda, karena Vercel Hobby hanya men-deploy commit pemilik akun. Tag dibuat ulang supaya menunjuk commit hasil amend.
- Bila `git push origin main` ditolak (`rejected`, `fetch first` atau `non-fast-forward`), GitHub masih memegang commit yang Anda ubah di versi sebelumnya. Kiriman zip selalu berisi riwayat lengkap, jadi aman menimpanya: `git push --force origin main`.
- Cek versi terpasang: `git describe --tags`.

## Bila ada masalah

| Gejala | Jalan keluar |
|---|---|
| `db:push`: `Cannot find project ref. Have you run supabase link?` | jalankan `npm run db:link -- --project-ref KODE_PROYEK` dulu |
| Keychain Mac menanyakan password "Supabase CLI" | isi password login Mac, pilih **Always Allow** |
| Halaman Newsroom menulis "This page could not load" setelah update | migrasi belum diterapkan: jalankan `npm run db:push`, lalu muat ulang |
| Deploy Vercel diblokir karena penulis commit | jalankan langkah 3 lagi (amend dengan `--reset-author`, lalu push) |
````


### `next.config.ts`

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Cached, tag-revalidated public pages (Plan 4) build on Cache Components.
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Pin the root to this folder: a stray package-lock.json higher up (for example in the home
  // folder) otherwise makes Next.js print a root warning on every start.
  turbopack: { root: __dirname },
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
```


### `package.json`

```json
{
  "name": "presscompass",
  "version": "0.2.0",
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


### `src/app/newsroom/(app)/articles/[id]/ArticleEditor.tsx`

```tsx
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import { Button, ButtonLink } from '@/components/ds/Button';
import { ConfirmButton } from '@/components/newsroom/ConfirmButton';
import { BodyEditor, type BodyEditorHandle } from '@/components/newsroom/editor/BodyEditor';
import { CheckboxField, SelectField, TextField } from '@/components/newsroom/Field';
import forms from '@/components/newsroom/forms.module.css';
import { StatusBadge } from '@/components/newsroom/StatusBadge';
import { Notice, ui } from '@/components/newsroom/ui';
import { slugify } from '@/lib/slug';
import { readingMinutes, wordCount } from '@/lib/doc/text';
import { formatWib, toWibInput } from '@/lib/time';
import { deleteArticle, findArticles, saveArticle } from '@/modules/editor/actions';
import { ARTICLE_TYPES, type FieldErrors, MAX, type Source, TYPE_LABELS } from '@/modules/editor/input';
import type { EditableArticle } from '@/modules/editor/queries';
import { MIN_WORDS, UNTITLED_SLUG } from '@/modules/editor/rules';
import { type ArticleStatus, canAutosave, CONFIRMATIONS, type Intent, intentLabel, statusActions } from '@/modules/editor/status';
import styles from './editor-page.module.css';

type Option = { id: string; name: string };
type Related = { id: string; title: string };
type Found = Awaited<ReturnType<typeof findArticles>>;

const AUTOSAVE_MS = 10_000;

const DONE: Partial<Record<Intent, string>> = {
  save: 'Draft saved.',
  review: 'Sent for review.',
  draft: 'Moved back to draft.',
  publish: 'Published.',
  unschedule: 'Schedule cancelled. The article is a draft again.',
  unpublish: 'Unpublished. Readers no longer see it.',
  archive: 'Archived. Restore it to draft to edit it again.',
  restore: 'Restored to draft.',
};

const ANCHORS: Record<string, string> = { authorIds: 'authors', sectionId: 'section', scheduledAt: 'schedule', body: 'body-label', sources: 'sources-title' };

const FIELD_LABELS: Record<string, string> = {
  title: 'Headline',
  slug: 'Address',
  sectionId: 'Section',
  authorIds: 'Authors',
  standfirst: 'Standfirst',
  body: 'Article text',
  scheduledAt: 'Publish time',
  sources: 'Sources',
  kicker: 'Label',
  status: 'Status',
};

export function ArticleEditor({
  article,
  sections,
  authors,
  tags,
  notice,
}: {
  article: EditableArticle;
  sections: (Option & { slug: string })[];
  authors: (Option & { role: string })[];
  tags: Option[];
  notice?: { tone: 'success' | 'error'; text: string } | null;
}) {
  const uid = useId();
  const id = (field: string) => `${uid}-${field}`;
  const body = useRef<BodyEditorHandle>(null);

  const [title, setTitle] = useState(article.title);
  const [slug, setSlug] = useState(article.slug);
  const [slugTouched, setSlugTouched] = useState(
    article.published_at !== null || !(UNTITLED_SLUG.test(article.slug) || article.slug === slugify(article.title)),
  );
  const [sectionId, setSectionId] = useState(article.section_id ?? '');
  const [type, setType] = useState(article.type);
  const [kicker, setKicker] = useState(article.kicker_label);
  const [standfirst, setStandfirst] = useState(article.standfirst);
  const [isBreaking, setIsBreaking] = useState(article.is_breaking);
  const [authorIds, setAuthorIds] = useState(article.authorIds);
  const [tagIds, setTagIds] = useState(article.tagIds);
  const [related, setRelated] = useState<Related[]>(article.related.map(({ id: rid, title: t }) => ({ id: rid, title: t })));
  const [sources, setSources] = useState<Source[]>(article.sources);
  const [words, setWords] = useState(article.word_count);

  const [version, setVersion] = useState(article.version);
  const [status, setStatus] = useState<ArticleStatus>(article.status);
  const [publishedAt, setPublishedAt] = useState(article.published_at);
  const [scheduledAt, setScheduledAt] = useState(article.scheduled_at);
  const [savedAt, setSavedAt] = useState(article.updated_at);
  const [scheduleInput, setScheduleInput] = useState(article.scheduled_at ? toWibInput(new Date(article.scheduled_at)) : '');
  const [scheduling, setScheduling] = useState(false);
  const [majorUpdate, setMajorUpdate] = useState(false);

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState<Intent | null>(null);
  const [autosaveFailed, setAutosaveFailed] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState(notice ?? null);
  const [conflict, setConflict] = useState(false);
  const changes = useRef(0);

  const readOnly = status === 'archived';
  const section = sections.find((s) => s.id === sectionId);
  const actions = statusActions(status);

  const touch = useCallback(() => {
    changes.current += 1;
    setDirty(true);
  }, []);

  function change<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      touch();
    };
  }

  const save = useCallback(
    async (intent: Intent) => {
      if (saving || conflict) return;
      const startedAt = changes.current;
      setSaving(intent);
      const sendSchedule = intent === 'schedule' || (intent === 'update' && status === 'scheduled');
      try {
        const result = await saveArticle(
          {
            id: article.id,
            version,
            title,
            slug,
            slugAuto: !slugTouched,
            sectionId: sectionId || null,
            type,
            kicker,
            standfirst,
            body: body.current?.getJSON(),
            isBreaking,
            authorIds,
            tagIds,
            relatedIds: related.map((r) => r.id),
            sources,
            scheduledAt: sendSchedule ? scheduleInput || null : null,
            majorUpdate: intent === 'update' && majorUpdate,
          },
          intent,
        );
        if (result.ok) {
          setVersion(result.version);
          setStatus(result.status);
          setPublishedAt(result.publishedAt);
          setScheduledAt(result.scheduledAt);
          setSavedAt(result.savedAt);
          if (result.slug !== slug) setSlug(result.slug);
          setErrors({});
          setAutosaveFailed(false);
          if (changes.current === startedAt) setDirty(false);
          if (intent !== 'autosave') {
            setScheduling(false);
            setMajorUpdate(false);
            const text =
              intent === 'schedule' && result.scheduledAt
                ? `Scheduled for ${formatWib(result.scheduledAt)} WIB.`
                : intent === 'update'
                  ? result.status === 'published'
                    ? 'Update published.'
                    : 'Changes saved.'
                  : DONE[intent];
            setMessage(text ? { tone: 'success', text } : null);
          }
        } else if (result.conflict) {
          setConflict(true);
        } else {
          setErrors(result.errors ?? {});
          if (intent === 'autosave') setAutosaveFailed(true);
          else if (result.message) setMessage({ tone: 'error', text: result.message });
          else setMessage(null);
        }
      } catch {
        if (intent === 'autosave') setAutosaveFailed(true);
        else setMessage({ tone: 'error', text: 'The server could not be reached. Your changes are still here. Try again.' });
      } finally {
        setSaving(null);
      }
    },
    [saving, conflict, status, article.id, version, title, slug, slugTouched, sectionId, type, kicker, standfirst, isBreaking, authorIds, tagIds, related, sources, scheduleInput, majorUpdate],
  );

  // Autosave every 10 seconds while there are changes (drafts and articles in review only).
  const autosaveTick = useEffectEvent(() => {
    if (dirty && !saving && !conflict && canAutosave(status)) void save('autosave');
  });
  useEffect(() => {
    const timer = setInterval(() => autosaveTick(), AUTOSAVE_MS);
    return () => clearInterval(timer);
  }, []);

  // Warn before leaving with unsaved changes, and save with Ctrl+S or Cmd+S.
  const onBeforeUnload = useEffectEvent((event: BeforeUnloadEvent) => {
    if (dirty) event.preventDefault();
  });
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      if (status === 'draft' || status === 'review') void save('save');
      else if (status !== 'archived') void save('update');
    }
  });
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => onBeforeUnload(event);
    const keydown = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('keydown', keydown);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('keydown', keydown);
    };
  }, []);

  function run(intent: Intent) {
    if (intent === 'schedule' && !scheduling) {
      setScheduling(true);
      if (!scheduleInput) setScheduleInput(nextHourInput());
      return;
    }
    void save(intent);
  }

  const problems = Object.entries(errors).filter(([, text]) => text);
  const errorFor = (field: string) => errors[field];
  const minutes = readingMinutes(words);
  const saveState = conflict
    ? 'Not saved'
    : saving
      ? 'Saving…'
      : autosaveFailed
        ? 'Not saved: fix the fields marked in red'
        : dirty
          ? canAutosave(status)
            ? 'Unsaved changes'
            : 'Unsaved changes: press Update to publish them'
          : `Saved ${formatWib(savedAt, 'short')}`;

  const actionButton = (intent: Intent, variant: 'primary' | 'secondary' | 'quiet') => {
    const label = intent === 'schedule' && scheduling ? 'Confirm schedule' : intentLabel(intent, status);
    const confirm = CONFIRMATIONS[intent];
    const busy = saving === intent;
    if (confirm) {
      return (
        <ConfirmButton
          key={intent}
          variant={variant}
          fullWidth
          disabled={Boolean(saving) || conflict}
          title={confirm.title}
          body={confirm.body}
          confirmLabel={confirm.confirm}
          danger={intent === 'archive' || intent === 'unpublish'}
          onConfirm={() => run(intent)}
        >
          {busy ? 'Working…' : label}
        </ConfirmButton>
      );
    }
    return (
      <Button key={intent} variant={variant} fullWidth disabled={Boolean(saving) || conflict} onClick={() => run(intent)}>
        {busy ? (intent === 'save' ? 'Saving…' : 'Working…') : label}
      </Button>
    );
  };

  const primary = scheduling && actions.primary !== 'schedule' ? 'schedule' : actions.primary;
  const others = scheduling ? [] : actions.others;
  const availableAuthors = authors.filter((a) => !authorIds.includes(a.id));
  const availableTags = tags.filter((t) => !tagIds.includes(t.id));

  return (
    <div className={styles.page}>
      <h1 className={ui.srOnly}>Edit article</h1>
      <div className={styles.top}>
        <Link href="/newsroom/articles" className={styles.back}>
          ← Articles
        </Link>
        <StatusBadge status={status} />
        <p className={styles.saveState} role="status" aria-live="polite">
          {saveState}
        </p>
        <div className={styles.topLinks}>
          <ButtonLink href={`/newsroom/articles/${article.id}/history`} size="sm" variant="quiet" icon="history">
            History
          </ButtonLink>
          <ButtonLink href={`/newsroom/preview/${article.id}`} size="sm" icon="eye" target="_blank">
            Preview
          </ButtonLink>
        </div>
      </div>

      {conflict && (
        <Notice tone="error">
          <span>This article changed in another window. Reload to see the latest version. Changes made here since your last save will be lost.</span>
          <span>
            <Button size="sm" variant="primary" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </span>
        </Notice>
      )}
      {message && !conflict && <Notice tone={message.tone}>{message.text}</Notice>}
      {readOnly && <Notice tone="info">Archived articles are read-only. Restore it to draft to edit it.</Notice>}

      <div className={styles.grid}>
        <div className={styles.main}>
          <div className={styles.headlineField}>
            <label htmlFor={id('title')} className={styles.fieldLabel}>
              Headline
            </label>
            <textarea
              id={id('title')}
              className={styles.headline}
              rows={1}
              value={title}
              placeholder="Write the headline"
              maxLength={MAX.title + 20}
              disabled={readOnly}
              aria-invalid={errorFor('title') ? true : undefined}
              aria-describedby={errorFor('title') ? id('title-error') : undefined}
              onChange={(event) => {
                const value = event.target.value.replace(/\n/g, ' ');
                setTitle(value);
                if (!slugTouched) setSlug(slugify(value) || slug);
                touch();
              }}
            />
            {errorFor('title') && (
              <p id={id('title-error')} className={forms.error}>
                {errorFor('title')}
              </p>
            )}
          </div>
          <div className={styles.headlineField}>
            <label htmlFor={id('standfirst')} className={styles.fieldLabel}>
              Standfirst
            </label>
            <textarea
              id={id('standfirst')}
              className={styles.standfirst}
              rows={2}
              value={standfirst}
              placeholder="One or two sentences that tell the reader why this matters"
              maxLength={MAX.standfirst + 20}
              disabled={readOnly}
              aria-invalid={errorFor('standfirst') ? true : undefined}
              aria-describedby={errorFor('standfirst') ? id('standfirst-error') : undefined}
              onChange={(event) => change(setStandfirst)(event.target.value)}
            />
            {errorFor('standfirst') && (
              <p id={id('standfirst-error')} className={forms.error}>
                {errorFor('standfirst')}
              </p>
            )}
          </div>
          <div className={styles.headlineField}>
            <span className={styles.fieldLabel} id={id('body-label')}>
              Article text
            </span>
            <BodyEditor
              ref={body}
              initial={article.body}
              articleId={article.id}
              editable={!readOnly}
              invalid={Boolean(errorFor('body'))}
              describedBy={errorFor('body') ? id('body-error') : undefined}
              onChange={(text) => {
                setWords(wordCount(text));
                touch();
              }}
            />
            {errorFor('body') && (
              <p id={id('body-error')} className={forms.error}>
                {errorFor('body')}
              </p>
            )}
            <p className={styles.wordCount}>
              {words} {words === 1 ? 'word' : 'words'}
              {minutes > 0 && ` · ${minutes} min read`}
              {words < MIN_WORDS && ` · ${MIN_WORDS} needed to publish`}
            </p>
          </div>
        </div>

        <aside className={styles.panel} aria-label="Article settings">
          <section className={styles.card} aria-label="Status">
            <div className={styles.statusHead}>
              <StatusBadge status={status} />
              <span className={styles.when}>
                {status === 'scheduled' && scheduledAt
                  ? `Publishes ${formatWib(scheduledAt)} WIB`
                  : publishedAt
                    ? `First published ${formatWib(publishedAt)} WIB`
                    : 'Not published yet'}
              </span>
            </div>
            {problems.length > 0 && (
              <div className={styles.problems} role="alert">
                <p>{problems.length === 1 ? 'One thing needs attention:' : `${problems.length} things need attention:`}</p>
                <ul>
                  {problems.map(([field, text]) => (
                    <li key={field}>
                      <a href={`#${id(ANCHORS[field] ?? field)}`}>
                        {FIELD_LABELS[field] ?? field}
                      </a>
                      : {text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(scheduling || status === 'scheduled') && (
              <TextField
                id={id('schedule')}
                label="Publish time (WIB)"
                type="datetime-local"
                value={scheduleInput}
                onChange={(event) => change(setScheduleInput)(event.target.value)}
                error={errorFor('scheduledAt')}
              />
            )}
            {status === 'published' && (
              <CheckboxField
                id={id('major')}
                label="Major update"
                hint="Marks the article as updated and tells search engines. Use it for new facts, not for typo fixes."
                checked={majorUpdate}
                onChange={(event) => setMajorUpdate(event.target.checked)}
              />
            )}
            <div className={styles.actions}>
              {actionButton(primary, 'primary')}
              {scheduling && (
                <Button variant="quiet" fullWidth onClick={() => setScheduling(false)}>
                  Cancel
                </Button>
              )}
              {others.map((intent) => actionButton(intent, 'secondary'))}
            </div>
          </section>

          <section className={styles.card} aria-label="Details">
            <h2 className={styles.cardTitle}>Details</h2>
            <TextField
              id={id('slug')}
              label="Address"
              mono
              value={slug}
              disabled={readOnly}
              error={errorFor('slug')}
              hint={`presscompass.site/${section?.slug ?? 'section'}/${slug}${publishedAt ? ' · Changing it adds a redirect from the old address.' : ''}`}
              onChange={(event) => {
                setSlug(event.target.value);
                setSlugTouched(true);
                touch();
              }}
              onBlur={() => setSlug((current) => slugify(current) || current)}
            />
            <SelectField
              id={id('section')}
              label="Section"
              value={sectionId}
              disabled={readOnly}
              error={errorFor('sectionId')}
              onChange={(event) => change(setSectionId)(event.target.value)}
            >
              <option value="">Choose a section</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectField>
            {sections.length === 0 && (
              <p className={forms.hint}>
                No sections yet. <Link href="/newsroom/sections/new">Create one</Link> first.
              </p>
            )}
            <SelectField id={id('type')} label="Type" value={type} disabled={readOnly} onChange={(event) => change(setType)(event.target.value as typeof type)}>
              {ARTICLE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </SelectField>
            <TextField
              id={id('kicker')}
              label="Label"
              optional
              value={kicker}
              disabled={readOnly}
              maxLength={MAX.kicker}
              error={errorFor('kicker')}
              hint="Shown above the headline instead of the section name, for example Exclusive."
              onChange={(event) => change(setKicker)(event.target.value)}
            />
            <CheckboxField
              id={id('breaking')}
              label="Breaking news"
              hint="Highlights the article in the Latest strip."
              checked={isBreaking}
              disabled={readOnly}
              onChange={(event) => change(setIsBreaking)(event.target.checked)}
            />
          </section>

          <section className={styles.card} aria-labelledby={id('authors-title')}>
            <h2 className={styles.cardTitle} id={id('authors-title')}>
              Byline
            </h2>
            {errorFor('authorIds') && <p className={forms.error}>{errorFor('authorIds')}</p>}
            {authorIds.length > 0 && (
              <ol className={styles.chosenList}>
                {authorIds.map((authorId, index) => {
                  const author = authors.find((a) => a.id === authorId);
                  return (
                    <li key={authorId}>
                      <span>
                        {author?.name ?? 'Removed author'}
                        {author?.role && <small>{author.role}</small>}
                      </span>
                      {!readOnly && (
                        <span className={styles.rowButtons}>
                          <Button
                            size="sm"
                            variant="quiet"
                            icon="arrow-up"
                            aria-label={`Move ${author?.name} up`}
                            disabled={index === 0}
                            onClick={() => change(setAuthorIds)(move(authorIds, index, -1))}
                          />
                          <Button size="sm" variant="quiet" icon="x" aria-label={`Remove ${author?.name}`} onClick={() => change(setAuthorIds)(authorIds.filter((a) => a !== authorId))} />
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
            {!readOnly && (
              <SelectField
                id={id('authors')}
                label="Add an author"
                value=""
                onChange={(event) => event.target.value && change(setAuthorIds)([...authorIds, event.target.value])}
                hint={authors.length === 0 ? undefined : authorIds.length > 1 ? 'Bylines appear in this order.' : undefined}
              >
                <option value="">{availableAuthors.length ? 'Choose…' : 'Everyone is on the byline'}</option>
                {availableAuthors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </SelectField>
            )}
            {authors.length === 0 && (
              <p className={forms.hint}>
                No authors yet. <Link href="/newsroom/authors/new">Add one</Link> first.
              </p>
            )}
          </section>

          <section className={styles.card} aria-labelledby={id('tags-title')}>
            <h2 className={styles.cardTitle} id={id('tags-title')}>
              Tags
            </h2>
            {tagIds.length > 0 && (
              <ul className={styles.chips}>
                {tagIds.map((tagId) => {
                  const tag = tags.find((t) => t.id === tagId);
                  return (
                    <li key={tagId} className={styles.chip}>
                      {tag?.name ?? 'Removed tag'}
                      {!readOnly && (
                        <button type="button" aria-label={`Remove tag ${tag?.name}`} onClick={() => change(setTagIds)(tagIds.filter((t) => t !== tagId))}>
                          ×
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {!readOnly && (
              <SelectField id={id('tags')} label="Add a tag" value="" onChange={(event) => event.target.value && change(setTagIds)([...tagIds, event.target.value])}>
                <option value="">{availableTags.length ? 'Choose…' : 'No more tags'}</option>
                {availableTags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </SelectField>
            )}
            <p className={forms.hint}>
              <Link href="/newsroom/tags/new" target="_blank">
                New tag
              </Link>{' '}
              opens in a new tab. Reload this page after creating it.
            </p>
          </section>

          <RelatedPicker articleId={article.id} related={related} readOnly={readOnly} onChange={change(setRelated)} uid={uid} />

          <section className={styles.card} aria-labelledby={id('sources-title')}>
            <h2 className={styles.cardTitle} id={id('sources-title')}>
              Sources
            </h2>
            {errorFor('sources') && <p className={forms.error}>{errorFor('sources')}</p>}
            {sources.map((source, index) => (
              <fieldset key={index} className={styles.source}>
                <legend className={styles.sourceLegend}>Source {index + 1}</legend>
                <TextField id={id(`source-title-${index}`)} label="Title" value={source.title} disabled={readOnly} onChange={(e) => change(setSources)(edit(sources, index, 'title', e.target.value))} />
                <TextField id={id(`source-url-${index}`)} label="Link" type="url" mono value={source.url} disabled={readOnly} placeholder="https://" onChange={(e) => change(setSources)(edit(sources, index, 'url', e.target.value))} />
                <div className={forms.row}>
                  <TextField id={id(`source-publisher-${index}`)} label="Publisher" optional value={source.publisher} disabled={readOnly} onChange={(e) => change(setSources)(edit(sources, index, 'publisher', e.target.value))} />
                  <TextField id={id(`source-accessed-${index}`)} label="Accessed" optional type="date" value={source.accessed} disabled={readOnly} onChange={(e) => change(setSources)(edit(sources, index, 'accessed', e.target.value))} />
                </div>
                {!readOnly && (
                  <Button size="sm" variant="quiet" icon="trash" onClick={() => change(setSources)(sources.filter((_, i) => i !== index))}>
                    Remove source
                  </Button>
                )}
              </fieldset>
            ))}
            {!readOnly && sources.length < MAX.sources && (
              <Button size="sm" icon="plus" onClick={() => change(setSources)([...sources, { title: '', url: '', publisher: '', accessed: toWibInput(new Date()).slice(0, 10) }])}>
                Add source
              </Button>
            )}
          </section>

          {status !== 'published' && (
            <section className={styles.card} aria-label="Delete">
              <form action={deleteArticle}>
                <input type="hidden" name="id" value={article.id} />
                <ConfirmButton
                  variant="quiet"
                  size="sm"
                  icon="trash"
                  title="Delete this article?"
                  body="The article and its history are removed for good. This cannot be undone."
                  confirmLabel="Delete article"
                  danger
                >
                  Delete article
                </ConfirmButton>
              </form>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function RelatedPicker({
  articleId,
  related,
  readOnly,
  onChange,
  uid,
}: {
  articleId: string;
  related: Related[];
  readOnly: boolean;
  onChange: (value: Related[]) => void;
  uid: string;
}) {
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Found | null>(null);
  const [searching, setSearching] = useState(false);

  async function search() {
    setSearching(true);
    try {
      setFound((await findArticles(query, articleId)).filter((a) => !related.some((r) => r.id === a.id)));
    } finally {
      setSearching(false);
    }
  }

  return (
    <section className={styles.card} aria-labelledby={`${uid}-related-title`}>
      <h2 className={styles.cardTitle} id={`${uid}-related-title`}>
        Related articles
      </h2>
      <p className={forms.hint}>Your picks appear first under the article. The rest fill in from the same section and tags.</p>
      {related.length > 0 && (
        <ol className={styles.chosenList}>
          {related.map((item) => (
            <li key={item.id}>
              <span>{item.title || 'Untitled'}</span>
              {!readOnly && <Button size="sm" variant="quiet" icon="x" aria-label={`Remove ${item.title || 'Untitled'}`} onClick={() => onChange(related.filter((r) => r.id !== item.id))} />}
            </li>
          ))}
        </ol>
      )}
      {!readOnly && related.length < MAX.related && (
        <>
          <div className={styles.searchRow}>
            <TextField
              id={`${uid}-related-query`}
              label="Find an article"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void search();
                }
              }}
            />
            <Button size="sm" onClick={() => void search()} disabled={searching}>
              {searching ? 'Searching…' : 'Search'}
            </Button>
          </div>
          {found && (
            <ul className={styles.results} aria-label="Search results">
              {found.length === 0 && <li className={forms.hint}>No articles match.</li>}
              {found.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={styles.result}
                    onClick={() => {
                      onChange([...related, { id: item.id, title: item.title }]);
                      setFound((current) => current?.filter((f) => f.id !== item.id) ?? null);
                    }}
                  >
                    <span>{item.title || 'Untitled'}</span>
                    <small>Add · {item.section?.name ?? 'No section'}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function move<T>(list: T[], index: number, by: number): T[] {
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(index + by, 0, item);
  return next;
}

function edit(sources: Source[], index: number, key: keyof Source, value: string): Source[] {
  return sources.map((source, i) => (i === index ? { ...source, [key]: value } : source));
}

/** The next full hour in WIB, as a starting point for the schedule field. */
function nextHourInput(): string {
  return `${toWibInput(new Date(Date.now() + 60 * 60 * 1000)).slice(0, 14)}00`;
}
```


### `src/app/newsroom/(app)/articles/[id]/editor-page.module.css`

```css
/* Article editor page: writing column and settings panel. */

.page {
  display: flex;
  flex-direction: column;
}

.top {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-4);
}

.back {
  font: 500 14px/20px var(--font-sans);
  color: var(--ink-secondary);
  text-decoration: none;
}

.back:hover {
  color: var(--ink);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.saveState {
  font: 400 13px/20px var(--font-mono);
  color: var(--ink-muted);
}

.topLinks {
  margin-left: auto;
  display: flex;
  gap: var(--space-2);
}

.grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: var(--space-6);
  align-items: start;
}

.main {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
}

.headlineField {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.fieldLabel {
  font: 600 12px/16px var(--font-sans);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-muted);
}

.headline,
.standfirst {
  width: 100%;
  padding: 8px 0;
  border: 0;
  border-bottom: 1px solid var(--line);
  background: transparent;
  color: var(--ink);
  resize: none;
  field-sizing: content;
  overflow: hidden;
}

.headline {
  font: 500 clamp(28px, 3.2vw, 40px) / 1.15 var(--font-serif);
  letter-spacing: -0.01em;
  font-variation-settings: 'opsz' 60;
}

.standfirst {
  font: 400 20px/30px var(--font-serif);
  font-variation-settings: 'opsz' 24;
  color: var(--ink-secondary);
}

.headline::placeholder,
.standfirst::placeholder {
  color: var(--ink-muted);
}

.headline:focus-visible,
.standfirst:focus-visible {
  outline: none;
  border-bottom-color: var(--meridian);
  box-shadow: 0 1px 0 var(--meridian);
}

.headline[aria-invalid],
.standfirst[aria-invalid] {
  border-bottom-color: var(--danger);
}

.wordCount {
  font: 400 13px/20px var(--font-mono);
  color: var(--ink-muted);
}

.panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
}

.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--paper-raised);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
}

.cardTitle {
  font: 600 12px/16px var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-muted);
}

.statusHead {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.when {
  font: 400 13px/18px var(--font-mono);
  color: var(--ink-muted);
}

.problems {
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--danger-soft);
  color: var(--danger);
  font: 500 14px/20px var(--font-sans);
}

.problems ul {
  margin: 6px 0 0;
  padding-left: 18px;
  font-weight: 400;
}

.problems a {
  color: inherit;
  font-weight: 600;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.chosenList {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.chosenList li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 6px 4px 6px 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  font: 500 14px/20px var(--font-sans);
}

.chosenList small {
  display: block;
  font: 400 12px/16px var(--font-sans);
  color: var(--ink-muted);
}

.rowButtons {
  display: flex;
  gap: 2px;
  flex: none;
}

.chips {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 4px 3px 10px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
  font: 500 14px/20px var(--font-sans);
  color: var(--ink-secondary);
}

.chip button {
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink-muted);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.chip button:hover {
  background: var(--paper-sunken);
  color: var(--ink);
}

.source {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: var(--space-3);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  min-width: 0;
}

.sourceLegend {
  padding: 0 4px;
  font: 600 13px/18px var(--font-sans);
}

.searchRow {
  display: flex;
  gap: var(--space-2);
  align-items: flex-end;
}

.searchRow > :first-child {
  flex: 1;
}

.results {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.result {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--paper);
  color: var(--ink);
  text-align: left;
  font: 500 14px/20px var(--font-sans);
  cursor: pointer;
}

.result small {
  font: 400 12px/16px var(--font-sans);
  color: var(--ink-muted);
}

.result:hover {
  border-color: var(--ink-secondary);
}

@media (max-width: 1180px) {
  .grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .topLinks {
    margin-left: 0;
  }
}
```


### `src/app/newsroom/(app)/articles/[id]/history/page.tsx`

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ButtonLink } from '@/components/ds/Button';
import { ConfirmButton } from '@/components/newsroom/ConfirmButton';
import { EmptyState, Notice, PageHeader, ui } from '@/components/newsroom/ui';
import { UUID } from '@/lib/doc/schema';
import { formatWib } from '@/lib/time';
import { requireStaff } from '@/modules/auth/staff';
import { restoreRevision } from '@/modules/editor/actions';
import { getArticle, listRevisions } from '@/modules/editor/queries';

export const metadata: Metadata = { title: 'History' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

const NOTICES: Record<string, string> = {
  missing: 'That version no longer exists. Only the 50 latest versions are kept.',
  'restore-failed': 'The version could not be restored. Try again.',
};

export default async function HistoryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  await requireStaff();
  const [{ id }, { notice }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const [article, revisions] = await Promise.all([getArticle(id), listRevisions(id)]);
  if (!article) notFound();

  return (
    <>
      <PageHeader
        title="History"
        description={`${article.title || 'Untitled'} · The 50 latest versions are kept. Manual saves and status changes each add one; autosave adds at most one every 10 minutes.`}
        back={{ href: `/newsroom/articles/${id}`, label: 'Back to the editor' }}
      />
      {notice && NOTICES[notice] && <Notice tone="error">{NOTICES[notice]}</Notice>}
      <div className={ui.tableWrap}>
        {revisions.length === 0 ? (
          <EmptyState icon="history" title="No versions yet">
            <p>Versions appear here after the first save.</p>
          </EmptyState>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th scope="col">Saved (WIB)</th>
                <th scope="col">What happened</th>
                <th scope="col">
                  <span className={ui.srOnly}>Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {revisions.map((revision, index) => (
                <tr key={revision.id}>
                  <td className={ui.mono}>{formatWib(revision.created_at)}</td>
                  <td className={ui.cellTitle}>
                    {revision.note || 'Saved'}
                    {index === 0 && <span className={ui.slug}>Latest version</span>}
                  </td>
                  <td className={ui.cellActions}>
                    <div className={ui.rowActions}>
                      <ButtonLink href={`/newsroom/preview/${id}?revision=${revision.id}`} size="sm" variant="quiet" icon="eye" target="_blank">
                        View
                      </ButtonLink>
                      {index > 0 && (
                        <form action={restoreRevision}>
                          <input type="hidden" name="articleId" value={id} />
                          <input type="hidden" name="revisionId" value={revision.id} />
                          <ConfirmButton
                            size="sm"
                            title="Restore this version?"
                            body={`The headline, text, byline and details go back to how they were on ${formatWib(revision.created_at)} WIB. The address and status stay as they are, and the current version is kept here.`}
                            confirmLabel="Restore"
                          >
                            Restore
                          </ConfirmButton>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
```


### `src/app/newsroom/(app)/articles/[id]/page.tsx`

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { UUID } from '@/lib/doc/schema';
import { requireStaff } from '@/modules/auth/staff';
import { getArticle, publishDue } from '@/modules/editor/queries';
import { listAuthors, listSections, listTags } from '@/modules/taxonomy/queries';
import { ArticleEditor } from './ArticleEditor';

export const metadata: Metadata = { title: 'Edit article' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

const NOTICES: Record<string, { tone: 'success' | 'error'; text: string }> = {
  restored: { tone: 'success', text: 'Earlier version restored. The version before it is kept in History.' },
  'delete-failed': { tone: 'error', text: 'The article could not be deleted. Published articles must be unpublished or archived first.' },
};

export default async function EditArticlePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  await requireStaff();
  const [{ id }, { notice }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  await publishDue();
  const [article, sections, authors, tags] = await Promise.all([getArticle(id), listSections(), listAuthors(), listTags()]);
  if (!article) notFound();

  return (
    <ArticleEditor
      key={`${article.id}-${article.version}`}
      article={article}
      sections={sections.map(({ id: sid, name, slug }) => ({ id: sid, name, slug }))}
      authors={authors.map(({ id: aid, name, role }) => ({ id: aid, name, role }))}
      tags={tags.map(({ id: tid, name }) => ({ id: tid, name }))}
      notice={notice ? (NOTICES[notice] ?? null) : null}
    />
  );
}
```


### `src/app/newsroom/(app)/articles/articles.module.css`

```css
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  margin-bottom: var(--space-4);
}

.search {
  position: relative;
  flex: 1 1 280px;
  max-width: 380px;
}

.search svg {
  position: absolute;
  left: 11px;
  top: 7px;
  color: var(--ink-muted);
}

.input,
.select {
  height: 32px;
  font: 400 14px/20px var(--font-sans);
  color: var(--ink);
  background: var(--paper-raised);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
}

.input {
  width: 100%;
  padding: 0 10px 0 36px;
}

.input::placeholder {
  color: var(--ink-muted);
}

.select {
  padding: 0 32px 0 10px;
  appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, var(--ink-muted) 50%), linear-gradient(135deg, var(--ink-muted) 50%, transparent 50%);
  background-position: calc(100% - 16px) 14px, calc(100% - 11px) 14px;
  background-size: 5px 5px;
  background-repeat: no-repeat;
  max-width: 200px;
}

.tabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  border-bottom: 1px solid var(--line);
  margin-bottom: var(--space-4);
}

.tabs a {
  padding: 10px 12px;
  margin-bottom: -1px;
  border-bottom: 2px solid transparent;
  font: 500 14px/20px var(--font-sans);
  color: var(--ink-secondary);
  text-decoration: none;
  white-space: nowrap;
}

.tabs a:hover {
  color: var(--ink);
}

.tabs a[aria-current] {
  color: var(--ink);
  border-bottom-color: var(--ink);
}

.n {
  margin-left: 6px;
  font: 500 12px/16px var(--font-mono);
  color: var(--ink-muted);
}

.pager {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-top: var(--space-3);
  font: 400 13px/20px var(--font-mono);
  color: var(--ink-muted);
}

.pagerLinks {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
```


### `src/app/newsroom/(app)/articles/page.tsx`

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button, ButtonLink } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { ArticleTable } from '@/components/newsroom/ArticleTable';
import { noticeFor } from '@/components/newsroom/notices';
import { SubmitButton } from '@/components/newsroom/SubmitButton';
import { EmptyState, Notice, PageHeader, ui } from '@/components/newsroom/ui';
import { UUID } from '@/lib/doc/schema';
import { requireStaff } from '@/modules/auth/staff';
import { createArticle } from '@/modules/editor/actions';
import { listArticles, PAGE_SIZE, publishDue, statusCounts } from '@/modules/editor/queries';
import { type ArticleStatus, STATUSES } from '@/modules/editor/status';
import { listAuthors, listSections } from '@/modules/taxonomy/queries';
import styles from './articles.module.css';

export const metadata: Metadata = { title: 'Articles' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

const TABS: [ArticleStatus | undefined, string][] = [
  [undefined, 'All'],
  ['draft', 'Drafts'],
  ['review', 'In review'],
  ['scheduled', 'Scheduled'],
  ['published', 'Published'],
  ['archived', 'Archived'],
];

type Search = { status?: string; q?: string; section?: string; author?: string; page?: string; notice?: string };

export default async function ArticlesPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireStaff();
  const params = await searchParams;
  const status = STATUSES.find((s) => s === params.status);
  const q = (params.q ?? '').trim().slice(0, 100);
  const section = params.section && UUID.test(params.section) ? params.section : undefined;
  const author = params.author && UUID.test(params.author) ? params.author : undefined;
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);

  await publishDue();
  const [list, counts, sections, authors] = await Promise.all([
    listArticles({ status, q, section, author, page }),
    statusCounts(),
    listSections(),
    listAuthors(),
  ]);
  const total = Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0);
  const pages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  const filtered = Boolean(q || section || author);
  const message = noticeFor('article', params.notice);

  const href = (changes: Partial<Record<'status' | 'page', string | undefined>>) => {
    const next = new URLSearchParams();
    const merged = { status, q: q || undefined, section, author, page: undefined as string | undefined, ...changes };
    for (const [key, value] of Object.entries(merged)) if (value) next.set(key, value);
    const query = next.toString();
    return `/newsroom/articles${query ? `?${query}` : ''}`;
  };

  return (
    <>
      <PageHeader
        title="Articles"
        actions={
          <form action={createArticle}>
            <SubmitButton icon="plus" pendingLabel="Creating…">
              New article
            </SubmitButton>
          </form>
        }
      />
      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <form className={styles.filters} role="search" action="/newsroom/articles">
        {status && <input type="hidden" name="status" value={status} />}
        <div className={styles.search}>
          <Icon name="search" size={18} />
          <input aria-label="Search articles" className={styles.input} type="search" name="q" defaultValue={q} placeholder="Search titles, authors, addresses" />
        </div>
        <select aria-label="Section" name="section" defaultValue={section ?? ''} className={styles.select}>
          <option value="">All sections</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select aria-label="Author" name="author" defaultValue={author ?? ''} className={styles.select}>
          <option value="">All authors</option>
          {authors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm">
          Filter
        </Button>
        {filtered && (
          <ButtonLink href={status ? `/newsroom/articles?status=${status}` : '/newsroom/articles'} variant="quiet" size="sm">
            Clear
          </ButtonLink>
        )}
      </form>

      <nav className={styles.tabs} aria-label="Filter by status">
        {TABS.map(([value, label]) => (
          <Link key={label} href={href({ status: value })} aria-current={status === value ? 'page' : undefined}>
            {label}
            <span className={styles.n}>{value ? (counts[value] ?? 0) : total}</span>
          </Link>
        ))}
      </nav>

      {list.rows.length === 0 ? (
        <div className={ui.tableWrap}>
          <EmptyState icon="file" title={filtered ? 'No articles match' : status ? 'Nothing here yet' : 'No articles yet'}>
            <p>{filtered ? 'Try another search or clear the filters.' : 'Start with New article. It opens as a draft that saves itself.'}</p>
          </EmptyState>
        </div>
      ) : (
        <ArticleTable key={`${status}-${q}-${section}-${author}-${page}`} rows={list.rows} />
      )}

      {list.total > 0 && (
        <div className={styles.pager}>
          <span>
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, list.total)} of {list.total}
          </span>
          <span className={styles.pagerLinks}>
            {page > 1 && (
              <ButtonLink href={href({ page: String(page - 1) })} size="sm" icon="arrow-left">
                Previous
              </ButtonLink>
            )}
            <span>
              Page {page} of {pages}
            </span>
            {page < pages && (
              <ButtonLink href={href({ page: String(page + 1) })} size="sm">
                Next
              </ButtonLink>
            )}
          </span>
        </div>
      )}
    </>
  );
}
```


### `src/app/newsroom/(app)/authors/[id]/page.tsx`

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ConfirmButton } from '@/components/newsroom/ConfirmButton';
import forms from '@/components/newsroom/forms.module.css';
import { noticeFor } from '@/components/newsroom/notices';
import { TaxonomyForm } from '@/components/newsroom/TaxonomyForm';
import { Notice, PageHeader } from '@/components/newsroom/ui';
import { UUID } from '@/lib/doc/schema';
import { requireStaff } from '@/modules/auth/staff';
import { deleteAuthor, saveAuthor } from '@/modules/taxonomy/actions';
import { getAuthor, getUsage } from '@/modules/taxonomy/queries';

export const metadata: Metadata = { title: 'Edit author' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

export default async function EditAuthorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  await requireStaff();
  const [{ id }, { notice }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const [author, usage] = await Promise.all([getAuthor(id), getUsage()]);
  if (!author) notFound();
  const articles = usage.authors[id] ?? 0;
  const message = noticeFor('author', notice);

  return (
    <>
      <PageHeader title={author.name} back={{ href: '/newsroom/authors', label: 'Authors' }} />
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <TaxonomyForm
        kind="author"
        action={saveAuthor}
        initial={{ id: author.id, name: author.name, slug: author.slug, role: author.role, bio: author.bio, links: author.links }}
        cancelHref="/newsroom/authors"
      />
      <section className={forms.danger}>
        <h2 className={forms.dangerTitle}>
          Delete author
        </h2>
        {articles > 0 ? (
          <p className={forms.dangerText}>
            {articles === 1 ? 'One article credits' : `${articles} articles credit`} this author. Remove the byline from{' '}
            {articles === 1 ? 'that article' : 'those articles'} before deleting.
          </p>
        ) : (
          <form action={deleteAuthor}>
            <input type="hidden" name="id" value={author.id} />
            <ConfirmButton icon="trash" title={`Delete ${author.name}?`} body="The profile is removed. This cannot be undone." confirmLabel="Delete author" danger>
              Delete author
            </ConfirmButton>
          </form>
        )}
      </section>
    </>
  );
}
```


### `src/app/newsroom/(app)/authors/new/page.tsx`

```tsx
import type { Metadata } from 'next';
import { TaxonomyForm } from '@/components/newsroom/TaxonomyForm';
import { PageHeader } from '@/components/newsroom/ui';
import { requireStaff } from '@/modules/auth/staff';
import { saveAuthor } from '@/modules/taxonomy/actions';

export const metadata: Metadata = { title: 'New author' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

export default async function NewAuthorPage() {
  await requireStaff();
  return (
    <>
      <PageHeader title="New author" back={{ href: '/newsroom/authors', label: 'Authors' }} />
      <TaxonomyForm kind="author" action={saveAuthor} initial={{ name: '', slug: '', role: '', bio: '', links: [] }} cancelHref="/newsroom/authors" />
    </>
  );
}
```


### `src/app/newsroom/(app)/authors/page.tsx`

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { ButtonLink } from '@/components/ds/Button';
import { noticeFor } from '@/components/newsroom/notices';
import { EmptyState, Notice, PageHeader, ui } from '@/components/newsroom/ui';
import { requireStaff } from '@/modules/auth/staff';
import { getUsage, listAuthors } from '@/modules/taxonomy/queries';

export const metadata: Metadata = { title: 'Authors' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

export default async function AuthorsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  await requireStaff();
  const [{ notice }, authors, usage] = await Promise.all([searchParams, listAuthors(), getUsage()]);
  const message = noticeFor('author', notice);

  return (
    <>
      <PageHeader
        title="Authors"
        description="Bylines on articles. Each author gets a profile page at /author/… with their articles."
        actions={
          <ButtonLink href="/newsroom/authors/new" variant="primary" icon="plus">
            New author
          </ButtonLink>
        }
      />
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <div className={ui.tableWrap}>
        {authors.length === 0 ? (
          <EmptyState icon="users" title="No authors yet">
            <p>Every article needs at least one author before it can be published.</p>
          </EmptyState>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Role</th>
                <th scope="col" className={ui.num}>
                  Articles
                </th>
              </tr>
            </thead>
            <tbody>
              {authors.map((author) => (
                <tr key={author.id}>
                  <td className={ui.cellTitle}>
                    <Link href={`/newsroom/authors/${author.id}`}>{author.name}</Link>
                    <span className={ui.slug}>/author/{author.slug}</span>
                  </td>
                  <td>{author.role || '—'}</td>
                  <td className={ui.num}>{usage.authors[author.id] ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
```


### `src/app/newsroom/(app)/error.tsx`

```tsx
'use client';

import { Button } from '@/components/ds/Button';
import { EmptyState } from '@/components/newsroom/ui';

// Shown when a Newsroom page cannot load, usually because Supabase cannot be reached.
export default function NewsroomError({ retry }: { error: Error; retry: () => void }) {
  return (
    <EmptyState icon="alert" title="This page could not load">
      <p>The Newsroom could not reach the database. Check your connection, then try again.</p>
      <Button variant="primary" onClick={() => retry()}>
        Try again
      </Button>
    </EmptyState>
  );
}
```


### `src/app/newsroom/(app)/layout.tsx`

```tsx
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Logo } from '@/components/ds/Logo';
import { Button } from '@/components/ds/Button';
import { SideNav } from '@/components/newsroom/SideNav';
import { signOut } from '@/modules/auth/actions';
import { requireStaff } from '@/modules/auth/staff';
import styles from './newsroom.module.css';

// Newsroom pages read the session on every request, so they block on the server instead of
// prerendering a static shell (Cache Components).
export const instant = false;

export const metadata: Metadata = { title: { default: 'Newsroom', template: '%s · Newsroom' } };

export default async function NewsroomLayout({ children }: { children: ReactNode }) {
  const staff = await requireStaff();
  return (
    <div className={styles.shell}>
      <aside className={styles.side} aria-label="Newsroom">
        <div className={styles.brand}>
          <Logo height={24} />
          <p className={styles.brandLabel}>NEWSROOM</p>
        </div>
        <SideNav className={styles.nav} groupClassName={styles.navGroup} labelClassName={styles.navLabel} />
        <div className={styles.user}>
          <p className={styles.userEmail}>{staff.email}</p>
          <form action={signOut}>
            <Button type="submit" variant="quiet" size="sm" icon="log-out">
              Sign out
            </Button>
          </form>
        </div>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
```


### `src/app/newsroom/(app)/loading.tsx`

```tsx
import styles from './newsroom.module.css';

// Shown at once while a Newsroom page loads its data, so navigation responds immediately.
export default function NewsroomLoading() {
  return (
    <div className={styles.loading} role="status" aria-live="polite">
      <span className={styles.loadingBar} aria-hidden="true" />
      <span className={styles.loadingBar} aria-hidden="true" />
      <span className={styles.loadingBar} aria-hidden="true" />
      <span className={styles.srOnly}>Loading</span>
    </div>
  );
}
```


### `src/app/newsroom/(app)/newsroom.module.css`

```css
.shell {
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
  min-height: 100vh;
}

.side {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: 20px 14px;
  background: var(--paper-sunken);
  border-right: 1px solid var(--line);
  color: var(--ink);
}

.brand {
  padding: 4px 8px;
}

.brandLabel {
  margin-top: var(--space-2);
  font: 500 12px/16px var(--font-mono);
  letter-spacing: 0.04em;
  color: var(--ink-muted);
}

.nav {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.navGroup {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.navLabel {
  padding: 0 10px 4px;
  font: 600 12px/16px var(--font-sans);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-muted);
}

.nav a {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  font: 500 15px/22px var(--font-sans);
  color: var(--ink-secondary);
  text-decoration: none;
}

.nav a:hover {
  background: var(--paper);
  color: var(--ink);
}

.nav a[aria-current] {
  background: var(--paper-raised);
  color: var(--ink);
  box-shadow: inset 0 0 0 1px var(--line);
}

.user {
  margin-top: auto;
  padding: var(--space-4) 8px 0;
  border-top: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
}

.userEmail {
  font: 400 13px/18px var(--font-sans);
  color: var(--ink-secondary);
  overflow-wrap: anywhere;
}

.main {
  min-width: 0;
  padding: var(--space-5) var(--space-6) var(--space-7);
}

.grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: var(--space-4);
  align-items: start;
}

.side2 {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
}

.stats {
  list-style: none;
  margin: 0 0 var(--space-5);
  padding: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-4);
}

.stat {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: var(--space-4);
  background: var(--paper-raised);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  color: var(--ink);
  text-decoration: none;
  transition: border-color 120ms ease-out;
}

.stat:hover {
  border-color: var(--line-strong);
}

.statLabel {
  display: flex;
  align-items: center;
  gap: 6px;
  font: 500 13px/18px var(--font-sans);
  color: var(--ink-secondary);
}

.statValue {
  margin-top: 10px;
  font: 500 32px/36px var(--font-mono);
  letter-spacing: -0.02em;
}

.statNote {
  font: 400 12px/16px var(--font-mono);
  color: var(--ink-muted);
}

.recent {
  list-style: none;
  margin: 0;
  padding: 0;
}

.recent li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
}

.recent li:last-child {
  border-bottom: 0;
}

.recent a {
  font: 500 15px/22px var(--font-sans);
  color: var(--ink);
  text-decoration: none;
  min-width: 0;
  overflow-wrap: anywhere;
}

.recent a:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.recentMeta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font: 400 13px/20px var(--font-mono);
  color: var(--ink-muted);
}

.panel {
  background: var(--paper-raised);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  padding: var(--space-4) var(--space-5) var(--space-5);
}

.panelTitle {
  margin-bottom: var(--space-3);
  font: 600 12px/16px var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-muted);
}

.checks,
.steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  color: var(--ink-secondary);
}

.checks li {
  display: flex;
  gap: var(--space-2);
  align-items: flex-start;
}

.checks svg {
  flex: none;
  margin-top: 3px;
}

.checks b {
  color: var(--ink);
  font-weight: 600;
  margin-right: 4px;
}

.ok {
  color: var(--success);
}

.bad {
  color: var(--danger);
}

.steps li {
  display: flex;
  gap: var(--space-3);
}

.version {
  flex: none;
  min-width: 52px;
  font: 500 13px/22px var(--font-mono);
  color: var(--meridian);
}

@media (max-width: 1024px) {
  .shell {
    grid-template-columns: minmax(0, 1fr);
    align-content: start;
  }

  .grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .side {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    border-right: 0;
    border-bottom: 1px solid var(--line);
    padding: 12px 16px;
    gap: 12px 16px;
  }

  .brandLabel {
    display: none;
  }

  .nav,
  .navGroup {
    flex-direction: row;
    gap: 2px;
  }

  .nav {
    order: 3;
    flex: 1 1 100%;
    overflow-x: auto;
    margin: 0 -16px;
    padding: 0 16px;
  }

  .navLabel {
    display: none;
  }

  .nav a {
    white-space: nowrap;
  }

  .user {
    margin: 0 0 0 auto;
    padding: 0;
    border: 0;
    flex-direction: row;
    align-items: center;
  }

  .userEmail {
    display: none;
  }

  .main {
    padding: var(--space-4);
  }
}

.loading {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: 640px;
  padding-top: var(--space-2);
}

.loadingBar {
  display: block;
  height: 16px;
  border-radius: var(--radius-sm);
  background: var(--paper-sunken);
}

.loadingBar:first-child {
  width: 40%;
  height: 32px;
  margin-bottom: var(--space-3);
}

.loadingBar:nth-child(3) {
  width: 70%;
}

.srOnly {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}
```


### `src/app/newsroom/(app)/not-found.tsx`

```tsx
import { ButtonLink } from '@/components/ds/Button';
import { EmptyState } from '@/components/newsroom/ui';

export default function NewsroomNotFound() {
  return (
    <EmptyState icon="search" title="Not found">
      <p>This item does not exist any more, or the link is incomplete.</p>
      <ButtonLink href="/newsroom" variant="primary">
        Back to the Dashboard
      </ButtonLink>
    </EmptyState>
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
  ['v0.3.0', 'Media library on Cloudinary, lead images and image blocks'],
  ['v0.4.0', 'Public site'],
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


### `src/app/newsroom/(app)/sections/[id]/page.tsx`

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ConfirmButton } from '@/components/newsroom/ConfirmButton';
import forms from '@/components/newsroom/forms.module.css';
import { noticeFor } from '@/components/newsroom/notices';
import { TaxonomyForm } from '@/components/newsroom/TaxonomyForm';
import { Notice, PageHeader } from '@/components/newsroom/ui';
import { UUID } from '@/lib/doc/schema';
import { requireStaff } from '@/modules/auth/staff';
import { deleteSection, saveSection } from '@/modules/taxonomy/actions';
import { getSection, getUsage } from '@/modules/taxonomy/queries';

export const metadata: Metadata = { title: 'Edit section' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

export default async function EditSectionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  await requireStaff();
  const [{ id }, { notice }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const [section, usage] = await Promise.all([getSection(id), getUsage()]);
  if (!section) notFound();
  const articles = usage.sections[id] ?? 0;
  const message = noticeFor('section', notice);

  return (
    <>
      <PageHeader title={section.name} back={{ href: '/newsroom/sections', label: 'Sections' }} />
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <TaxonomyForm
        kind="section"
        action={saveSection}
        initial={{ id: section.id, name: section.name, slug: section.slug, description: section.description, inNav: section.in_nav }}
        cancelHref="/newsroom/sections"
      />
      <section className={forms.danger}>
        <h2 className={forms.dangerTitle}>
          Delete section
        </h2>
        {articles > 0 ? (
          <p className={forms.dangerText}>
            {articles === 1 ? 'One article uses' : `${articles} articles use`} this section. Move {articles === 1 ? 'it' : 'them'} to another section
            before deleting it.
          </p>
        ) : (
          <form action={deleteSection}>
            <input type="hidden" name="id" value={section.id} />
            <ConfirmButton
              icon="trash"
              title={`Delete ${section.name}?`}
              body="The section is removed from the Newsroom and the navigation. This cannot be undone."
              confirmLabel="Delete section"
              danger
            >
              Delete section
            </ConfirmButton>
          </form>
        )}
      </section>
    </>
  );
}
```


### `src/app/newsroom/(app)/sections/new/page.tsx`

```tsx
import type { Metadata } from 'next';
import { TaxonomyForm } from '@/components/newsroom/TaxonomyForm';
import { PageHeader } from '@/components/newsroom/ui';
import { requireStaff } from '@/modules/auth/staff';
import { saveSection } from '@/modules/taxonomy/actions';

export const metadata: Metadata = { title: 'New section' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

export default async function NewSectionPage() {
  await requireStaff();
  return (
    <>
      <PageHeader title="New section" back={{ href: '/newsroom/sections', label: 'Sections' }} />
      <TaxonomyForm kind="section" action={saveSection} initial={{ name: '', slug: '', description: '', inNav: true }} cancelHref="/newsroom/sections" />
    </>
  );
}
```


### `src/app/newsroom/(app)/sections/page.tsx`

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button, ButtonLink } from '@/components/ds/Button';
import { noticeFor } from '@/components/newsroom/notices';
import { EmptyState, Notice, PageHeader, ui } from '@/components/newsroom/ui';
import { requireStaff } from '@/modules/auth/staff';
import { moveSection } from '@/modules/taxonomy/actions';
import { getUsage, listSections } from '@/modules/taxonomy/queries';

export const metadata: Metadata = { title: 'Sections' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

export default async function SectionsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  await requireStaff();
  const [{ notice }, sections, usage] = await Promise.all([searchParams, listSections(), getUsage()]);
  const message = noticeFor('section', notice);

  return (
    <>
      <PageHeader
        title="Sections"
        description="Sections group articles and give them their address, like /business/rice-prices. The order here is the order in the main navigation."
        actions={
          <ButtonLink href="/newsroom/sections/new" variant="primary" icon="plus">
            New section
          </ButtonLink>
        }
      />
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <div className={ui.tableWrap}>
        {sections.length === 0 ? (
          <EmptyState icon="folder" title="No sections yet">
            <p>Create the sections of the site first, for example News, Politics and Business.</p>
          </EmptyState>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col" className={ui.num}>
                  Articles
                </th>
                <th scope="col">Navigation</th>
                <th scope="col">Order</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((section, index) => (
                <tr key={section.id}>
                  <td className={ui.cellTitle}>
                    <Link href={`/newsroom/sections/${section.id}`}>{section.name}</Link>
                    <span className={ui.slug}>/{section.slug}</span>
                  </td>
                  <td className={ui.num}>{usage.sections[section.id] ?? 0}</td>
                  <td>{section.in_nav ? 'Shown' : 'Hidden'}</td>
                  <td>
                    <div className={ui.rowActions}>
                      <form action={moveSection}>
                        <input type="hidden" name="id" value={section.id} />
                        <input type="hidden" name="direction" value="up" />
                        <Button type="submit" variant="quiet" size="sm" icon="arrow-up" aria-label={`Move ${section.name} up`} disabled={index === 0} />
                      </form>
                      <form action={moveSection}>
                        <input type="hidden" name="id" value={section.id} />
                        <input type="hidden" name="direction" value="down" />
                        <Button
                          type="submit"
                          variant="quiet"
                          size="sm"
                          icon="arrow-down"
                          aria-label={`Move ${section.name} down`}
                          disabled={index === sections.length - 1}
                        />
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
```


### `src/app/newsroom/(app)/tags/[id]/page.tsx`

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ConfirmButton } from '@/components/newsroom/ConfirmButton';
import forms from '@/components/newsroom/forms.module.css';
import { noticeFor } from '@/components/newsroom/notices';
import { TaxonomyForm } from '@/components/newsroom/TaxonomyForm';
import { Notice, PageHeader } from '@/components/newsroom/ui';
import { UUID } from '@/lib/doc/schema';
import { requireStaff } from '@/modules/auth/staff';
import { deleteTag, saveTag } from '@/modules/taxonomy/actions';
import { getTag, getUsage } from '@/modules/taxonomy/queries';

export const metadata: Metadata = { title: 'Edit tag' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

export default async function EditTagPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  await requireStaff();
  const [{ id }, { notice }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const [tag, usage] = await Promise.all([getTag(id), getUsage()]);
  if (!tag) notFound();
  const articles = usage.tags[id] ?? 0;
  const message = noticeFor('tag', notice);

  return (
    <>
      <PageHeader title={tag.name} back={{ href: '/newsroom/tags', label: 'Tags' }} />
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <TaxonomyForm kind="tag" action={saveTag} initial={{ id: tag.id, name: tag.name, slug: tag.slug, description: tag.description }} cancelHref="/newsroom/tags" />
      <section className={forms.danger}>
        <h2 className={forms.dangerTitle}>
          Delete tag
        </h2>
        <p className={forms.dangerText}>
          {articles > 0 ? `The tag is removed from ${articles === 1 ? 'one article' : `${articles} articles`}. The articles stay.` : 'No articles use this tag.'}
        </p>
        <form action={deleteTag}>
          <input type="hidden" name="id" value={tag.id} />
          <ConfirmButton
            icon="trash"
            title={`Delete ${tag.name}?`}
            body={articles > 0 ? 'The tag is removed from its articles. This cannot be undone.' : 'This cannot be undone.'}
            confirmLabel="Delete tag"
            danger
          >
            Delete tag
          </ConfirmButton>
        </form>
      </section>
    </>
  );
}
```


### `src/app/newsroom/(app)/tags/new/page.tsx`

```tsx
import type { Metadata } from 'next';
import { TaxonomyForm } from '@/components/newsroom/TaxonomyForm';
import { PageHeader } from '@/components/newsroom/ui';
import { requireStaff } from '@/modules/auth/staff';
import { saveTag } from '@/modules/taxonomy/actions';

export const metadata: Metadata = { title: 'New tag' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

export default async function NewTagPage() {
  await requireStaff();
  return (
    <>
      <PageHeader title="New tag" back={{ href: '/newsroom/tags', label: 'Tags' }} />
      <TaxonomyForm kind="tag" action={saveTag} initial={{ name: '', slug: '', description: '' }} cancelHref="/newsroom/tags" />
    </>
  );
}
```


### `src/app/newsroom/(app)/tags/page.tsx`

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { ButtonLink } from '@/components/ds/Button';
import { noticeFor } from '@/components/newsroom/notices';
import { EmptyState, Notice, PageHeader, ui } from '@/components/newsroom/ui';
import { requireStaff } from '@/modules/auth/staff';
import { getUsage, listTags } from '@/modules/taxonomy/queries';

export const metadata: Metadata = { title: 'Tags' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

export default async function TagsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  await requireStaff();
  const [{ notice }, tags, usage] = await Promise.all([searchParams, listTags(), getUsage()]);
  const message = noticeFor('tag', notice);

  return (
    <>
      <PageHeader
        title="Tags"
        description="Tags connect articles across sections, for example Elections or Rice. Each tag gets its own page at /tag/…"
        actions={
          <ButtonLink href="/newsroom/tags/new" variant="primary" icon="plus">
            New tag
          </ButtonLink>
        }
      />
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <div className={ui.tableWrap}>
        {tags.length === 0 ? (
          <EmptyState icon="tag" title="No tags yet">
            <p>Add tags for the topics you cover often.</p>
          </EmptyState>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col" className={ui.num}>
                  Articles
                </th>
                <th scope="col">Description</th>
              </tr>
            </thead>
            <tbody>
              {tags.map((tag) => (
                <tr key={tag.id}>
                  <td className={ui.cellTitle}>
                    <Link href={`/newsroom/tags/${tag.id}`}>{tag.name}</Link>
                    <span className={ui.slug}>/tag/{tag.slug}</span>
                  </td>
                  <td className={ui.num}>{usage.tags[tag.id] ?? 0}</td>
                  <td className={ui.cellTitle}>{tag.description || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
import { docText, readingMinutes, wordCount } from '@/lib/doc/text';
import { formatWib } from '@/lib/time';
import { requireStaff } from '@/modules/auth/staff';
import { ArticleBody } from '@/modules/content/ArticleBody';
import { TYPE_LABELS } from '@/modules/editor/input';
import { articleLinks, getArticle, getRevision } from '@/modules/editor/queries';
import { STATUS_LABELS } from '@/modules/editor/status';
import { getSection, listAuthors } from '@/modules/taxonomy/queries';
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
  };

  const readMoreIds = view.body.content.filter((block): block is Extract<Block, { type: 'readMore' }> => block.type === 'readMore').map((block) => block.attrs.articleId);
  const [section, authors, links] = await Promise.all([view.sectionId ? getSection(view.sectionId) : null, listAuthors(), articleLinks(readMoreIds)]);
  const byline = view.authorIds.map((authorId) => authors.find((a) => a.id === authorId)).filter((a) => a !== undefined);
  const minutes = readingMinutes(wordCount(docText(view.body)));
  const dateLine = article.published_at
    ? `${formatWib(article.published_at)} WIB`
    : article.scheduled_at
      ? `Scheduled for ${formatWib(article.scheduled_at)} WIB`
      : 'Not published yet';
  const kicker = view.kicker || section?.name || TYPE_LABELS[view.type];

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
        <article className={styles.article}>
          <header className={styles.head}>
            <p className={styles.kickers}>
              <span className={styles.kicker}>{kicker}</span>
              {view.type !== 'news' && kicker !== TYPE_LABELS[view.type] && <span className={styles.kickerPlain}>{TYPE_LABELS[view.type]}</span>}
            </p>
            <h1 className={styles.headline}>{view.title || 'Untitled'}</h1>
            {view.standfirst && <p className={styles.stand}>{view.standfirst}</p>}
          </header>
          <div className={styles.byline}>
            <p className={styles.who}>
              {byline.length ? (
                <>
                  By{' '}
                  {byline.map((author, index) => (
                    <span key={author.id}>
                      {index > 0 && (index === byline.length - 1 ? ' and ' : ', ')}
                      <b>{author.name}</b>
                    </span>
                  ))}
                  {byline.length === 1 && byline[0].role && <span className={styles.role}> · {byline[0].role}</span>}
                </>
              ) : (
                <span className={styles.role}>No author yet</span>
              )}
            </p>
            <p className={styles.meta}>
              {dateLine}
              {minutes > 0 && ` · ${minutes} min read`}
            </p>
          </div>
          <ArticleBody doc={view.body} links={links} />
          {view.sources.length > 0 && (
            <section className={styles.sources} aria-label="Sources">
              <h2>Sources</h2>
              <ol>
                {view.sources.map((source, index) => (
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
        </article>
      </main>
    </div>
  );
}
```


### `src/app/newsroom/preview/[id]/preview.module.css`

```css
/* Article preview in the site's article layout (locked preview: .art, .art-head, .byline). */

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

.article {
  max-width: 680px;
  margin: 0 auto;
  padding-top: var(--space-7);
}

.head {
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

.kicker,
.kickerPlain {
  font: 600 12px/16px var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--meridian);
}

.kickerPlain {
  color: var(--ink-muted);
}

.headline {
  font: 500 clamp(32px, 3.6vw, 44px) / 1.12 var(--font-serif);
  letter-spacing: -0.01em;
  font-variation-settings: 'opsz' 60;
  text-wrap: balance;
}

.stand {
  font: 400 21px/31px var(--font-serif);
  font-variation-settings: 'opsz' 24;
  color: var(--ink-secondary);
  text-wrap: pretty;
}

.byline {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 0;
  margin-bottom: var(--space-6);
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.who {
  font: 400 14px/20px var(--font-sans);
}

.who b {
  font-weight: 600;
}

.role {
  color: var(--ink-secondary);
}

.meta {
  font: 400 13px/20px var(--font-mono);
  color: var(--ink-muted);
}

.sources {
  margin-top: var(--space-7);
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
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sources a {
  color: var(--link);
  text-decoration: underline;
  text-underline-offset: 3px;
}

@media (max-width: 640px) {
  .stand {
    font-size: 19px;
    line-height: 28px;
  }
}
```


### `src/components/ds/Button.module.css`

```css
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font: 500 15px/22px var(--font-sans);
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 120ms ease-out, border-color 120ms ease-out;
}

a.button {
  text-decoration: none;
}

.button svg {
  flex: none;
}

.md {
  height: 40px;
  padding: 0 var(--space-4);
}

.sm {
  height: 32px;
  padding: 0 var(--space-3);
  font-size: 14px;
}

.primary {
  background: var(--navy);
  color: var(--on-navy);
}

.primary:hover {
  background: var(--ink-secondary);
}

.secondary {
  background: transparent;
  border-color: var(--line-strong);
  color: var(--ink);
}

.secondary:hover {
  background: var(--paper-sunken);
  border-color: var(--ink);
}

.quiet {
  background: transparent;
  color: var(--ink);
}

.quiet:hover {
  background: var(--paper-sunken);
}

.button:disabled,
.button[aria-disabled='true'] {
  cursor: not-allowed;
  color: var(--ink-muted);
  background: var(--paper-sunken);
  border-color: var(--line);
}

.full {
  width: 100%;
}

.iconOnly.md {
  width: 40px;
  padding: 0;
}

.iconOnly.sm {
  width: 32px;
  padding: 0;
}

.quiet:disabled,
.quiet[aria-disabled='true'] {
  background: transparent;
  border-color: transparent;
}
```


### `src/components/ds/Button.tsx`

```tsx
import Link from 'next/link';
import type { ButtonHTMLAttributes, ComponentProps } from 'react';
import { Icon, type IconName } from './Icon';
import styles from './Button.module.css';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'quiet';
  size?: 'md' | 'sm';
  icon?: IconName;
  iconAfter?: IconName;
  fullWidth?: boolean;
};

/** Design system button. `secondary` is the default; use one `primary` per view. Icon-only buttons need `aria-label`. */
export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconAfter,
  fullWidth,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [styles.button, styles[variant], styles[size], fullWidth && styles.full, !children && styles.iconOnly, className]
    .filter(Boolean)
    .join(' ');
  const iconSize = size === 'sm' ? 16 : 18;
  return (
    <button type={type} className={classes} {...rest}>
      {icon && <Icon name={icon} size={iconSize} />}
      {children && <span>{children}</span>}
      {iconAfter && <Icon name={iconAfter} size={iconSize} />}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: 'primary' | 'secondary' | 'quiet';
  size?: 'md' | 'sm';
  icon?: IconName;
};

/** A link that looks like a Button, for navigation (new item, back, preview). */
export function ButtonLink({ variant = 'secondary', size = 'md', icon, className, children, ...rest }: ButtonLinkProps) {
  const classes = [styles.button, styles[variant], styles[size], !children && styles.iconOnly, className].filter(Boolean).join(' ');
  return (
    <Link className={classes} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children && <span>{children}</span>}
    </Link>
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


### `src/components/newsroom/ArticleTable.module.css`

```css
.bulk {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-bottom: var(--space-3);
}

.select {
  height: 32px;
  padding: 0 32px 0 10px;
  font: 400 14px/20px var(--font-sans);
  color: var(--ink);
  background: var(--paper-raised);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
  appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, var(--ink-muted) 50%), linear-gradient(135deg, var(--ink-muted) 50%, transparent 50%);
  background-position: calc(100% - 16px) 14px, calc(100% - 11px) 14px;
  background-size: 5px 5px;
  background-repeat: no-repeat;
}

.count {
  font: 400 13px/20px var(--font-mono);
  color: var(--ink-muted);
}

.check {
  width: 44px;
  padding-right: 0 !important;
}

.check input {
  width: 18px;
  height: 18px;
  accent-color: var(--navy);
  vertical-align: middle;
}
```


### `src/components/newsroom/ArticleTable.tsx`

```tsx
'use client';

import Link from 'next/link';
import { useActionState, useId, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { formatWib } from '@/lib/time';
import { type BulkState, bulkArticles } from '@/modules/editor/actions';
import type { ArticleListRow } from '@/modules/editor/queries';
import { CONFIRMATIONS } from '@/modules/editor/status';
import styles from './ArticleTable.module.css';
import { ConfirmButton } from './ConfirmButton';
import { StatusBadge } from './StatusBadge';
import { Notice, ui } from './ui';

const ACTIONS = [
  ['publish', 'Publish'],
  ['unpublish', 'Unpublish'],
  ['archive', 'Archive'],
  ['delete', 'Delete'],
] as const;

/** The article list with checkboxes for actions on several articles at once. */
export function ArticleTable({ rows }: { rows: ArticleListRow[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [state, formAction, pending] = useActionState<BulkState, FormData>(async (previous, form) => {
    const result = await bulkArticles(previous, form);
    setSelected([]);
    return result;
  }, {});
  const [action, setAction] = useState('');
  const uid = useId();
  const allSelected = rows.length > 0 && selected.length === rows.length;
  const visibleSelected = selected.filter((id) => rows.some((row) => row.id === id));

  const confirmText =
    action === 'delete'
      ? 'Published articles are skipped. This cannot be undone.'
      : action === 'unpublish'
        ? CONFIRMATIONS.unpublish?.body
        : action === 'archive'
          ? CONFIRMATIONS.archive?.body
          : undefined;

  return (
    <form action={formAction}>
      {state.message && (
        <Notice tone={state.tone ?? 'info'}>
          <span>{state.message}</span>
          {state.problems && state.problems.length > 0 && (
            <ul>
              {state.problems.map((problem, index) => (
                <li key={index}>
                  <b>{problem.title}</b>: {problem.reasons.join(' ')}
                </li>
              ))}
            </ul>
          )}
        </Notice>
      )}
      <div className={styles.bulk} role="group" aria-label="Actions for selected articles">
        <label htmlFor={`${uid}-action`} className={ui.srOnly}>
          Action for selected articles
        </label>
        <select id={`${uid}-action`} name="action" className={styles.select} value={action} onChange={(event) => setAction(event.target.value)}>
          <option value="">With selected…</option>
          {ACTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {confirmText ? (
          <ConfirmButton
            size="sm"
            disabled={pending || visibleSelected.length === 0}
            title={`${ACTIONS.find(([value]) => value === action)?.[1]} ${visibleSelected.length === 1 ? '1 article' : `${visibleSelected.length} articles`}?`}
            body={confirmText}
            confirmLabel={ACTIONS.find(([value]) => value === action)?.[1] ?? 'Apply'}
            danger={action === 'delete'}
          >
            {pending ? 'Working…' : 'Apply'}
          </ConfirmButton>
        ) : (
          <Button type="submit" size="sm" disabled={pending || !action || visibleSelected.length === 0}>
            {pending ? 'Working…' : 'Apply'}
          </Button>
        )}
        <span className={styles.count} aria-live="polite">
          {visibleSelected.length ? `${visibleSelected.length} selected` : ''}
        </span>
      </div>
      <div className={ui.tableWrap}>
        <table className={ui.table}>
          <thead>
            <tr>
              <th scope="col" className={styles.check}>
                <input
                  type="checkbox"
                  aria-label="Select all articles on this page"
                  checked={allSelected}
                  onChange={(event) => setSelected(event.target.checked ? rows.map((row) => row.id) : [])}
                />
              </th>
              <th scope="col">Title</th>
              <th scope="col">Section</th>
              <th scope="col">Author</th>
              <th scope="col">Status</th>
              <th scope="col">Updated</th>
              <th scope="col" className={ui.num}>
                Words
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const title = row.title || 'Untitled';
              return (
                <tr key={row.id}>
                  <td className={styles.check}>
                    <input
                      type="checkbox"
                      name="ids"
                      value={row.id}
                      aria-label={`Select ${title}`}
                      checked={selected.includes(row.id)}
                      onChange={(event) =>
                        setSelected((current) => (event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id)))
                      }
                    />
                  </td>
                  <td className={ui.cellTitle}>
                    <Link href={`/newsroom/articles/${row.id}`} className={row.title ? undefined : ui.untitled}>
                      {title}
                    </Link>
                    <span className={ui.slug}>
                      /{row.section ? `${row.section.slug}/` : ''}
                      {row.slug}
                    </span>
                  </td>
                  <td>{row.section?.name ?? '—'}</td>
                  <td>{row.authors.length ? row.authors.join(', ') : '—'}</td>
                  <td>
                    <StatusBadge status={row.status} />
                    {row.status === 'scheduled' && row.scheduled_at && <span className={ui.slug}>{formatWib(row.scheduled_at, 'short')}</span>}
                  </td>
                  <td className={ui.mono}>{formatWib(row.updated_at, 'short')}</td>
                  <td className={ui.num}>{row.word_count}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </form>
  );
}
```


### `src/components/newsroom/ConfirmButton.tsx`

```tsx
'use client';

import { type ComponentProps, useId, useRef } from 'react';
import { Button } from '@/components/ds/Button';
import styles from './ui.module.css';

type ConfirmButtonProps = Omit<ComponentProps<typeof Button>, 'onClick' | 'type'> & {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  /** Called when confirmed. Without it, the confirm button submits the surrounding form. */
  onConfirm?: () => void;
};

/** A button that asks first, in a modal `<dialog>`. Inside a form, confirming submits that form. */
export function ConfirmButton({ title, body, confirmLabel, danger, onConfirm, children, ...button }: ConfirmButtonProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  return (
    <>
      <Button type="button" {...button} onClick={() => dialog.current?.showModal()}>
        {children}
      </Button>
      <dialog ref={dialog} className={styles.dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-body`}>
        <h2 id={`${id}-title`} className={styles.dialogTitle}>
          {title}
        </h2>
        <p id={`${id}-body`} className={styles.dialogBody}>
          {body}
        </p>
        <div className={styles.dialogActions}>
          <Button type="button" onClick={() => dialog.current?.close()} autoFocus>
            Cancel
          </Button>
          <Button
            type={onConfirm ? 'button' : 'submit'}
            variant="primary"
            className={danger ? styles.dangerButton : undefined}
            onClick={() => {
              if (onConfirm) {
                dialog.current?.close();
                onConfirm();
              }
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </dialog>
    </>
  );
}
```


### `src/components/newsroom/Field.tsx`

```tsx
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { Icon } from '@/components/ds/Icon';
import styles from './forms.module.css';

// Labelled form controls for the Newsroom (design system: TextField). The label is always visible,
// hints and errors sit underneath and are linked with aria-describedby.

type Common = { id: string; label: ReactNode; hint?: ReactNode; error?: string; optional?: boolean; mono?: boolean };

function describedBy(id: string, hint?: ReactNode, error?: string) {
  return [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined;
}

function Notes({ id, hint, error }: { id: string; hint?: ReactNode; error?: string }) {
  return (
    <>
      {error && (
        <p id={`${id}-error`} className={styles.error}>
          <Icon name="alert" size={16} />
          {error}
        </p>
      )}
      {hint && (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
    </>
  );
}

function Label({ id, label, optional }: { id: string; label: ReactNode; optional?: boolean }) {
  return (
    <label htmlFor={id} className={styles.label}>
      {label}
      {optional && <span className={styles.optional}> (optional)</span>}
    </label>
  );
}

export function TextField({ id, label, hint, error, optional, mono, className, ...input }: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <Label id={id} label={label} optional={optional} />
      <input
        id={id}
        className={[styles.input, mono && styles.mono, error && styles.invalid].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...input}
      />
      <Notes id={id} hint={hint} error={error} />
    </div>
  );
}

export function TextArea({ id, label, hint, error, optional, mono, className, ...input }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <Label id={id} label={label} optional={optional} />
      <textarea
        id={id}
        className={[styles.textarea, mono && styles.mono, error && styles.invalid].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...input}
      />
      <Notes id={id} hint={hint} error={error} />
    </div>
  );
}

export function SelectField({
  id,
  label,
  hint,
  error,
  optional,
  className,
  children,
  ...select
}: Omit<Common, 'mono'> & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <Label id={id} label={label} optional={optional} />
      <select
        id={id}
        className={[styles.select, error && styles.invalid].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...select}
      >
        {children}
      </select>
      <Notes id={id} hint={hint} error={error} />
    </div>
  );
}

export function CheckboxField({ id, label, hint, className, ...input }: Omit<Common, 'error' | 'optional' | 'mono'> & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={[styles.check, className].filter(Boolean).join(' ')}>
      <input id={id} type="checkbox" aria-describedby={hint ? `${id}-hint` : undefined} {...input} />
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
    </div>
  );
}
```


### `src/components/newsroom/SideNav.tsx`

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/ds/Icon';

const GROUPS: { label?: string; links: { href: string; label: string; icon: IconName }[] }[] = [
  { links: [{ href: '/newsroom', label: 'Dashboard', icon: 'grid' }] },
  {
    label: 'Content',
    links: [
      { href: '/newsroom/articles', label: 'Articles', icon: 'file' },
      { href: '/newsroom/sections', label: 'Sections', icon: 'folder' },
      { href: '/newsroom/tags', label: 'Tags', icon: 'tag' },
      { href: '/newsroom/authors', label: 'Authors', icon: 'users' },
    ],
  },
];

function isCurrent(pathname: string, href: string) {
  return href === '/newsroom' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function SideNav({ className, groupClassName, labelClassName }: { className: string; groupClassName: string; labelClassName: string }) {
  const pathname = usePathname();
  return (
    <nav className={className} aria-label="Newsroom sections">
      {GROUPS.map((group, index) => (
        <div key={group.label ?? index} className={groupClassName} role="group" aria-label={group.label}>
          {group.label && (
            <p className={labelClassName} aria-hidden="true">
              {group.label}
            </p>
          )}
          {group.links.map((link) => (
            <Link key={link.href} href={link.href} aria-current={isCurrent(pathname, link.href) ? 'page' : undefined}>
              <Icon name={link.icon} />
              {link.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
```


### `src/components/newsroom/StatusBadge.tsx`

```tsx
import { Icon, type IconName } from '@/components/ds/Icon';
import { type ArticleStatus, STATUS_LABELS } from '@/modules/editor/status';
import styles from './ui.module.css';

// Design system: StatusBadge. Every status carries an icon and a word, never colour alone.
const ICONS: Record<ArticleStatus, IconName> = {
  draft: 'edit',
  review: 'eye',
  scheduled: 'clock',
  published: 'check',
  archived: 'archive',
};

export function StatusBadge({ status }: { status: ArticleStatus }) {
  return (
    <span className={`${styles.status} ${styles[`st-${status}`]}`}>
      <Icon name={ICONS[status]} size={16} />
      {STATUS_LABELS[status]}
    </span>
  );
}
```


### `src/components/newsroom/SubmitButton.tsx`

```tsx
'use client';

import type { ComponentProps } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ds/Button';

/** Submit button that shows `pendingLabel` and blocks double submits while its form is sending. */
export function SubmitButton({ pendingLabel, children, ...button }: ComponentProps<typeof Button> & { pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" aria-disabled={pending || undefined} disabled={pending} {...button}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
```


### `src/components/newsroom/TaxonomyForm.tsx`

```tsx
'use client';

import { useActionState, useId, useState } from 'react';
import { ButtonLink } from '@/components/ds/Button';
import { slugify } from '@/lib/slug';
import type { FormState } from '@/modules/taxonomy/actions';
import { AUTHOR_LINK_ROWS, type AuthorLink } from '@/modules/taxonomy/validate';
import { CheckboxField, TextArea, TextField } from './Field';
import styles from './forms.module.css';
import { SubmitButton } from './SubmitButton';
import { Notice } from './ui';

type Kind = 'section' | 'tag' | 'author';

export type TaxonomyValues = {
  id?: string;
  name: string;
  slug: string;
  description?: string;
  inNav?: boolean;
  role?: string;
  bio?: string;
  links?: AuthorLink[];
};

const PREFIX: Record<Kind, string> = { section: '/', tag: '/tag/', author: '/author/' };

/** Create or edit form for a section, tag or author. The address follows the name until it is edited. */
export function TaxonomyForm({
  kind,
  action,
  initial,
  cancelHref,
}: {
  kind: Kind;
  action: (state: FormState, form: FormData) => Promise<FormState>;
  initial: TaxonomyValues;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, { errors: {} });
  // Ids must be unique per mount: Next keeps recently visited pages in the DOM (hidden) for instant back navigation.
  const uid = useId();
  const editing = Boolean(initial.id);
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(editing);
  const values = { ...initial, ...(state.values as Partial<TaxonomyValues> | undefined) };
  const errors = state.errors;
  const links = [...(values.links ?? [])];
  while (links.length < AUTHOR_LINK_ROWS) links.push({ label: '', url: '' });

  return (
    <form action={formAction} className={styles.form} noValidate>
      {state.message && <Notice tone="error">{state.message}</Notice>}
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <TextField
        id={`${uid}-name`}
        name="name"
        label="Name"
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          if (!slugTouched) setSlug(slugify(event.target.value));
        }}
        error={errors.name}
        required
        maxLength={kind === 'author' ? 80 : 60}
      />
      <TextField
        id={`${uid}-slug`}
        name="slug"
        label="Address"
        mono
        value={slug}
        onChange={(event) => {
          setSlug(event.target.value);
          setSlugTouched(true);
        }}
        onBlur={() => setSlug((current) => slugify(current) || current)}
        error={errors.slug}
        hint={
          editing
            ? `presscompass.site${PREFIX[kind]}${slug || '…'} · Changing it adds a redirect from the old address once readers can see it.`
            : `presscompass.site${PREFIX[kind]}${slug || '…'} · Fills in from the name.`
        }
      />
      {kind === 'author' && (
        <TextField id={`${uid}-role`} name="role" label="Role" optional defaultValue={values.role} error={errors.role} placeholder="Business correspondent" maxLength={80} />
      )}
      {kind === 'author' ? (
        <TextArea id={`${uid}-bio`} name="bio" label="Biography" optional rows={5} defaultValue={values.bio} error={errors.bio} maxLength={1000} />
      ) : (
        <TextArea
          id={`${uid}-description`}
          name="description"
          label="Description"
          optional
          rows={3}
          defaultValue={values.description}
          error={errors.description}
          maxLength={300}
          hint={kind === 'section' ? 'Shown on the section page and in search results.' : 'Shown on the tag page.'}
        />
      )}
      {kind === 'section' && (
        <CheckboxField id={`${uid}-in-nav`} name="in_nav" label="Show in the main navigation" defaultChecked={values.inNav ?? true} />
      )}
      {kind === 'author' && (
        <fieldset className={styles.fieldset}>
          <legend className={styles.label}>
            Profile links <span className={styles.optional}>(optional)</span>
          </legend>
          {errors.links && <Notice tone="error">{errors.links}</Notice>}
          {links.map((link, index) => (
            <div className={styles.row} key={index}>
              <TextField id={`${uid}-link-label-${index}`} name={`link_label_${index}`} label={`Link ${index + 1} label`} defaultValue={link.label} placeholder={index === 0 ? 'Website' : undefined} maxLength={40} />
              <TextField id={`${uid}-link-url-${index}`} name={`link_url_${index}`} label={`Link ${index + 1} address`} type="url" defaultValue={link.url} placeholder="https://" mono />
            </div>
          ))}
        </fieldset>
      )}
      <div className={styles.actions}>
        <SubmitButton pendingLabel="Saving…">{editing ? 'Save changes' : `Create ${kind}`}</SubmitButton>
        <ButtonLink href={cancelHref} variant="quiet">
          Cancel
        </ButtonLink>
      </div>
    </form>
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
import { BlockDialog } from './BlockDialog';
import styles from './editor.module.css';
import type { SpecialKind } from './extensions';

// How a special block looks inside the editor: a labelled card with a short preview, Edit and Remove.

export const ArticleIdContext = createContext('');

const META: Record<SpecialKind, { label: string; icon: IconName }> = {
  pullQuote: { label: 'Pull quote', icon: 'quote' },
  editorNote: { label: "Editor's note", icon: 'info' },
  keyFigures: { label: 'Key figures', icon: 'chart' },
  youtube: { label: 'YouTube video', icon: 'video' },
  readMore: { label: 'Read more', icon: 'link' },
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
  }
}

export function BlockCard({ node, updateAttributes, deleteNode, selected, editor }: ReactNodeViewProps) {
  const kind = node.type.name as SpecialKind;
  const articleId = useContext(ArticleIdContext);
  const [editing, setEditing] = useState(false);
  const meta = META[kind];
  const editable = editor.isEditable;

  return (
    <NodeViewWrapper className={styles.card} data-selected={selected || undefined} contentEditable={false} data-drag-handle="">
      <p className={styles.cardLabel}>
        <Icon name={meta.icon} size={16} />
        {meta.label}
      </p>
      <p className={styles.cardText}>{summary(kind, node.attrs)}</p>
      {editable && (
        <div className={styles.cardActions}>
          <Button size="sm" variant="secondary" icon="edit" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button size="sm" variant="quiet" icon="trash" onClick={() => deleteNode()} aria-label={`Remove ${meta.label.toLowerCase()}`} />
        </div>
      )}
      {editing && (
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
```


### `src/components/newsroom/editor/BlockDialog.tsx`

```tsx
'use client';

import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ds/Button';
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
import { type Ref, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { Icon, type IconName } from '@/components/ds/Icon';
import type { Doc } from '@/lib/doc/schema';
import { ArticleIdContext, BlockCard } from './BlockCard';
import { BlockDialog, type DialogKind } from './BlockDialog';
import styles from './editor.module.css';
import { editorExtensions, SPECIAL_DEFAULTS, type SpecialKind } from './extensions';

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
      { label: 'Pull quote', text: 'Pull quote', run: () => insert('pullQuote') },
      { label: 'Key figures', text: 'Figures', run: () => insert('keyFigures') },
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
              // Insert after a selected block instead of replacing it, and leave a paragraph to keep writing in.
              const { selection } = editor.state;
              const content = [{ type: dialog.kind, attrs }, { type: 'paragraph' }];
              if (selection instanceof NodeSelection) chain().insertContentAt(selection.to, content).run();
              else chain().insertContent(content).run();
            }
            setDialog(null);
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


### `src/components/newsroom/editor/editor.module.css`

```css
/* The body editor: toolbar, writing surface in the article typography, special block cards. */

.body {
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-md);
  background: var(--paper-raised);
}

.body[data-invalid] {
  border-color: var(--danger);
}

.body:focus-within {
  border-color: var(--meridian);
}

.bodyLoading {
  min-height: 360px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--paper-raised);
}

.toolbar {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  padding: 6px 8px;
  background: var(--paper-raised);
  border-bottom: 1px solid var(--line);
  border-radius: var(--radius-md) var(--radius-md) 0 0;
}

.toolGroup {
  display: flex;
  gap: 2px;
}

.tableTools {
  flex-basis: 100%;
  padding-top: 4px;
  border-top: 1px solid var(--line);
}

.tool {
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink-secondary);
  font: 600 13px/18px var(--font-sans);
  cursor: pointer;
  white-space: nowrap;
}

.tool:hover {
  background: var(--paper-sunken);
  color: var(--ink);
}

.tool[aria-pressed='true'] {
  background: var(--meridian-soft);
  color: var(--meridian);
}

.tool:disabled {
  color: var(--ink-muted);
  opacity: 0.5;
  cursor: default;
  background: transparent;
}

.prose {
  min-height: 420px;
  padding: var(--space-5) var(--space-5) var(--space-6);
  outline: none;
  color: var(--ink);
  font: 400 19px/31px var(--font-serif);
  font-variation-settings: 'opsz' 16;
}

.prose > * + * {
  margin-top: 20px;
}

.prose h2 {
  margin-top: 36px;
  font: 600 26px/32px var(--font-serif);
  font-variation-settings: 'opsz' 36;
}

.prose h3 {
  margin-top: 28px;
  font: 600 21px/28px var(--font-serif);
  font-variation-settings: 'opsz' 24;
}

.prose a {
  color: var(--link);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.prose ul,
.prose ol {
  padding-left: 26px;
}

.prose li + li {
  margin-top: 6px;
}

.prose blockquote {
  padding-left: 20px;
  border-left: 3px solid var(--line-strong);
  color: var(--ink-secondary);
}

.prose hr {
  width: 80px;
  margin: 32px auto;
  border: 0;
  border-top: 1px solid var(--line-strong);
}

.prose hr:global(.ProseMirror-selectednode) {
  outline: 2px solid var(--meridian);
  outline-offset: 6px;
}

.prose table {
  width: 100%;
  border-collapse: collapse;
  font: 400 15px/22px var(--font-sans);
  table-layout: fixed;
}

.prose th,
.prose td {
  position: relative;
  padding: 8px 10px;
  border: 1px solid var(--line);
  vertical-align: top;
  text-align: left;
}

.prose th {
  font-weight: 600;
  background: var(--paper-sunken);
}

.prose :global(.selectedCell)::after {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--meridian-soft);
  opacity: 0.5;
  pointer-events: none;
}

.prose :global(p.is-editor-empty:first-child)::before {
  content: attr(data-placeholder);
  float: left;
  height: 0;
  color: var(--ink-muted);
  pointer-events: none;
}

.card {
  margin: 24px 0;
  padding: 14px 16px;
  border: 1px solid var(--line);
  border-left: 3px solid var(--meridian);
  border-radius: var(--radius-sm);
  background: var(--paper);
  font: 400 15px/22px var(--font-sans);
  cursor: grab;
}

.card[data-selected] {
  outline: 2px solid var(--meridian);
  outline-offset: 2px;
}

.cardLabel {
  display: flex;
  align-items: center;
  gap: 6px;
  font: 600 12px/16px var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--meridian);
}

.cardText {
  margin-top: 6px;
  color: var(--ink);
  overflow-wrap: anywhere;
}

.cardActions {
  display: flex;
  gap: 4px;
  margin-top: 10px;
}

.blockDialog {
  width: min(560px, calc(100vw - 32px));
  max-height: calc(100vh - 48px);
  overflow-y: auto;
}

.figureRow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  gap: var(--space-3);
}

.searchRow {
  display: flex;
  gap: var(--space-2);
  align-items: flex-end;
}

.searchRow > :first-child {
  flex: 1;
}

.results {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 260px;
  overflow-y: auto;
}

.result {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--paper-raised);
  color: var(--ink);
  text-align: left;
  font: 500 15px/20px var(--font-sans);
  cursor: pointer;
}

.result small {
  font: 400 13px/18px var(--font-sans);
  color: var(--ink-muted);
}

.result:hover {
  border-color: var(--ink-secondary);
}

.result[aria-pressed='true'] {
  border-color: var(--meridian);
  background: var(--meridian-soft);
}

.chosen {
  font: 400 14px/20px var(--font-sans);
  color: var(--ink-secondary);
}

.remove {
  margin-right: auto;
  color: var(--danger);
}

@media (max-width: 640px) {
  .prose {
    padding: var(--space-4);
    font-size: 18px;
    line-height: 29px;
  }

  .figureRow {
    grid-template-columns: 1fr;
  }
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


### `src/components/newsroom/forms.module.css`

```css
/* Newsroom form controls (design system: TextField). */

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 640px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.label {
  font: 500 14px/20px var(--font-sans);
  color: var(--ink);
}

.optional {
  font-weight: 400;
  color: var(--ink-muted);
}

.input,
.select,
.textarea {
  width: 100%;
  min-height: 40px;
  padding: 8px 12px;
  font: 400 15px/22px var(--font-sans);
  color: var(--ink);
  background: var(--paper-raised);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
  transition: border-color 120ms ease-out;
}

.input::placeholder,
.textarea::placeholder {
  color: var(--ink-muted);
}

.input:hover,
.select:hover,
.textarea:hover {
  border-color: var(--ink-secondary);
}

.input:focus-visible,
.select:focus-visible,
.textarea:focus-visible {
  border-color: var(--meridian);
}

.input:disabled,
.select:disabled,
.textarea:disabled {
  color: var(--ink-muted);
  background: var(--paper-sunken);
  cursor: not-allowed;
}

.textarea {
  resize: vertical;
}

.mono {
  font-family: var(--font-mono);
  font-size: 14px;
}

.select {
  appearance: none;
  padding-right: 36px;
  background-image: linear-gradient(45deg, transparent 50%, var(--ink-muted) 50%),
    linear-gradient(135deg, var(--ink-muted) 50%, transparent 50%);
  background-position: calc(100% - 18px) 18px, calc(100% - 13px) 18px;
  background-size: 5px 5px;
  background-repeat: no-repeat;
}

.invalid {
  border-color: var(--danger);
}

.invalid:hover {
  border-color: var(--danger);
}

.hint {
  font: 400 13px/18px var(--font-sans);
  color: var(--ink-muted);
}

.error {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  font: 500 13px/18px var(--font-sans);
  color: var(--danger);
}

.error svg {
  flex: none;
  margin-top: 1px;
}

.check {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  gap: 2px 10px;
  align-items: start;
}

.check input {
  width: 18px;
  height: 18px;
  margin: 2px 0 0;
  accent-color: var(--navy);
}

.check .hint {
  grid-column: 2;
}

.fieldset {
  border: 0;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
}

.row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-4);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
  padding-top: var(--space-2);
}

.danger {
  margin-top: var(--space-6);
  padding-top: var(--space-5);
  border-top: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  align-items: flex-start;
  max-width: 640px;
}

.dangerTitle {
  font: 600 15px/22px var(--font-sans);
}

.dangerText {
  font: 400 14px/20px var(--font-sans);
  color: var(--ink-secondary);
}
```


### `src/components/newsroom/notices.ts`

```ts
// Messages shown after a redirect (`?notice=`), so a refresh or a shared link does not repeat an action.

type Kind = 'section' | 'tag' | 'author' | 'article';
type Notice = { tone: 'success' | 'error'; text: string };

const NAME: Record<Kind, string> = { section: 'Section', tag: 'Tag', author: 'Author', article: 'Article' };

const IN_USE: Partial<Record<Kind, string>> = {
  section: 'This section still has articles. Move them to another section before deleting it.',
  author: 'This author is credited on articles. Remove them from those articles before deleting.',
};

export function noticeFor(kind: Kind, code: string | string[] | undefined): Notice | null {
  switch (code) {
    case 'created':
      return { tone: 'success', text: `${NAME[kind]} created.` };
    case 'updated':
      return { tone: 'success', text: `${NAME[kind]} saved.` };
    case 'deleted':
      return { tone: 'success', text: `${NAME[kind]} deleted.` };
    case 'in-use':
      return { tone: 'error', text: IN_USE[kind] ?? `This ${kind} is still in use.` };
    case 'failed':
      return { tone: 'error', text: `The ${kind} could not be deleted. Try again.` };
    default:
      return null;
  }
}
```


### `src/components/newsroom/ui.module.css`

```css
/* Shared Newsroom pieces: page header, notices, status badges, tables, empty states, dialogs. */

.header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-5);
}

.headerText {
  margin-right: auto;
  min-width: 0;
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: var(--space-2);
  font: 500 14px/20px var(--font-sans);
  color: var(--ink-secondary);
  text-decoration: none;
}

.back:hover {
  color: var(--ink);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.title {
  font: 500 30px/36px var(--font-serif);
  font-variation-settings: 'opsz' 48;
  overflow-wrap: anywhere;
}

.description {
  margin-top: var(--space-1);
  font: 400 15px/22px var(--font-sans);
  color: var(--ink-secondary);
  max-width: 640px;
}

.notice {
  display: flex;
  gap: var(--space-2);
  align-items: flex-start;
  padding: var(--space-3) var(--space-4);
  margin-bottom: var(--space-4);
  border-radius: var(--radius-sm);
  font: 500 14px/20px var(--font-sans);
}

.notice svg {
  flex: none;
  margin-top: 1px;
}

.notice-success {
  background: var(--success-soft);
  color: var(--success);
}

.notice-error {
  background: var(--danger-soft);
  color: var(--danger);
}

.notice-info {
  background: var(--meridian-soft);
  color: var(--meridian);
}

.noticeBody {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.noticeBody ul {
  margin: 0;
  padding-left: 18px;
  font-weight: 400;
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px 3px 6px;
  border-radius: var(--radius-sm);
  font: 500 13px/18px var(--font-sans);
  white-space: nowrap;
}

.st-draft {
  background: var(--paper-sunken);
  color: var(--ink-secondary);
}

.st-review {
  background: var(--warning-soft);
  color: var(--warning);
}

.st-scheduled {
  background: var(--meridian-soft);
  color: var(--meridian);
}

.st-published {
  background: var(--success-soft);
  color: var(--success);
}

.st-archived {
  color: var(--ink-muted);
  box-shadow: inset 0 0 0 1px var(--line);
}

.tableWrap {
  position: relative;
  background: var(--paper-raised);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  overflow-x: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font: 400 14px/20px var(--font-sans);
  color: var(--ink-secondary);
}

.table th {
  text-align: left;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line);
  font: 600 12px/16px var(--font-sans);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-muted);
  white-space: nowrap;
}

.table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--line);
  vertical-align: middle;
  white-space: nowrap;
}

.table tbody tr:last-child td {
  border-bottom: 0;
}

.table tbody tr:hover td {
  background: var(--paper);
}

.cellTitle {
  white-space: normal !important;
  min-width: 260px;
}

.cellTitle a {
  font: 500 15px/22px var(--font-sans);
  color: var(--ink);
  text-decoration: none;
}

.cellTitle a:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.untitled {
  font-style: italic;
  color: var(--ink-muted) !important;
}

.slug {
  display: block;
  font: 400 12px/18px var(--font-mono);
  color: var(--ink-muted);
  overflow-wrap: anywhere;
}

.mono {
  font: 400 13px/20px var(--font-mono);
  color: var(--ink-muted);
}

.num {
  text-align: right !important;
  font: 400 13px/20px var(--font-mono);
}

.cellActions {
  text-align: right;
  width: 1%;
}

.rowActions {
  display: inline-flex;
  gap: 4px;
  justify-content: flex-end;
}

.tableFoot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 16px;
  border-top: 1px solid var(--line);
  font: 400 13px/20px var(--font-mono);
  color: var(--ink-muted);
}

.empty {
  padding: var(--space-7) var(--space-5);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  color: var(--ink-secondary);
}

.empty svg {
  color: var(--ink-muted);
}

.emptyTitle {
  font: 600 16px/24px var(--font-sans);
  color: var(--ink);
}

.dialog {
  width: min(440px, calc(100vw - 32px));
  padding: var(--space-5);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--paper-raised);
  color: var(--ink);
  box-shadow: var(--shadow-lg, 0 12px 32px rgb(0 0 0 / 0.18));
}

.dialog::backdrop {
  background: rgb(11 21 36 / 0.45);
}

.dialogTitle {
  font: 600 18px/26px var(--font-sans);
}

.dialogBody {
  margin-top: var(--space-2);
  font: 400 15px/22px var(--font-sans);
  color: var(--ink-secondary);
}

.dialogActions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-5);
  flex-wrap: wrap;
}

.dangerButton {
  background: var(--danger) !important;
  border-color: var(--danger) !important;
  color: var(--on-navy) !important;
}

.srOnly {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```


### `src/components/newsroom/ui.tsx`

```tsx
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ds/Icon';
import styles from './ui.module.css';

export function PageHeader({
  title,
  description,
  back,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <header className={styles.header}>
      <div className={styles.headerText}>
        {back && (
          <Link href={back.href} className={styles.back}>
            <Icon name="arrow-left" size={16} />
            {back.label}
          </Link>
        )}
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions}
    </header>
  );
}

const NOTICE_ICON: Record<'success' | 'error' | 'info', IconName> = { success: 'check', error: 'alert', info: 'info' };

/** Success and info notices are polite status messages; errors are alerts. */
export function Notice({ tone = 'info', children }: { tone?: 'success' | 'error' | 'info'; children: ReactNode }) {
  return (
    <div className={`${styles.notice} ${styles[`notice-${tone}`]}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon name={NOTICE_ICON[tone]} size={18} />
      <div className={styles.noticeBody}>{children}</div>
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  return (
    <div className={styles.empty}>
      <Icon name={icon} size={28} />
      <p className={styles.emptyTitle}>{title}</p>
      {children}
    </div>
  );
}

export { styles as ui };
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

// Rebuilds an editor document from scratch, keeping only the nodes, marks and attributes in
// schema.ts. Blocks that are not allowed where they appear become paragraphs, so text is not lost;
// empty or invalid special blocks are dropped. Runs on every save, whatever the browser sent.

type Raw = Record<string, unknown>;
type Context = 'doc' | 'quote' | 'item' | 'cell';

const TEXT_MAX = 20_000;
const SAFE_HREF = /^(https?:\/\/|mailto:|\/(?!\/)|#)/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SPECIAL = new Set(['pullQuote', 'editorNote', 'keyFigures', 'youtube', 'readMore']);

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
  | ReadMore;

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
```


### `src/lib/doc/youtube.ts`

```ts
import { YOUTUBE_ID } from './schema';

/** The video ID from a YouTube link (watch, youtu.be, shorts, embed, live) or a bare ID; null otherwise. */
export function youtubeId(input: string): string | null {
  const value = input.trim();
  if (YOUTUBE_ID.test(value)) return value;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = url.pathname.split('/')[1] ?? null;
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else {
      const [, kind, candidate] = url.pathname.split('/');
      if (['shorts', 'embed', 'live', 'v'].includes(kind)) id = candidate ?? null;
    }
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}
```


### `src/lib/slug.ts`

```ts
// Addresses (slugs) for articles, sections, tags and authors. The database checks the same pattern.

export const SLUG_MAX = 80;
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Words the site uses for its own routes, so sections and pages cannot take them. */
export const RESERVED_SLUGS = ['page', 'author', 'tag', 'search', 'newsletter', 'newsroom', 'api', 'feed', 'sitemaps'] as const;

export function slugify(text: string, max = SLUG_MAX): string {
  const slug = text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length <= max) return slug;
  const cut = slug.slice(0, max);
  const hyphen = cut.lastIndexOf('-');
  return (hyphen > max / 2 ? cut.slice(0, hyphen) : cut).replace(/-+$/, '');
}

export function isSlug(value: string): boolean {
  return value.length <= SLUG_MAX && SLUG_PATTERN.test(value);
}
```


### `src/lib/time.ts`

```ts
// PressCompass shows and takes times in Western Indonesia Time (WIB, Asia/Jakarta, UTC+7, no daylight saving).
// The database stores UTC.

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Reads the value of an `<input type="datetime-local">` as WIB. Returns null when it is not a real date-time. */
export function parseWibInput(value: string): Date | null {
  const match = INPUT_PATTERN.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  if (hour > 23 || minute > 59) return null;
  const utc = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(utc);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return new Date(utc - WIB_OFFSET_MS);
}

/** The value for an `<input type="datetime-local">` showing this moment in WIB. */
export function toWibInput(date: Date): string {
  return new Date(date.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 16);
}

type Style = 'datetime' | 'date' | 'time' | 'short';

/** `13 Nov 2026, 21:40` (datetime), `13 Nov 2026` (date), `21:40` (time) or `13 Nov · 21:40` (short), in WIB. */
export function formatWib(value: Date | string, style: Style = 'datetime'): string {
  const wib = new Date(new Date(value).getTime() + WIB_OFFSET_MS);
  const day = wib.getUTCDate();
  const month = MONTHS[wib.getUTCMonth()];
  const year = wib.getUTCFullYear();
  const time = `${String(wib.getUTCHours()).padStart(2, '0')}:${String(wib.getUTCMinutes()).padStart(2, '0')}`;
  if (style === 'date') return `${day} ${month} ${year}`;
  if (style === 'time') return time;
  if (style === 'short') return `${day} ${month} · ${time}`;
  return `${day} ${month} ${year}, ${time}`;
}

/** Midnight WIB of the day `now` falls on, as a UTC instant. */
export function wibDayStart(now: Date): Date {
  const wib = new Date(now.getTime() + WIB_OFFSET_MS);
  return new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()) - WIB_OFFSET_MS);
}
```


### `src/modules/content/ArticleBody.tsx`

```tsx
import type { ReactNode } from 'react';
import type { Block, Doc, Inline, ListItem, Mark, TableRow } from '@/lib/doc/schema';
import styles from './article.module.css';
import { YouTubeEmbed } from './YouTubeEmbed';

// Renders a sanitized editor document as React elements (no raw HTML). Used by the Newsroom preview
// now and by the public article page later. Read more cards resolve through `links`; a card whose
// article no longer exists is left out.

export type ArticleLinks = Map<string, { title: string; href: string }>;

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

function blocks(content: (Block | ListItem)[], links: ArticleLinks | undefined): ReactNode[] {
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

export function ArticleBody({ doc, links }: { doc: Doc; links?: ArticleLinks }) {
  return <div className={styles.body}>{blocks(doc.content, links)}</div>;
}
```


### `src/modules/content/YouTubeEmbed.tsx`

```tsx
'use client';

import { useState } from 'react';
import styles from './article.module.css';

/** Loads the YouTube player only after a click, so no request reaches YouTube until the reader asks. */
export function YouTubeEmbed({ videoId, title }: { videoId: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  const label = title || 'YouTube video';
  return (
    <figure className={styles.video}>
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
          title={label}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button type="button" className={styles.videoButton} onClick={() => setPlaying(true)}>
          <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
            <circle cx="28" cy="28" r="27" fill="currentColor" opacity="0.92" />
            <path d="M23 18l15 10-15 10z" fill="var(--paper)" />
          </svg>
          <span>Play video: {label}</span>
          <small>Plays from YouTube</small>
        </button>
      )}
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
```


### `src/modules/editor/actions.ts`

```ts
'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { UUID } from '@/lib/doc/schema';
import { sanitizeDoc } from '@/lib/doc/sanitize';
import { docText, readingMinutes, wordCount } from '@/lib/doc/text';
import { createSessionClient } from '@/lib/supabase/clients';
import { formatWib } from '@/lib/time';
import { requireStaff } from '@/modules/auth/staff';
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

  const plan = prepareSave({ input, current: current as { status: ArticleStatus; published_at: string | null; scheduled_at: string | null }, intent, now: new Date() });
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
      supabase.from('articles').select('id,title,slug,section_id,standfirst,word_count,status').in('id', ids),
      supabase.from('article_authors').select('article_id,author_id').in('article_id', ids),
    ]);
    ready = [];
    for (const row of (rows ?? []) as { id: string; title: string; slug: string; section_id: string | null; standfirst: string; word_count: number }[]) {
      const found = publishProblems({
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
  redirect(`/newsroom/articles/${articleId}?notice=restored`);
}

/** Articles for the Related and Read more pickers. */
export async function findArticles(query: string, excludeId: string): Promise<Pick<ArticleListRow, 'id' | 'title' | 'status' | 'section'>[]> {
  await requireStaff();
  const { rows } = await listArticles({ q: query.slice(0, 100), limit: 8 });
  return rows.filter((row) => row.id !== excludeId).map(({ id, title, status, section }) => ({ id, title, status, section }));
}
```


### `src/modules/editor/input.ts`

```ts
import { UUID } from '@/lib/doc/schema';
import { isSlug } from '@/lib/slug';

// Checks what the editor in the browser sends before anything is saved. Shape problems (wrong
// types, unknown ids) reject the request; content problems come back as messages per field.

export const ARTICLE_TYPES = ['news', 'analysis', 'explainer', 'opinion', 'feature'] as const;
export type ArticleType = (typeof ARTICLE_TYPES)[number];

export const TYPE_LABELS: Record<ArticleType, string> = {
  news: 'News',
  analysis: 'Analysis',
  explainer: 'Explainer',
  opinion: 'Opinion',
  feature: 'Feature',
};

export const MAX = { title: 200, kicker: 40, standfirst: 400, authors: 10, tags: 30, related: 6, sources: 30 } as const;

export type Source = { title: string; url: string; publisher: string; accessed: string };

export type ArticleInput = {
  id: string;
  version: number;
  title: string;
  slug: string;
  slugAuto: boolean;
  sectionId: string | null;
  type: ArticleType;
  kicker: string;
  standfirst: string;
  body: unknown;
  isBreaking: boolean;
  authorIds: string[];
  tagIds: string[];
  relatedIds: string[];
  sources: Source[];
  scheduledAt: string | null;
  majorUpdate: boolean;
};

export type InputField = 'title' | 'slug' | 'kicker' | 'standfirst' | 'sources';
export type FieldErrors = Partial<Record<string, string>>;

export type ParseResult = { ok: true; value: ArticleInput; errors: FieldErrors } | { ok: false; error: string };

const UNEXPECTED = 'The editor sent something unexpected. Reload the page and try again.';
const HTTP = /^https?:\/\/\S+$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isIdList = (value: unknown, max: number): value is string[] =>
  Array.isArray(value) && value.length <= max && value.every((id) => typeof id === 'string' && UUID.test(id)) && new Set(value).size === value.length;

export function parseArticleInput(raw: unknown): ParseResult {
  if (!isObject(raw)) return { ok: false, error: UNEXPECTED };
  const r = raw;
  const strings = ['title', 'slug', 'kicker', 'standfirst'] as const;
  if (
    typeof r.id !== 'string' ||
    !UUID.test(r.id) ||
    !Number.isInteger(r.version) ||
    (r.version as number) < 1 ||
    strings.some((key) => typeof r[key] !== 'string') ||
    typeof r.slugAuto !== 'boolean' ||
    typeof r.isBreaking !== 'boolean' ||
    typeof r.majorUpdate !== 'boolean' ||
    !(r.sectionId === null || (typeof r.sectionId === 'string' && UUID.test(r.sectionId))) ||
    !ARTICLE_TYPES.includes(r.type as ArticleType) ||
    !isIdList(r.authorIds, MAX.authors) ||
    !isIdList(r.tagIds, MAX.tags) ||
    !isIdList(r.relatedIds, MAX.related) ||
    !Array.isArray(r.sources) ||
    r.sources.length > MAX.sources ||
    !r.sources.every(isObject) ||
    !(r.scheduledAt === null || typeof r.scheduledAt === 'string')
  ) {
    return { ok: false, error: UNEXPECTED };
  }

  const errors: FieldErrors = {};
  const title = (r.title as string).trim();
  const slug = (r.slug as string).trim();
  const kicker = (r.kicker as string).trim();
  const standfirst = (r.standfirst as string).trim();
  if (title.length > MAX.title) errors.title = `Keep the headline under ${MAX.title} characters.`;
  if (!isSlug(slug)) errors.slug = 'Use lowercase letters, numbers and single hyphens.';
  if (kicker.length > MAX.kicker) errors.kicker = `Keep the label under ${MAX.kicker} characters.`;
  if (standfirst.length > MAX.standfirst) errors.standfirst = `Keep the standfirst under ${MAX.standfirst} characters.`;

  const sources: Source[] = [];
  let badSource = false;
  for (const item of r.sources as Record<string, unknown>[]) {
    const source = {
      title: typeof item.title === 'string' ? item.title.trim().slice(0, 200) : '',
      url: typeof item.url === 'string' ? item.url.trim().slice(0, 2000) : '',
      publisher: typeof item.publisher === 'string' ? item.publisher.trim().slice(0, 120) : '',
      accessed: typeof item.accessed === 'string' ? item.accessed.trim() : '',
    };
    if (!source.title && !source.url && !source.publisher && !source.accessed) continue;
    if (!source.title || !HTTP.test(source.url) || (source.accessed && !DATE.test(source.accessed))) badSource = true;
    sources.push(source);
  }
  if (badSource) errors.sources = 'Each source needs a title and a link that starts with https:// or http://. Dates use YYYY-MM-DD.';

  return {
    ok: true,
    errors,
    value: {
      id: (r.id as string).toLowerCase(),
      version: r.version as number,
      title,
      slug,
      slugAuto: r.slugAuto as boolean,
      sectionId: (r.sectionId as string | null)?.toLowerCase() ?? null,
      type: r.type as ArticleType,
      kicker,
      standfirst,
      body: r.body,
      isBreaking: r.isBreaking as boolean,
      authorIds: (r.authorIds as string[]).map((id) => id.toLowerCase()),
      tagIds: (r.tagIds as string[]).map((id) => id.toLowerCase()),
      relatedIds: (r.relatedIds as string[]).map((id) => id.toLowerCase()),
      sources,
      scheduledAt: r.scheduledAt as string | null,
      majorUpdate: r.majorUpdate as boolean,
    },
  };
}
```


### `src/modules/editor/queries.ts`

```ts
import 'server-only';
import type { Doc } from '@/lib/doc/schema';
import { createSessionClient } from '@/lib/supabase/clients';
import type { ArticleType, Source } from './input';
import type { ArticleStatus } from './status';

// Reads for the Articles list, the editor, history and preview (Newsroom session, RLS applies).

export const PAGE_SIZE = 25;

export type ArticleListRow = {
  id: string;
  title: string;
  slug: string;
  status: ArticleStatus;
  type: ArticleType;
  is_breaking: boolean;
  word_count: number;
  updated_at: string;
  published_at: string | null;
  scheduled_at: string | null;
  section: { id: string; name: string; slug: string } | null;
  authors: string[];
};

export type ArticleFilter = { status?: ArticleStatus; q?: string; section?: string; author?: string; page?: number; limit?: number };

export type EditableArticle = {
  id: string;
  version: number;
  title: string;
  slug: string;
  section_id: string | null;
  type: ArticleType;
  kicker_label: string;
  standfirst: string;
  body: Doc;
  status: ArticleStatus;
  published_at: string | null;
  scheduled_at: string | null;
  major_update_at: string | null;
  is_breaking: boolean;
  sources: Source[];
  word_count: number;
  updated_at: string;
  authorIds: string[];
  tagIds: string[];
  related: { id: string; title: string; status: ArticleStatus }[];
};

export type Revision = { id: number; note: string; created_at: string };
export type RevisionSnapshot = Revision & {
  snapshot: Partial<Omit<EditableArticle, 'related' | 'authorIds' | 'tagIds'>> & { authors?: string[]; tags?: string[]; related?: string[] };
};

function check<T>({ data, error }: { data: unknown; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

export async function listArticles(filter: ArticleFilter = {}): Promise<{ total: number; rows: ArticleListRow[] }> {
  const supabase = await createSessionClient();
  const limit = filter.limit ?? PAGE_SIZE;
  return check(
    await supabase.rpc('newsroom_articles', {
      p_status: filter.status ?? null,
      p_query: filter.q || null,
      p_section: filter.section ?? null,
      p_author: filter.author ?? null,
      p_limit: limit,
      p_offset: Math.max(0, (filter.page ?? 1) - 1) * limit,
    }),
  );
}

export async function statusCounts(): Promise<Partial<Record<ArticleStatus, number>>> {
  const supabase = await createSessionClient();
  return check(await supabase.rpc('article_status_counts'));
}

/** Publishes scheduled articles whose time has passed. Never blocks a page: failures are logged. */
export async function publishDue(): Promise<number> {
  try {
    const supabase = await createSessionClient();
    const { data, error } = await supabase.rpc('publish_due_articles');
    if (error) throw new Error(error.message);
    return Number(data ?? 0);
  } catch (error) {
    console.error('Scheduled publishing check failed:', (error as Error).message);
    return 0;
  }
}

export async function getArticle(id: string): Promise<EditableArticle | null> {
  const supabase = await createSessionClient();
  const article = check<Omit<EditableArticle, 'authorIds' | 'tagIds' | 'related'> | null>(
    await supabase
      .from('articles')
      .select(
        'id,version,title,slug,section_id,type,kicker_label,standfirst,body,status,published_at,scheduled_at,major_update_at,is_breaking,sources,word_count,updated_at',
      )
      .eq('id', id)
      .maybeSingle(),
  );
  if (!article) return null;
  const [authors, tags, related] = await Promise.all([
    supabase.from('article_authors').select('author_id,position').eq('article_id', id).order('position'),
    supabase.from('article_tags').select('tag_id').eq('article_id', id),
    supabase.from('article_related').select('related_id,position').eq('article_id', id).order('position'),
  ]);
  const relatedIds = check<{ related_id: string }[]>(related).map((row) => row.related_id);
  let relatedArticles: { id: string; title: string; status: ArticleStatus }[] = [];
  if (relatedIds.length) {
    const rows = check<{ id: string; title: string; status: ArticleStatus }[]>(
      await supabase.from('articles').select('id,title,status').in('id', relatedIds),
    );
    relatedArticles = relatedIds.map((rid) => rows.find((row) => row.id === rid)).filter((row) => row !== undefined);
  }
  return {
    ...article,
    authorIds: check<{ author_id: string }[]>(authors).map((row) => row.author_id),
    tagIds: check<{ tag_id: string }[]>(tags).map((row) => row.tag_id),
    related: relatedArticles,
  };
}

export async function listRevisions(articleId: string): Promise<Revision[]> {
  const supabase = await createSessionClient();
  return check(await supabase.from('article_revisions').select('id,note,created_at').eq('article_id', articleId).order('id', { ascending: false }));
}

export async function getRevision(articleId: string, revisionId: number): Promise<RevisionSnapshot | null> {
  const supabase = await createSessionClient();
  return check(
    await supabase.from('article_revisions').select('id,note,created_at,snapshot').eq('article_id', articleId).eq('id', revisionId).maybeSingle(),
  );
}

export type Dashboard = {
  published_today: number;
  review: number;
  scheduled: number;
  drafts: number;
  next_scheduled_at: string | null;
};

export async function getDashboard(dayStart: Date): Promise<Dashboard> {
  const supabase = await createSessionClient();
  return check(await supabase.rpc('newsroom_dashboard', { p_day_start: dayStart.toISOString() }));
}

/** Titles and addresses of articles linked from a body (Read more cards) or chosen as related. */
export async function articleLinks(ids: string[]): Promise<Map<string, { title: string; href: string; status: ArticleStatus }>> {
  const links = new Map<string, { title: string; href: string; status: ArticleStatus }>();
  if (!ids.length) return links;
  const supabase = await createSessionClient();
  const rows = check<{ id: string; title: string; slug: string; status: ArticleStatus; section_id: string | null }[]>(
    await supabase.from('articles').select('id,title,slug,status,section_id').in('id', ids),
  );
  const sectionIds = [...new Set(rows.map((row) => row.section_id).filter((id) => id !== null))];
  const sections = sectionIds.length
    ? check<{ id: string; slug: string }[]>(await supabase.from('sections').select('id,slug').in('id', sectionIds))
    : [];
  for (const row of rows) {
    const section = sections.find((s) => s.id === row.section_id);
    links.set(row.id, { title: row.title || 'Untitled', href: section ? `/${section.slug}/${row.slug}` : `/${row.slug}`, status: row.status });
  }
  return links;
}
```


### `src/modules/editor/rules.ts`

```ts
// What an article needs before readers can see it (Publish, Schedule, Update). Anything else the
// SEO panel checks later is a warning, not a block. The lead image rule arrives with the media library.

export const MIN_WORDS = 150;
export const UNTITLED_SLUG = /^untitled-[0-9a-f]{8}$/;

export type PublishCheck = {
  title: string;
  slug: string;
  sectionId: string | null;
  authorIds: string[];
  standfirst: string;
  wordCount: number;
};

export type PublishField = 'title' | 'slug' | 'sectionId' | 'authorIds' | 'standfirst' | 'body';

export function publishProblems(article: PublishCheck): Partial<Record<PublishField, string>> {
  const problems: Partial<Record<PublishField, string>> = {};
  if (!article.title.trim()) problems.title = 'Add a headline before publishing.';
  if (!article.slug || UNTITLED_SLUG.test(article.slug)) problems.slug = 'Set the address before publishing. It fills in from the headline.';
  if (!article.sectionId) problems.sectionId = 'Choose a section.';
  if (!article.authorIds.length) problems.authorIds = 'Add at least one author.';
  if (!article.standfirst.trim()) problems.standfirst = 'Add a standfirst: one or two sentences under the headline.';
  if (article.wordCount < MIN_WORDS) problems.body = `The article needs at least ${MIN_WORDS} words. It has ${article.wordCount}.`;
  return problems;
}
```


### `src/modules/editor/save.ts`

```ts
import { sanitizeDoc } from '@/lib/doc/sanitize';
import { docText, readingMinutes, wordCount } from '@/lib/doc/text';
import { parseWibInput } from '@/lib/time';
import type { ArticleInput, FieldErrors } from './input';
import { publishProblems } from './rules';
import { type Intent, type Timing, transition } from './status';

// Turns a checked editor input and the article's current status into exactly what save_article
// stores: the fields, the relations and the revision note. Pure, so the whole decision is tested.

export type SavePlan =
  | {
      ok: true;
      fields: Record<string, unknown>;
      authors: string[];
      tags: string[];
      related: string[];
      revision: string;
      throttle: boolean;
    }
  | { ok: false; errors: FieldErrors };

export function prepareSave({
  input,
  current,
  intent,
  now,
}: {
  input: { value: ArticleInput; errors: FieldErrors };
  current: Timing;
  intent: Intent;
  now: Date;
}): SavePlan {
  if (Object.keys(input.errors).length) return { ok: false, errors: input.errors };
  const article = input.value;

  let scheduledAt: Date | null = null;
  if (article.scheduledAt) {
    scheduledAt = parseWibInput(article.scheduledAt);
    if (!scheduledAt) return { ok: false, errors: { scheduledAt: 'Enter a valid date and time.' } };
  }

  const step = transition(current, intent, { now, scheduledAt, majorUpdate: article.majorUpdate });
  if (!step.ok) return { ok: false, errors: { [step.field ?? 'status']: step.error } };

  const body = sanitizeDoc(article.body);
  const text = docText(body);
  const words = wordCount(text);

  if (step.needsRules) {
    const problems = publishProblems({
      title: article.title,
      slug: article.slug,
      sectionId: article.sectionId,
      authorIds: article.authorIds,
      standfirst: article.standfirst,
      wordCount: words,
    });
    if (Object.keys(problems).length) return { ok: false, errors: problems };
  }

  const fields: Record<string, unknown> = {
    title: article.title,
    slug: article.slug,
    slug_auto: article.slugAuto,
    section_id: article.sectionId,
    type: article.type,
    kicker_label: article.kicker,
    standfirst: article.standfirst,
    body,
    body_text: text,
    word_count: words,
    reading_minutes: readingMinutes(words),
    is_breaking: article.isBreaking,
    sources: article.sources,
    status: step.status,
    published_at: step.published_at,
    scheduled_at: step.scheduled_at,
  };
  if (step.major_update_at) fields.major_update_at = step.major_update_at;

  return {
    ok: true,
    fields,
    authors: article.authorIds,
    tags: article.tagIds,
    related: article.relatedIds.filter((id) => id !== article.id),
    revision: step.note,
    throttle: step.throttle,
  };
}
```


### `src/modules/editor/status.ts`

```ts
import { formatWib } from '@/lib/time';

// The article status flow: draft → review → published or scheduled → archived.
// Each status offers one next step (the primary button) and a few secondary actions.

export const STATUSES = ['draft', 'review', 'scheduled', 'published', 'archived'] as const;
export type ArticleStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<ArticleStatus, string> = {
  draft: 'Draft',
  review: 'In review',
  scheduled: 'Scheduled',
  published: 'Published',
  archived: 'Archived',
};

export type Intent =
  | 'autosave'
  | 'save'
  | 'review'
  | 'draft'
  | 'publish'
  | 'schedule'
  | 'update'
  | 'unschedule'
  | 'unpublish'
  | 'archive'
  | 'restore';

const ACTIONS: Record<ArticleStatus, { primary: Intent; others: Intent[] }> = {
  draft: { primary: 'review', others: ['save', 'publish', 'schedule', 'archive'] },
  review: { primary: 'publish', others: ['save', 'schedule', 'draft', 'archive'] },
  scheduled: { primary: 'update', others: ['publish', 'unschedule', 'archive'] },
  published: { primary: 'update', others: ['unpublish', 'archive'] },
  archived: { primary: 'restore', others: [] },
};

export function statusActions(status: ArticleStatus): { primary: Intent; others: Intent[] } {
  return { primary: ACTIONS[status].primary, others: [...ACTIONS[status].others] };
}

export function canAutosave(status: ArticleStatus): boolean {
  return status === 'draft' || status === 'review';
}

export function intentLabel(intent: Intent, status: ArticleStatus): string {
  switch (intent) {
    case 'autosave':
    case 'save':
      return 'Save draft';
    case 'review':
      return 'Send for review';
    case 'draft':
      return 'Back to draft';
    case 'publish':
      return status === 'review' ? 'Publish' : 'Publish now';
    case 'schedule':
      return 'Schedule';
    case 'update':
      return status === 'scheduled' ? 'Save changes' : 'Update';
    case 'unschedule':
      return 'Cancel schedule';
    case 'unpublish':
      return 'Unpublish';
    case 'archive':
      return 'Archive';
    case 'restore':
      return 'Restore to draft';
  }
}

/** Actions that take an article off the site or out of the flow ask for confirmation first. */
export const CONFIRMATIONS: Partial<Record<Intent, { title: string; body: string; confirm: string }>> = {
  unpublish: {
    title: 'Unpublish this article?',
    body: 'Readers will no longer see it. It goes back to Draft and keeps its history.',
    confirm: 'Unpublish',
  },
  archive: {
    title: 'Archive this article?',
    body: 'Archived articles are hidden from readers and read-only. You can restore it to Draft later.',
    confirm: 'Archive',
  },
};

export type Timing = { status: ArticleStatus; published_at: string | null; scheduled_at: string | null };

export type TransitionResult =
  | {
      ok: true;
      status: ArticleStatus;
      published_at: string | null;
      scheduled_at: string | null;
      major_update_at?: string;
      note: string;
      throttle: boolean;
      needsRules: boolean;
    }
  | { ok: false; error: string; field?: 'scheduledAt' };

const ARTICLE_NOUN: Record<ArticleStatus, string> = {
  draft: 'a draft',
  review: 'an article in review',
  scheduled: 'a scheduled article',
  published: 'a published article',
  archived: 'an archived article',
};

function scheduleProblem(at: Date | null | undefined, now: Date): string | null {
  if (!at) return 'Choose a date and time to publish.';
  if (at.getTime() < now.getTime() + 60_000) return 'Choose a time at least a minute from now.';
  return null;
}

export function transition(
  current: Timing,
  intent: Intent,
  options: { now: Date; scheduledAt?: Date | null; majorUpdate?: boolean },
): TransitionResult {
  const { now } = options;
  const allowed = intent === 'autosave' ? canAutosave(current.status) : intent === statusActions(current.status).primary || statusActions(current.status).others.includes(intent);
  if (!allowed) return { ok: false, error: `This action is not available for ${ARTICLE_NOUN[current.status]}.` };

  const same = { status: current.status, published_at: current.published_at, scheduled_at: current.scheduled_at };
  const done = (changes: Partial<typeof same>, note: string, extra: { throttle?: boolean; needsRules?: boolean } = {}): TransitionResult => ({
    ok: true,
    ...same,
    ...changes,
    note,
    throttle: extra.throttle ?? false,
    needsRules: extra.needsRules ?? false,
  });

  switch (intent) {
    case 'autosave':
      return done({}, 'Autosaved', { throttle: true });
    case 'save':
      return done({}, 'Saved draft');
    case 'review':
      return done({ status: 'review' }, 'Sent for review');
    case 'draft':
      return done({ status: 'draft' }, 'Moved back to draft');
    case 'publish':
      return done({ status: 'published', published_at: current.published_at ?? now.toISOString(), scheduled_at: null }, 'Published', { needsRules: true });
    case 'schedule': {
      const problem = scheduleProblem(options.scheduledAt, now);
      if (problem) return { ok: false, field: 'scheduledAt', error: problem };
      const at = options.scheduledAt as Date;
      return done({ status: 'scheduled', scheduled_at: at.toISOString() }, `Scheduled for ${formatWib(at)} WIB`, { needsRules: true });
    }
    case 'update': {
      if (current.status === 'scheduled') {
        if (!options.scheduledAt) return done({}, 'Saved changes', { needsRules: true });
        const problem = scheduleProblem(options.scheduledAt, now);
        if (problem) return { ok: false, field: 'scheduledAt', error: problem };
        const at = options.scheduledAt.toISOString();
        return done({ scheduled_at: at }, at === current.scheduled_at ? 'Saved changes' : `Rescheduled for ${formatWib(at)} WIB`, { needsRules: true });
      }
      if (options.majorUpdate) {
        const result = done({}, 'Major update', { needsRules: true });
        return result.ok ? { ...result, major_update_at: now.toISOString() } : result;
      }
      return done({}, 'Updated', { needsRules: true });
    }
    case 'unschedule':
      return done({ status: 'draft', scheduled_at: null }, 'Schedule cancelled');
    case 'unpublish':
      return done({ status: 'draft' }, 'Unpublished');
    case 'archive':
      return done({ status: 'archived', scheduled_at: null }, 'Archived');
    case 'restore':
      return done({ status: 'draft' }, 'Restored to draft');
  }
}
```


### `src/modules/taxonomy/actions.ts`

```ts
'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { UUID } from '@/lib/doc/schema';
import { createSessionClient } from '@/lib/supabase/clients';
import { requireStaff } from '@/modules/auth/staff';
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
  return store('author', idFrom(form), values, values);
}

async function remove(kind: Kind, form: FormData) {
  await requireStaff();
  const id = idFrom(form);
  if (!id) redirect(LIST[kind]);
  const supabase = await createSessionClient();
  const { error } = await supabase.from(TABLE[kind]).delete().eq('id', id);
  if (error) redirect(`${LIST[kind]}/${id}?notice=${error.code === '23503' ? 'in-use' : 'failed'}`);
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
  refresh();
}
```


### `src/modules/taxonomy/queries.ts`

```ts
import 'server-only';
import { createSessionClient } from '@/lib/supabase/clients';
import type { AuthorLink } from './validate';

// Reads for the Sections, Tags and Authors pages and the article editor's pickers (Newsroom session).

export type Section = { id: string; name: string; slug: string; description: string; position: number; in_nav: boolean };
export type Tag = { id: string; name: string; slug: string; description: string };
export type Author = { id: string; name: string; slug: string; role: string; bio: string; links: AuthorLink[] };
export type Usage = { sections: Record<string, number>; tags: Record<string, number>; authors: Record<string, number> };

async function rows<T>(query: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as T;
}

export async function listSections(): Promise<Section[]> {
  const supabase = await createSessionClient();
  return rows(supabase.from('sections').select('id,name,slug,description,position,in_nav').order('position').order('name'));
}

export async function getSection(id: string): Promise<Section | null> {
  const supabase = await createSessionClient();
  return rows(supabase.from('sections').select('id,name,slug,description,position,in_nav').eq('id', id).maybeSingle());
}

export async function listTags(): Promise<Tag[]> {
  const supabase = await createSessionClient();
  return rows(supabase.from('tags').select('id,name,slug,description').order('name'));
}

export async function getTag(id: string): Promise<Tag | null> {
  const supabase = await createSessionClient();
  return rows(supabase.from('tags').select('id,name,slug,description').eq('id', id).maybeSingle());
}

export async function listAuthors(): Promise<Author[]> {
  const supabase = await createSessionClient();
  return rows(supabase.from('authors').select('id,name,slug,role,bio,links').order('name'));
}

export async function getAuthor(id: string): Promise<Author | null> {
  const supabase = await createSessionClient();
  return rows(supabase.from('authors').select('id,name,slug,role,bio,links').eq('id', id).maybeSingle());
}

/** How many articles (any status) use each section, tag and author. */
export async function getUsage(): Promise<Usage> {
  const supabase = await createSessionClient();
  return rows(supabase.rpc('newsroom_usage'));
}
```


### `src/modules/taxonomy/validate.ts`

```ts
import { isSlug, RESERVED_SLUGS, slugify } from '@/lib/slug';

// Checks the Section, Tag and Author forms. Empty addresses are filled in from the name.

export type Errors = Partial<Record<string, string>>;
export type SectionValues = { name: string; slug: string; description: string; inNav: boolean };
export type TagValues = { name: string; slug: string; description: string };
export type AuthorLink = { label: string; url: string };
export type AuthorValues = { name: string; slug: string; role: string; bio: string; links: AuthorLink[] };

export const AUTHOR_LINK_ROWS = 4;
const HTTP = /^https?:\/\/\S+$/i;

const read = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
};

function nameAndSlug(form: FormData, noun: string, maxName: number, errors: Errors) {
  const name = read(form, 'name');
  const typed = read(form, 'slug');
  const slug = (typed || slugify(name)).toLowerCase();
  if (!name) errors.name = `Give the ${noun} a name.`;
  else if (name.length > maxName) errors.name = `Keep the name under ${maxName} characters.`;
  if ((name || typed) && !isSlug(slug)) errors.slug = 'Use lowercase letters, numbers and single hyphens.';
  return { name, slug };
}

function limit(value: string, max: number, field: string, label: string, errors: Errors) {
  if (value.length > max) errors[field] = `Keep the ${label} under ${max} characters.`;
  return value;
}

export function parseSection(form: FormData): { values: SectionValues; errors: Errors } {
  const errors: Errors = {};
  const { name, slug } = nameAndSlug(form, 'section', 60, errors);
  if (!errors.slug && (RESERVED_SLUGS as readonly string[]).includes(slug)) {
    errors.slug = `The site already uses /${slug}. Choose another address.`;
  }
  const description = limit(read(form, 'description'), 300, 'description', 'description', errors);
  return { values: { name, slug, description, inNav: form.get('in_nav') === 'on' }, errors };
}

export function parseTag(form: FormData): { values: TagValues; errors: Errors } {
  const errors: Errors = {};
  const { name, slug } = nameAndSlug(form, 'tag', 60, errors);
  const description = limit(read(form, 'description'), 300, 'description', 'description', errors);
  return { values: { name, slug, description }, errors };
}

export function parseAuthor(form: FormData): { values: AuthorValues; errors: Errors } {
  const errors: Errors = {};
  const { name, slug } = nameAndSlug(form, 'author', 80, errors);
  const role = limit(read(form, 'role'), 80, 'role', 'role', errors);
  const bio = limit(read(form, 'bio'), 1000, 'bio', 'biography', errors);
  const links: AuthorLink[] = [];
  for (let i = 0; i < AUTHOR_LINK_ROWS; i++) {
    const label = read(form, `link_label_${i}`).slice(0, 40);
    const url = read(form, `link_url_${i}`).slice(0, 500);
    if (!label && !url) continue;
    if (!label || !HTTP.test(url)) errors.links = 'Each link needs a label and an address that starts with https:// or http://.';
    links.push({ label, url });
  }
  return { values: { name, slug, role, bio, links }, errors };
}
```


### `supabase/migrations/20261114000100_newsroom_core.sql`

```sql
-- PressCompass Plan 2 (Newsroom core): saving articles, the status flow, revisions and automatic redirects.
-- Every function runs with the caller's rights (security invoker), so Row Level Security still applies,
-- and refuses callers who are not Newsroom staff (or the secret key). Anonymous visitors cannot call them.

-- ---------------------------------------------------------------- access

create or replace function public.newsroom_allowed()
returns boolean
language sql
stable
set search_path = ''
as $$
  select (select public.is_staff()) or current_user = 'service_role';
$$;

-- ---------------------------------------------------------------- version for conflict checks

create or replace function public.bump_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version := old.version + 1;
  return new;
end;
$$;

create trigger articles_version before update on public.articles
  for each row execute function public.bump_version();

-- ---------------------------------------------------------------- automatic redirects

-- Adds a 308 redirect and keeps chains one hop long. When `p_to` was itself redirected away
-- (the address is coming back), that redirect is removed.
create or replace function public.add_redirect(p_from text, p_to text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_from is null or p_to is null or p_from = p_to then
    return;
  end if;
  delete from public.redirects where from_path = p_to;
  update public.redirects set to_path = p_to where to_path = p_from and code <> 410;
  insert into public.redirects (from_path, to_path, code, auto)
  values (p_from, p_to, 308, true)
  on conflict (from_path) do update set to_path = excluded.to_path, code = 308, auto = true;
end;
$$;

create or replace function public.article_path(p_section uuid, p_slug text)
returns text
language sql
stable
set search_path = ''
as $$
  select '/' || s.slug || '/' || p_slug from public.sections s where s.id = p_section;
$$;

create or replace function public.articles_redirect()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'published' and new.status = 'published' then
    perform public.add_redirect(public.article_path(old.section_id, old.slug), public.article_path(new.section_id, new.slug));
  end if;
  return null;
end;
$$;

create trigger articles_redirect after update of slug, section_id on public.articles
  for each row execute function public.articles_redirect();

create or replace function public.sections_redirect()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  a record;
begin
  if new.slug <> old.slug then
    perform public.add_redirect('/' || old.slug, '/' || new.slug);
    for a in select slug from public.articles where section_id = new.id and status = 'published' loop
      perform public.add_redirect('/' || old.slug || '/' || a.slug, '/' || new.slug || '/' || a.slug);
    end loop;
  end if;
  return null;
end;
$$;

create trigger sections_redirect after update of slug on public.sections
  for each row execute function public.sections_redirect();

create or replace function public.tags_redirect()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.slug <> old.slug and exists (
    select 1 from public.article_tags t join public.articles a on a.id = t.article_id
    where t.tag_id = new.id and a.status = 'published'
  ) then
    perform public.add_redirect('/tag/' || old.slug, '/tag/' || new.slug);
  end if;
  return null;
end;
$$;

create trigger tags_redirect after update of slug on public.tags
  for each row execute function public.tags_redirect();

create or replace function public.authors_redirect()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.slug <> old.slug and exists (
    select 1 from public.article_authors x join public.articles a on a.id = x.article_id
    where x.author_id = new.id and a.status = 'published'
  ) then
    perform public.add_redirect('/author/' || old.slug, '/author/' || new.slug);
  end if;
  return null;
end;
$$;

create trigger authors_redirect after update of slug on public.authors
  for each row execute function public.authors_redirect();

-- ---------------------------------------------------------------- revisions

create or replace function public.article_snapshot(p_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'title', a.title,
    'slug', a.slug,
    'section_id', a.section_id,
    'type', a.type,
    'kicker_label', a.kicker_label,
    'standfirst', a.standfirst,
    'body', a.body,
    'lead_media_id', a.lead_media_id,
    'lead_caption', a.lead_caption,
    'is_breaking', a.is_breaking,
    'seo', a.seo,
    'sources', a.sources,
    'status', a.status,
    'scheduled_at', a.scheduled_at,
    'published_at', a.published_at,
    'authors', coalesce((select jsonb_agg(x.author_id order by x.position) from public.article_authors x where x.article_id = a.id), '[]'::jsonb),
    'tags', coalesce((select jsonb_agg(t.tag_id) from public.article_tags t where t.article_id = a.id), '[]'::jsonb),
    'related', coalesce((select jsonb_agg(r.related_id order by r.position) from public.article_related r where r.article_id = a.id), '[]'::jsonb)
  )
  from public.articles a
  where a.id = p_id;
$$;

-- Stores the article as it is now. With `p_throttle`, skips when a revision was stored in the last 10 minutes.
create or replace function public.record_revision(p_id uuid, p_note text, p_throttle boolean default false)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  if not public.newsroom_allowed() then
    raise exception 'not_staff' using errcode = '42501';
  end if;
  if p_throttle and exists (
    select 1 from public.article_revisions where article_id = p_id and created_at > now() - interval '10 minutes'
  ) then
    return false;
  end if;
  insert into public.article_revisions (article_id, snapshot, note, created_by)
  values (p_id, public.article_snapshot(p_id), coalesce(p_note, ''), auth.uid());
  return true;
end;
$$;

create or replace function public.trim_revisions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from public.article_revisions r
  where r.article_id = new.article_id
    and r.id not in (
      select id from public.article_revisions where article_id = new.article_id order by id desc limit 50
    );
  return null;
end;
$$;

create trigger article_revisions_trim after insert on public.article_revisions
  for each row execute function public.trim_revisions();

-- ---------------------------------------------------------------- saving

create or replace function public.free_article_slug(p_base text, p_except uuid)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  n integer := 2;
  candidate text := p_base;
begin
  while exists (select 1 from public.articles where slug = candidate and id <> p_except) loop
    candidate := rtrim(left(p_base, 79 - length(n::text)), '-') || '-' || n;
    n := n + 1;
  end loop;
  return candidate;
end;
$$;

-- Saves the given fields (only the keys present in `p_fields`) and, when not null, replaces the
-- authors (in order), tags and related articles, all in one transaction. Refuses a save whose
-- `p_version` is no longer current. `slug_auto` lets a never-published article take a free suffix
-- when its automatic slug is taken. Returns the new version, slug and status.
create or replace function public.save_article(
  p_id uuid,
  p_version integer,
  p_fields jsonb,
  p_authors uuid[] default null,
  p_tags uuid[] default null,
  p_related uuid[] default null,
  p_revision text default null,
  p_throttle boolean default false
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_slug text := p_fields ->> 'slug';
  v_was_published boolean;
  v_row public.articles;
begin
  if not public.newsroom_allowed() then
    raise exception 'not_staff' using errcode = '42501';
  end if;

  select published_at is not null into v_was_published from public.articles where id = p_id;
  if not found then
    raise exception 'not_found' using errcode = 'PT404';
  end if;

  if v_slug is not null and exists (select 1 from public.articles where slug = v_slug and id <> p_id) then
    if coalesce((p_fields ->> 'slug_auto')::boolean, false) and not v_was_published then
      v_slug := public.free_article_slug(v_slug, p_id);
    else
      raise exception 'slug_taken' using errcode = '23505';
    end if;
  end if;

  update public.articles a set
    title = case when p_fields ? 'title' then p_fields ->> 'title' else a.title end,
    slug = coalesce(v_slug, a.slug),
    section_id = case when p_fields ? 'section_id' then (p_fields ->> 'section_id')::uuid else a.section_id end,
    type = case when p_fields ? 'type' then (p_fields ->> 'type')::public.article_type else a.type end,
    kicker_label = case when p_fields ? 'kicker_label' then p_fields ->> 'kicker_label' else a.kicker_label end,
    standfirst = case when p_fields ? 'standfirst' then p_fields ->> 'standfirst' else a.standfirst end,
    body = case when p_fields ? 'body' then p_fields -> 'body' else a.body end,
    body_text = case when p_fields ? 'body_text' then p_fields ->> 'body_text' else a.body_text end,
    word_count = case when p_fields ? 'word_count' then (p_fields ->> 'word_count')::integer else a.word_count end,
    reading_minutes = case when p_fields ? 'reading_minutes' then (p_fields ->> 'reading_minutes')::integer else a.reading_minutes end,
    lead_media_id = case when p_fields ? 'lead_media_id' then (p_fields ->> 'lead_media_id')::uuid else a.lead_media_id end,
    lead_caption = case when p_fields ? 'lead_caption' then p_fields ->> 'lead_caption' else a.lead_caption end,
    is_breaking = case when p_fields ? 'is_breaking' then (p_fields ->> 'is_breaking')::boolean else a.is_breaking end,
    seo = case when p_fields ? 'seo' then p_fields -> 'seo' else a.seo end,
    sources = case when p_fields ? 'sources' then p_fields -> 'sources' else a.sources end,
    status = case when p_fields ? 'status' then (p_fields ->> 'status')::public.article_status else a.status end,
    scheduled_at = case when p_fields ? 'scheduled_at' then (p_fields ->> 'scheduled_at')::timestamptz else a.scheduled_at end,
    published_at = case when p_fields ? 'published_at' then (p_fields ->> 'published_at')::timestamptz else a.published_at end,
    major_update_at = case when p_fields ? 'major_update_at' then (p_fields ->> 'major_update_at')::timestamptz else a.major_update_at end
  where a.id = p_id and a.version = p_version
  returning * into v_row;

  if not found then
    raise exception 'version_conflict' using errcode = 'PT409';
  end if;

  if p_authors is not null then
    delete from public.article_authors where article_id = p_id;
    insert into public.article_authors (article_id, author_id, position)
    select p_id, x.id, (x.n - 1)::integer from unnest(p_authors) with ordinality as x(id, n)
    on conflict do nothing;
  end if;

  if p_tags is not null then
    delete from public.article_tags where article_id = p_id;
    insert into public.article_tags (article_id, tag_id)
    select distinct p_id, x.id from unnest(p_tags) as x(id);
  end if;

  if p_related is not null then
    delete from public.article_related where article_id = p_id;
    insert into public.article_related (article_id, related_id, position)
    select p_id, x.id, (x.n - 1)::integer from unnest(p_related) with ordinality as x(id, n)
    where x.id <> p_id
    on conflict do nothing;
  end if;

  if p_revision is not null then
    perform public.record_revision(p_id, p_revision, p_throttle);
  end if;

  return jsonb_build_object(
    'version', v_row.version,
    'slug', v_row.slug,
    'status', v_row.status,
    'published_at', v_row.published_at,
    'scheduled_at', v_row.scheduled_at,
    'updated_at', v_row.updated_at
  );
end;
$$;

-- ---------------------------------------------------------------- status changes

-- Moves several articles at once (list actions). Publish rules are checked by the Newsroom first.
create or replace function public.set_article_status(p_ids uuid[], p_action text)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_note text;
  v_id uuid;
begin
  if not public.newsroom_allowed() then
    raise exception 'not_staff' using errcode = '42501';
  end if;

  if p_action = 'publish' then
    v_note := 'Published';
    with moved as (
      update public.articles set status = 'published', published_at = coalesce(published_at, now()), scheduled_at = null
      where id = any (p_ids) and status in ('draft', 'review', 'scheduled')
      returning id
    ) select array_agg(id) into v_ids from moved;
  elsif p_action = 'unpublish' then
    v_note := 'Unpublished';
    with moved as (
      update public.articles set status = 'draft' where id = any (p_ids) and status = 'published' returning id
    ) select array_agg(id) into v_ids from moved;
  elsif p_action = 'archive' then
    v_note := 'Archived';
    with moved as (
      update public.articles set status = 'archived', scheduled_at = null where id = any (p_ids) and status <> 'archived' returning id
    ) select array_agg(id) into v_ids from moved;
  elsif p_action = 'restore' then
    v_note := 'Restored to draft';
    with moved as (
      update public.articles set status = 'draft' where id = any (p_ids) and status = 'archived' returning id
    ) select array_agg(id) into v_ids from moved;
  else
    raise exception 'unknown_action' using errcode = '22023';
  end if;

  foreach v_id in array coalesce(v_ids, '{}') loop
    perform public.record_revision(v_id, v_note);
  end loop;
  return coalesce(array_length(v_ids, 1), 0);
end;
$$;

-- Publishes scheduled articles whose time has come. Called when the Newsroom opens, and by the cron
-- endpoint once the public site exists.
create or replace function public.publish_due_articles()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  n integer;
begin
  if not public.newsroom_allowed() then
    raise exception 'not_staff' using errcode = '42501';
  end if;
  update public.articles set status = 'published', published_at = scheduled_at
  where status = 'scheduled' and scheduled_at <= now();
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---------------------------------------------------------------- Newsroom reads

create or replace function public.newsroom_articles(
  p_status text default null,
  p_query text default null,
  p_section uuid default null,
  p_author uuid default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_pattern text := '%' || replace(replace(replace(coalesce(p_query, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  v_result jsonb;
begin
  if not public.newsroom_allowed() then
    raise exception 'not_staff' using errcode = '42501';
  end if;

  with filtered as (
    select a.*
    from public.articles a
    where (p_status is null or a.status::text = p_status)
      and (p_section is null or a.section_id = p_section)
      and (p_author is null or exists (select 1 from public.article_authors x where x.article_id = a.id and x.author_id = p_author))
      and (
        coalesce(p_query, '') = ''
        or a.title ilike v_pattern
        or a.slug ilike v_pattern
        or exists (
          select 1 from public.article_authors x join public.authors au on au.id = x.author_id
          where x.article_id = a.id and au.name ilike v_pattern
        )
      )
  ),
  page as (
    select * from filtered order by updated_at desc, slug limit greatest(p_limit, 0) offset greatest(p_offset, 0)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'title', p.title,
        'slug', p.slug,
        'status', p.status,
        'type', p.type,
        'is_breaking', p.is_breaking,
        'word_count', p.word_count,
        'updated_at', p.updated_at,
        'published_at', p.published_at,
        'scheduled_at', p.scheduled_at,
        'section', (select jsonb_build_object('id', s.id, 'name', s.name, 'slug', s.slug) from public.sections s where s.id = p.section_id),
        'authors', coalesce((
          select jsonb_agg(au.name order by x.position)
          from public.article_authors x join public.authors au on au.id = x.author_id
          where x.article_id = p.id
        ), '[]'::jsonb)
      ) order by p.updated_at desc, p.slug)
      from page p
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.article_status_counts()
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.newsroom_allowed() then
    raise exception 'not_staff' using errcode = '42501';
  end if;
  return coalesce((select jsonb_object_agg(status, total) from (
    select status, count(*) as total from public.articles group by status
  ) c), '{}'::jsonb);
end;
$$;

create or replace function public.newsroom_usage()
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.newsroom_allowed() then
    raise exception 'not_staff' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'sections', coalesce((select jsonb_object_agg(section_id, n) from (
      select section_id, count(*) as n from public.articles where section_id is not null group by section_id
    ) s), '{}'::jsonb),
    'tags', coalesce((select jsonb_object_agg(tag_id, n) from (
      select tag_id, count(*) as n from public.article_tags group by tag_id
    ) t), '{}'::jsonb),
    'authors', coalesce((select jsonb_object_agg(author_id, n) from (
      select author_id, count(*) as n from public.article_authors group by author_id
    ) a), '{}'::jsonb)
  );
end;
$$;

-- Counts for the Dashboard. `p_day_start` is the start of today in WIB, as UTC.
create or replace function public.newsroom_dashboard(p_day_start timestamptz)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.newsroom_allowed() then
    raise exception 'not_staff' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'published_today', (select count(*) from public.articles where status = 'published'
                          and published_at >= p_day_start and published_at < p_day_start + interval '1 day'),
    'review', (select count(*) from public.articles where status = 'review'),
    'scheduled', (select count(*) from public.articles where status = 'scheduled'),
    'drafts', (select count(*) from public.articles where status = 'draft'),
    'next_scheduled_at', (select min(scheduled_at) from public.articles where status = 'scheduled')
  );
end;
$$;

-- ---------------------------------------------------------------- who may call what

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.newsroom_allowed()',
    'public.add_redirect(text, text)',
    'public.article_snapshot(uuid)',
    'public.record_revision(uuid, text, boolean)',
    'public.free_article_slug(text, uuid)',
    'public.save_article(uuid, integer, jsonb, uuid[], uuid[], uuid[], text, boolean)',
    'public.set_article_status(uuid[], text)',
    'public.publish_due_articles()',
    'public.newsroom_articles(text, text, uuid, uuid, integer, integer)',
    'public.article_status_counts()',
    'public.newsroom_usage()',
    'public.newsroom_dashboard(timestamptz)'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;
end;
$$;
```


### `tests/db/newsroom.test.ts`

```ts
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
```


### `tests/e2e/articles.spec.ts`

```ts
import { expect, type Page, test } from '@playwright/test';
import { expectNoAxeViolations, seedArticle, seedTaxonomy, signIn, sql, unique } from './helpers';

// Locators use roles, not labels: Next keeps visited pages hidden in the DOM, and roles skip hidden elements.

const main = (page: Page) => page.getByRole('main');
const saveState = (page: Page) => main(page).locator('p[role="status"]');

async function newArticle(page: Page) {
  await page.goto('/newsroom/articles');
  await page.getByRole('button', { name: 'New article' }).click();
  await page.waitForURL(/\/newsroom\/articles\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('textbox', { name: 'Article text' })).toBeVisible();
  return page.url().split('/').pop() as string;
}

async function typeBody(page: Page, text: string) {
  await page.getByRole('textbox', { name: 'Article text' }).click();
  await page.keyboard.insertText(text);
}

test.describe('articles', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'Editor flows run on desktop; the phone layout is checked separately.');
    await signIn(page);
  });

  test('writes a draft that saves itself, explains what blocks publishing, then publishes', async ({ page }) => {
    test.setTimeout(60_000);
    const { section, author, tag } = await seedTaxonomy('Write');
    const headline = unique('Rice prices climb');
    const id = await newArticle(page);

    await page.getByRole('textbox', { name: 'Headline' }).fill(headline);
    await page.getByRole('textbox', { name: 'Standfirst' }).fill('Farmers expect a smaller harvest.');
    await page.getByRole('button', { name: 'H2 heading' }).click();
    await page.keyboard.type('What changed');
    await page.keyboard.press('Enter');
    await page.keyboard.insertText('Prices rose again this week. '.repeat(32).trim());
    await expect(saveState(page)).toHaveText('Unsaved changes');
    await expect(saveState(page)).toHaveText(/^Saved /, { timeout: 15_000 });
    await expect(main(page).getByText(/^\d+ words · 1 min read$/)).toBeVisible();

    await page.getByRole('button', { name: 'Publish now' }).click();
    const problems = main(page).getByRole('alert');
    await expect(problems).toContainText('2 things need attention');
    await expect(problems).toContainText('Choose a section.');
    await expect(problems).toContainText('Add at least one author.');

    await page.getByRole('combobox', { name: 'Section' }).selectOption({ label: section.name });
    await page.getByRole('combobox', { name: 'Add an author' }).selectOption({ label: author.name });
    await page.getByRole('combobox', { name: 'Add a tag' }).selectOption({ label: tag.name });
    await page.getByRole('button', { name: 'Publish now' }).click();
    await expect(main(page).getByRole('status').filter({ hasText: 'Published.' })).toBeVisible();
    await expect(main(page).getByText(/^First published /)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Update', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Address' })).toHaveValue(headline.toLowerCase().replace(/ /g, '-'));

    const [row] = await sql<{ status: string; word_count: number; tags: number; heading: number }>(
      `select status, word_count,
              (select count(*)::int from public.article_tags where article_id = a.id) as tags,
              (body -> 'content' -> 0 -> 'attrs' ->> 'level')::int as heading
         from public.articles a where id = $1`,
      [id],
    );
    expect(row).toMatchObject({ status: 'published', tags: 1, heading: 2 });
    expect(row.word_count).toBeGreaterThanOrEqual(150);

    await page.goto(`/newsroom/preview/${id}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(headline);
    await expect(page.getByRole('heading', { level: 2, name: 'What changed' })).toBeVisible();
    await expect(page.getByText(`By ${author.name}`)).toBeVisible();
    await expect(page.getByText('Readers see this version.')).toBeVisible();

    await page.goto(`/newsroom/articles/${id}/history`);
    await expect(page.getByRole('cell', { name: /^Published/ })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Autosaved' })).toBeVisible();
  });

  test('adds the special blocks and shows them in the preview', async ({ page }) => {
    const { section, author } = await seedTaxonomy('Blocks');
    const target = await seedArticle({ title: unique('Earlier story'), sectionId: section.id, authorId: author.id, ready: true, status: 'published' });
    const [{ title: targetTitle }] = await sql<{ title: string }>(`select title from public.articles where id = $1`, [target]);
    const id = await newArticle(page);
    await page.getByRole('textbox', { name: 'Headline' }).fill(unique('Blocks'));
    await typeBody(page, 'Opening paragraph.');

    await page.getByRole('button', { name: 'Pull quote' }).click();
    let dialog = page.getByRole('dialog', { name: 'Pull quote' });
    await dialog.getByRole('button', { name: 'Insert' }).click();
    await expect(dialog.getByText('Write the quote.')).toBeVisible();
    await dialog.getByRole('textbox', { name: 'Quote' }).fill('We are not done with this season yet.');
    await dialog.getByRole('textbox', { name: /Who said it/ }).fill('Head of Bulog');
    await dialog.getByRole('button', { name: 'Insert' }).click();

    await page.getByRole('button', { name: 'Key figures' }).click();
    dialog = page.getByRole('dialog', { name: 'Key figures' });
    await dialog.getByRole('textbox', { name: 'Figure 1' }).fill('31.5m');
    await dialog.getByRole('textbox', { name: 'Label 1' }).fill('tonnes expected');
    await dialog.getByRole('textbox', { name: 'Figure 2' }).fill('−2.4%');
    await dialog.getByRole('textbox', { name: 'Label 2' }).fill('on last year');
    await dialog.getByRole('textbox', { name: /Source/ }).fill('BPS');
    await dialog.getByRole('button', { name: 'Insert' }).click();

    await page.getByRole('button', { name: 'YouTube video' }).click();
    dialog = page.getByRole('dialog', { name: 'YouTube video' });
    await dialog.getByRole('textbox', { name: 'YouTube link' }).fill('https://vimeo.com/123');
    await dialog.getByRole('textbox', { name: 'What the video shows' }).fill('Harvest in Karawang');
    await dialog.getByRole('button', { name: 'Insert' }).click();
    await expect(dialog.getByText(/Paste a YouTube link/)).toBeVisible();
    await dialog.getByRole('textbox', { name: 'YouTube link' }).fill('https://youtu.be/dQw4w9WgXcQ');
    await dialog.getByRole('button', { name: 'Insert' }).click();

    await page.getByRole('button', { name: 'Read more card' }).click();
    dialog = page.getByRole('dialog', { name: 'Read more' });
    await dialog.getByRole('searchbox', { name: 'Find an article' }).fill(targetTitle);
    await dialog.getByRole('button', { name: 'Search' }).click();
    await dialog.getByRole('button', { name: new RegExp(targetTitle) }).click();
    await dialog.getByRole('button', { name: 'Insert' }).click();

    await expect(page.getByText('PULL QUOTE', { exact: false }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(main(page).getByRole('status').filter({ hasText: 'Draft saved.' })).toBeVisible();

    await page.goto(`/newsroom/preview/${id}`);
    await expect(page.getByText('We are not done with this season yet.')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Key figures' })).toContainText('31.5m');
    await expect(page.getByText('Source: BPS')).toBeVisible();
    await expect(page.getByRole('link', { name: targetTitle })).toHaveAttribute('href', `/${section.slug}/${targetTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
    await expect(page.locator('iframe')).toHaveCount(0);
    await page.getByRole('button', { name: 'Play video: Harvest in Karawang' }).click();
    await expect(page.locator('iframe[src^="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"]')).toBeAttached();
  });

  test('schedules in WIB and publishes once the time has passed', async ({ page }) => {
    const { section, author } = await seedTaxonomy('Schedule');
    const id = await seedArticle({ title: unique('Scheduled story'), sectionId: section.id, authorId: author.id, ready: true });
    await page.goto(`/newsroom/articles/${id}`);
    await page.getByRole('button', { name: 'Schedule', exact: true }).click();
    await page.getByLabel('Publish time (WIB)').fill('2099-01-02T09:30');
    await page.getByRole('button', { name: 'Confirm schedule' }).click();
    await expect(main(page).getByRole('status').filter({ hasText: 'Scheduled for 2 Jan 2099, 09:30 WIB.' })).toBeVisible();
    const [row] = await sql<{ status: string; scheduled_at: Date }>(`select status, scheduled_at from public.articles where id = $1`, [id]);
    expect(row.status).toBe('scheduled');
    expect(row.scheduled_at.toISOString()).toBe('2099-01-02T02:30:00.000Z');

    await sql(`update public.articles set scheduled_at = now() - interval '1 minute' where id = $1`, [id]);
    await page.goto('/newsroom/articles?status=published');
    await expect(page.getByRole('row', { name: /Scheduled story/ }).filter({ hasText: 'Published' }).first()).toBeVisible();
  });

  test('unpublishes and archives after confirming, and archived articles are read-only', async ({ page }) => {
    const { section, author } = await seedTaxonomy('Archive');
    const id = await seedArticle({ title: unique('Live story'), sectionId: section.id, authorId: author.id, ready: true, status: 'published' });
    await page.goto(`/newsroom/articles/${id}`);
    await page.getByRole('button', { name: 'Unpublish', exact: true }).click();
    const confirm = page.getByRole('dialog', { name: 'Unpublish this article?' });
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('button', { name: 'Update', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Unpublish', exact: true }).click();
    await confirm.getByRole('button', { name: 'Unpublish' }).click();
    await expect(main(page).getByRole('status').filter({ hasText: 'Unpublished. Readers no longer see it.' })).toBeVisible();

    await page.getByRole('button', { name: 'Archive', exact: true }).click();
    await page.getByRole('dialog', { name: 'Archive this article?' }).getByRole('button', { name: 'Archive' }).click();
    await expect(main(page).getByText('Archived articles are read-only.')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Headline' })).toBeDisabled();
    await page.getByRole('button', { name: 'Restore to draft' }).click();
    await expect(page.getByRole('textbox', { name: 'Headline' })).toBeEnabled();
  });

  test('refuses a save from a window that is out of date', async ({ page, context }) => {
    const id = await seedArticle({ title: unique('Two windows') });
    const other = await context.newPage();
    await other.goto(`/newsroom/articles/${id}`);
    await page.goto(`/newsroom/articles/${id}`);
    await page.getByRole('textbox', { name: 'Headline' }).fill('Saved in the first window');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(main(page).getByRole('status').filter({ hasText: 'Draft saved.' })).toBeVisible();

    await other.getByRole('textbox', { name: 'Headline' }).fill('Typed in the second window');
    await other.getByRole('button', { name: 'Save draft' }).click();
    await expect(main(other).getByRole('alert').filter({ hasText: 'This article changed in another window.' })).toBeVisible();
    await expect(other.getByRole('button', { name: 'Reload' })).toBeVisible();
    const [row] = await sql<{ title: string }>(`select title from public.articles where id = $1`, [id]);
    expect(row.title).toBe('Saved in the first window');
  });

  test('restores an earlier version from the history', async ({ page }) => {
    const id = await newArticle(page);
    await page.getByRole('textbox', { name: 'Headline' }).fill('First headline');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(main(page).getByRole('status').filter({ hasText: 'Draft saved.' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Headline' }).fill('Second headline');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(main(page).getByRole('status').filter({ hasText: 'Draft saved.' })).toBeVisible();

    await page.goto(`/newsroom/articles/${id}/history`);
    await page.getByRole('row').nth(2).getByRole('button', { name: 'Restore' }).click();
    await page.getByRole('dialog', { name: 'Restore this version?' }).getByRole('button', { name: 'Restore' }).click();
    await page.waitForURL(`**/newsroom/articles/${id}?notice=restored`);
    await expect(page.getByRole('textbox', { name: 'Headline' })).toHaveValue('First headline');
    await expect(main(page).getByText('Earlier version restored.')).toBeVisible();
    await page.goto(`/newsroom/articles/${id}/history`);
    await expect(page.getByRole('cell', { name: /^Restored the version from/ })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Before restore' })).toBeVisible();
  });

  test('filters the list and publishes several articles at once, naming what blocks the rest', async ({ page }) => {
    const { section, author } = await seedTaxonomy('Bulk');
    const ready = unique('Bulk ready');
    const thin = unique('Bulk thin');
    await seedArticle({ title: ready, sectionId: section.id, authorId: author.id, ready: true });
    await seedArticle({ title: thin, sectionId: section.id, authorId: author.id });

    await page.goto('/newsroom/articles');
    await page.getByRole('combobox', { name: 'Section' }).selectOption({ label: section.name });
    await page.getByRole('button', { name: 'Filter' }).click();
    await expect(page.getByRole('row')).toHaveCount(3);
    await page.getByRole('searchbox', { name: 'Search articles' }).fill(ready);
    await page.getByRole('button', { name: 'Filter' }).click();
    await expect(page.getByRole('row')).toHaveCount(2);
    await page.getByRole('link', { name: 'Clear' }).click();

    await page.getByRole('combobox', { name: 'Section' }).selectOption({ label: section.name });
    await page.getByRole('button', { name: 'Filter' }).click();
    await expect(page.getByRole('row')).toHaveCount(3);
    await page.getByRole('checkbox', { name: 'Select all articles on this page' }).check();
    await page.getByRole('combobox', { name: 'Action for selected articles' }).selectOption('publish');
    await page.getByRole('button', { name: 'Apply' }).click();
    const notice = main(page).getByRole('alert');
    await expect(notice).toContainText('1 article published. 1 article needs work before publishing:');
    await expect(notice).toContainText(thin);
    await expect(notice).toContainText('Add a standfirst');
    await expect(page.getByRole('row', { name: new RegExp(ready) })).toContainText('Published');

    await page.getByRole('checkbox', { name: `Select ${thin}` }).check();
    await page.getByRole('combobox', { name: 'Action for selected articles' }).selectOption('delete');
    await page.getByRole('button', { name: 'Apply' }).click();
    await page.getByRole('dialog', { name: 'Delete 1 article?' }).getByRole('button', { name: 'Delete' }).click();
    await expect(main(page).getByRole('status')).toContainText('1 article deleted.');
    await expect(page.getByRole('row', { name: new RegExp(thin) })).toHaveCount(0);
  });

  test('editor, list, history and preview are accessible in both themes', async ({ page }) => {
    const { section, author } = await seedTaxonomy('Axe');
    const id = await seedArticle({ title: unique('Accessible story'), sectionId: section.id, authorId: author.id, ready: true });
    for (const path of [`/newsroom/articles/${id}`, '/newsroom/articles', `/newsroom/articles/${id}/history`, `/newsroom/preview/${id}`, '/newsroom']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeAttached();
      await page.waitForLoadState('networkidle');
      await expectNoAxeViolations(page);
      await page.emulateMedia({ colorScheme: 'dark' });
      await expectNoAxeViolations(page);
      await page.emulateMedia({ colorScheme: 'light' });
    }
  });
});

test('the editor fits a phone screen', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Phone layout only.');
  const id = await seedArticle({ title: unique('Phone story') });
  await signIn(page, `/newsroom/articles/${id}`);
  await expect(page.getByRole('textbox', { name: 'Article text' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});
```


### `tests/e2e/foundation.spec.ts`

```ts
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Password the fake Supabase accepts (tests/fake-supabase/auth.mjs).
const PASSWORD = 'correct-horse-battery-staple';

test.describe('holding page', () => {
  test('shows the logo and tagline, stays out of search engines', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('img', { name: 'PressCompass' })).toBeVisible();
    await expect(page.getByText('News with a sense of direction.')).toBeVisible();
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

/** An article straight in the database; `ready` fills everything publishing needs. */
export async function seedArticle(options: { title: string; sectionId?: string; authorId?: string; ready?: boolean; status?: string }) {
  const slug = options.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const [article] = await sql<{ id: string }>(
    `insert into public.articles (title, slug, section_id, standfirst, body, body_text, word_count, status, published_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8::public.article_status, case when $8::text = 'published' then now() else null end) returning id`,
    [
      options.title,
      slug,
      options.sectionId ?? null,
      options.ready ? 'Why it matters for households.' : '',
      JSON.stringify(options.ready ? READY_BODY : { type: 'doc', content: [] }),
      '',
      options.ready ? 160 : 0,
      options.status ?? 'draft',
    ],
  );
  if (options.authorId) await sql(`insert into public.article_authors (article_id, author_id) values ($1, $2)`, [article.id, options.authorId]);
  return article.id;
}
```


### `tests/e2e/taxonomy.spec.ts`

```ts
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
```


### `tests/fake-supabase/auth.mjs`

```js
// Stand-in for Supabase Auth (GoTrue): password sign-in, current user and sign-out for the
// two test users. Tokens are unsigned JWTs; tests/fake-supabase/rest.mjs reads their claims.

export const PASSWORD = 'correct-horse-battery-staple';
export const USERS = {
  'owner@example.com': { id: '11111111-1111-4111-8111-111111111111', staff: true },
  'stranger@example.com': { id: '22222222-2222-4222-8222-222222222222', staff: false },
};

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

function tokenFor(email) {
  const user = USERS[email];
  const claims = { sub: user.id, email, role: 'authenticated', aud: 'authenticated', exp: 4102444800 };
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(claims)}.sig`;
}

/** Claims of a bearer JWT, or null when the header carries no JWT (for example a publishable key). */
export function jwtClaims(header) {
  const token = (header ?? '').replace(/^Bearer\s+/i, '');
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  } catch {
    return null;
  }
}

/** The database role and JWT claims a Data API request runs with, as on Supabase. */
export function requestClaims(req) {
  const jwt = jwtClaims(req.headers.authorization);
  if (jwt?.role === 'authenticated' && USERS[jwt.email]) return jwt;
  const key = String(req.headers.apikey ?? req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  if (key.startsWith('sb_secret_')) return { role: 'service_role' };
  return { role: 'anon' };
}

const userJson = (email) => ({
  id: USERS[email].id,
  aud: 'authenticated',
  role: 'authenticated',
  email,
  app_metadata: { provider: 'email' },
  user_metadata: {},
  created_at: '2026-11-13T00:00:00Z',
});

/** Handles /auth/v1/* requests. Returns false for other paths. */
export function handleAuth(req, url, body, send) {
  if (!url.pathname.startsWith('/auth/v1/')) return false;
  if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
    const user = USERS[body.email];
    if (!user || body.password !== PASSWORD) {
      send(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      return true;
    }
    const now = Math.floor(Date.now() / 1000);
    send(200, {
      access_token: tokenFor(body.email),
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: now + 3600,
      refresh_token: `refresh-${user.id}`,
      user: userJson(body.email),
    });
    return true;
  }
  if (url.pathname === '/auth/v1/user') {
    const claims = jwtClaims(req.headers.authorization);
    if (!claims?.email || !USERS[claims.email]) send(401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' });
    else send(200, userJson(claims.email));
    return true;
  }
  if (url.pathname === '/auth/v1/logout') {
    send(204);
    return true;
  }
  send(404, { msg: `Fake Supabase Auth has no route for ${req.method} ${url.pathname}` });
  return true;
}
```


### `tests/fake-supabase/database.mjs`

```js
// Creates a fresh PostgreSQL database with the Supabase stub, every migration and the test users,
// the same way tests/db does, and returns a connection pool for the fake Data API.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { USERS } from './auth.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export async function createDatabase({ adminUrl, name }) {
  if (!/^[a-z][a-z0-9_]*$/.test(name)) throw new Error(`Unsafe database name: ${name}`);
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`drop database if exists ${name} with (force)`);
  await admin.query(`create database ${name}`);
  await admin.end();

  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  const setup = new pg.Client({ connectionString: url.toString() });
  await setup.connect();
  await setup.query(readFileSync(join(ROOT, 'tests/db/supabase-stub.sql'), 'utf8'));
  const dir = join(ROOT, 'supabase/migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await setup.query(readFileSync(join(dir, file), 'utf8'));
  }
  for (const [email, user] of Object.entries(USERS)) {
    await setup.query('insert into auth.users (id, email) values ($1, $2)', [user.id, email]);
    if (user.staff) await setup.query(`insert into public.staff (user_id, role) values ($1, 'owner')`, [user.id]);
  }
  await setup.end();
  return new pg.Pool({ connectionString: url.toString(), max: 10 });
}
```


### `tests/fake-supabase/rest.mjs`

```js
// Stand-in for the Supabase Data API (PostgREST) that runs real SQL on PostgreSQL with the
// request's role and JWT claims, so Row Level Security and SQL functions behave as on Supabase.
// It supports the subset of PostgREST that PressCompass uses: plain column lists (no embedding:
// joined reads go through SQL functions), filters eq/neq/gt/gte/lt/lte/like/ilike/is/in (with not.),
// order, limit/offset, count=exact, single-object responses, insert/upsert, update, delete and RPC.

const IDENT = /^[a-z_][a-z0-9_]*$/;
const OBJECT_TYPE = 'application/vnd.pgrst.object+json';
const RESERVED_PARAMS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);
const OPERATORS = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'like', ilike: 'ilike' };

class RestError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function quote(name) {
  if (!IDENT.test(name)) throw new RestError(400, 'PGRST100', `The fake Data API does not support "${name}". Use a SQL function for joined reads.`);
  return `"${name}"`;
}

function selectList(select) {
  if (!select || select === '*') return '*';
  return select
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map(quote)
    .join(', ');
}

function splitList(raw) {
  // "(a,b,\"c,d\")" -> ['a', 'b', 'c,d']
  const inner = raw.replace(/^\(/, '').replace(/\)$/, '');
  const items = [];
  let current = '';
  let quoted = false;
  for (const char of inner) {
    if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) {
      items.push(current);
      current = '';
    } else current += char;
  }
  if (current !== '' || inner.endsWith(',')) items.push(current);
  return items;
}

function whereClause(params, values) {
  const push = (value) => {
    values.push(value);
    return `$${values.length}`;
  };
  const clauses = [];
  for (const [key, raw] of params) {
    if (RESERVED_PARAMS.has(key)) continue;
    const column = quote(key);
    let rest = raw;
    let negate = false;
    if (rest.startsWith('not.')) {
      negate = true;
      rest = rest.slice(4);
    }
    const dot = rest.indexOf('.');
    const op = rest.slice(0, dot);
    const value = rest.slice(dot + 1);
    let clause;
    if (op in OPERATORS) {
      const operand = op === 'like' || op === 'ilike' ? value.replaceAll('*', '%') : value;
      clause = `${column} ${OPERATORS[op]} ${push(operand)}`;
    } else if (op === 'is') {
      if (!['null', 'true', 'false'].includes(value)) throw new RestError(400, 'PGRST100', `Unsupported is.${value}`);
      clause = `${column} is ${value}`;
    } else if (op === 'in') {
      const items = splitList(value);
      clause = items.length ? `${column} in (${items.map(push).join(', ')})` : 'false';
    } else {
      throw new RestError(400, 'PGRST100', `The fake Data API does not support the "${op}" filter.`);
    }
    clauses.push(negate ? `not (${clause})` : clause);
  }
  return clauses.length ? ` where ${clauses.join(' and ')}` : '';
}

function orderClause(order) {
  if (!order) return '';
  const parts = order.split(',').map((part) => {
    const [column, ...flags] = part.split('.');
    const direction = flags.includes('desc') ? 'desc' : 'asc';
    const nulls = flags.includes('nullsfirst') ? ' nulls first' : flags.includes('nullslast') ? ' nulls last' : '';
    return `${quote(column)} ${direction}${nulls}`;
  });
  return ` order by ${parts.join(', ')}`;
}

function prefer(req) {
  const header = String(req.headers.prefer ?? '');
  return {
    count: /count=exact/.test(header),
    representation: /return=representation/.test(header),
    merge: /resolution=merge-duplicates/.test(header),
    ignore: /resolution=ignore-duplicates/.test(header),
  };
}

const wantsObject = (req) => String(req.headers.accept ?? '').includes(OBJECT_TYPE);

async function columnTypes(pool, cache, table) {
  if (!cache.has(table)) {
    const { rows } = await pool.query(
      `select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = $1`,
      [table],
    );
    if (!rows.length) throw new RestError(404, '42P01', `relation "public.${table}" does not exist`);
    cache.set(table, new Map(rows.map((row) => [row.column_name, row.data_type])));
  }
  return cache.get(table);
}

function toParam(value, type) {
  if (value === null || value === undefined) return null;
  if (type === 'json' || type === 'jsonb') return JSON.stringify(value);
  return value;
}

async function withRole(pool, claims, fn) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`set local role ${quote(claims.role)}`);
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

function statusFor(error) {
  if (error instanceof RestError) return error.status;
  const code = String(error.code ?? '');
  if (/^PT\d{3}$/.test(code)) return Number(code.slice(2));
  if (code === '23505' || code === '23503') return 409;
  if (code === '42501') return 403;
  if (code === '42883' || code === '42P01') return 404;
  if (code.startsWith('40') || code.startsWith('XX') || code.startsWith('P0') && code !== 'P0001') return 500;
  return 400;
}

function rowsResponse(req, rows, { status = 200, total } = {}) {
  const headers = {};
  if (total !== undefined) headers['content-range'] = rows.length ? `0-${rows.length - 1}/${total}` : `*/${total}`;
  if (wantsObject(req)) {
    if (rows.length !== 1) {
      return { status: 406, headers, body: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${rows.length} rows`, hint: null } };
    }
    return { status, headers, body: rows[0] };
  }
  return { status, headers, body: rows };
}

async function readTable(pool, req, table, params) {
  const values = [];
  const where = whereClause(params, values);
  const options = prefer(req);
  return withRole(pool, req.claims, async (client) => {
    let total;
    if (options.count) total = Number((await client.query(`select count(*)::int as n from public.${quote(table)}${where}`, values)).rows[0].n);
    if (req.method === 'HEAD') return { status: 200, headers: { 'content-range': `*/${total ?? 0}` }, body: undefined };
    const limit = params.get('limit') ? ` limit ${Number.parseInt(params.get('limit'), 10)}` : '';
    const offset = params.get('offset') ? ` offset ${Number.parseInt(params.get('offset'), 10)}` : '';
    const sql = `select ${selectList(params.get('select'))} from public.${quote(table)}${where}${orderClause(params.get('order'))}${limit}${offset}`;
    const { rows } = await client.query(sql, values);
    return rowsResponse(req, rows, { total });
  });
}

async function insertRows(pool, cache, req, table, params, body) {
  const rows = Array.isArray(body) ? body : [body];
  const types = await columnTypes(pool, cache, table);
  const columns = params.get('columns') ? params.get('columns').split(',') : [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const values = [];
  const tuples = rows.map(
    (row) =>
      `(${columns
        .map((column) => {
          if (row[column] === undefined) return 'default';
          values.push(toParam(row[column], types.get(column)));
          return `$${values.length}`;
        })
        .join(', ')})`,
  );
  const options = prefer(req);
  let conflict = '';
  if (options.merge || options.ignore) {
    const target = (params.get('on_conflict') ?? '').split(',').filter(Boolean);
    if (!target.length) throw new RestError(400, 'PGRST100', 'The fake Data API needs on_conflict for upserts.');
    const updates = columns.filter((column) => !target.includes(column)).map((column) => `${quote(column)} = excluded.${quote(column)}`);
    conflict = ` on conflict (${target.map(quote).join(', ')}) do ${options.ignore || !updates.length ? 'nothing' : `update set ${updates.join(', ')}`}`;
  }
  const returning = options.representation ? ` returning ${selectList(params.get('select'))}` : '';
  const sql = `insert into public.${quote(table)} (${columns.map(quote).join(', ')}) values ${tuples.join(', ')}${conflict}${returning}`;
  return withRole(pool, req.claims, async (client) => {
    const result = await client.query(sql, values);
    return options.representation ? rowsResponse(req, result.rows, { status: 201 }) : { status: 201, body: undefined };
  });
}

async function updateRows(pool, cache, req, table, params, body) {
  const types = await columnTypes(pool, cache, table);
  const values = [];
  const sets = Object.entries(body).map(([column, value]) => {
    values.push(toParam(value, types.get(column)));
    return `${quote(column)} = $${values.length}`;
  });
  if (!sets.length) throw new RestError(400, 'PGRST100', 'Nothing to update.');
  const where = whereClause(params, values);
  const options = prefer(req);
  const returning = options.representation ? ` returning ${selectList(params.get('select'))}` : '';
  return withRole(pool, req.claims, async (client) => {
    const result = await client.query(`update public.${quote(table)} set ${sets.join(', ')}${where}${returning}`, values);
    return options.representation ? rowsResponse(req, result.rows) : { status: 204, body: undefined };
  });
}

async function deleteRows(pool, req, table, params) {
  const values = [];
  const where = whereClause(params, values);
  const options = prefer(req);
  const returning = options.representation ? ` returning ${selectList(params.get('select'))}` : '';
  return withRole(pool, req.claims, async (client) => {
    const result = await client.query(`delete from public.${quote(table)}${where}${returning}`, values);
    return options.representation ? rowsResponse(req, result.rows) : { status: 204, body: undefined };
  });
}

async function callFunction(pool, req, name, args) {
  const { rows: found } = await pool.query(
    `select p.proretset as set, t.typtype as kind, t.typname as type,
            coalesce(p.proargnames, '{}') as names,
            array(select format_type(oid, null) from unnest(p.proargtypes::oid[]) with ordinality as a(oid, n) order by n) as arg_types
       from pg_proc p
       join pg_namespace ns on ns.oid = p.pronamespace
       join pg_type t on t.oid = p.prorettype
      where ns.nspname = 'public' and p.proname = $1`,
    [name],
  );
  if (found.length !== 1) throw new RestError(404, 'PGRST202', `Could not find the function public.${name}`);
  const fn = found[0];
  const values = [];
  const named = Object.entries(args ?? {}).map(([arg, value]) => {
    const index = fn.names.indexOf(arg);
    if (index < 0 || index >= fn.arg_types.length) throw new RestError(404, 'PGRST202', `public.${name} has no argument "${arg}"`);
    const type = fn.arg_types[index];
    values.push(toParam(value, type === 'jsonb' || type === 'json' ? type : null));
    return `${quote(arg)} => $${values.length}::${type}`;
  });
  const call = `public.${quote(name)}(${named.join(', ')})`;
  return withRole(pool, req.claims, async (client) => {
    if (fn.set) return rowsResponse(req, (await client.query(`select * from ${call}`, values)).rows);
    if (fn.kind === 'c') return { status: 200, body: (await client.query(`select * from ${call}`, values)).rows[0] ?? null };
    const { rows } = await client.query(`select ${call} as result`, values);
    return { status: 200, body: fn.type === 'void' ? null : rows[0].result };
  });
}

/** Handles /rest/v1/* requests with real SQL. Returns false for other paths. */
export async function handleRest(pool, cache, req, url, body, send) {
  if (!url.pathname.startsWith('/rest/v1/')) return false;
  const path = url.pathname.slice('/rest/v1/'.length);
  try {
    let result;
    if (path.startsWith('rpc/')) {
      result = await callFunction(pool, req, path.slice(4), body);
    } else {
      const table = path;
      quote(table);
      if (req.method === 'GET' || req.method === 'HEAD') result = await readTable(pool, req, table, url.searchParams);
      else if (req.method === 'POST') result = await insertRows(pool, cache, req, table, url.searchParams, body);
      else if (req.method === 'PATCH') result = await updateRows(pool, cache, req, table, url.searchParams, body);
      else if (req.method === 'DELETE') result = await deleteRows(pool, req, table, url.searchParams);
      else throw new RestError(405, 'PGRST117', `Unsupported method ${req.method}`);
    }
    send(result.status, result.body, result.headers);
  } catch (error) {
    send(statusFor(error), { code: String(error.code ?? 'PGRST000'), message: error.message, details: error.detail ?? null, hint: error.hint ?? null });
  }
  return true;
}
```


### `tests/fake-supabase/server.mjs`

```js
// Fake Supabase for E2E tests and local previews without a Supabase project (no Docker):
// Auth for two test users, and a Data API that runs real SQL on a fresh PostgreSQL database.
//   FAKE_SUPABASE_PORT   port to listen on (3101)
//   FAKE_DATABASE_URL    a PostgreSQL server where the user may create databases
//   FAKE_DATABASE_NAME   database to (re)create on start (presscompass_e2e)
import { createServer } from 'node:http';
import { handleAuth, requestClaims } from './auth.mjs';
import { createDatabase } from './database.mjs';
import { handleRest } from './rest.mjs';

const PORT = Number(process.env.FAKE_SUPABASE_PORT ?? 3101);
const ADMIN_URL = process.env.FAKE_DATABASE_URL ?? process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/postgres';
const NAME = process.env.FAKE_DATABASE_NAME ?? 'presscompass_e2e';

const pool = await createDatabase({ adminUrl: ADMIN_URL, name: NAME });
const typeCache = new Map();

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const send = (status, body, headers = {}) => {
    res.writeHead(status, { 'content-type': 'application/json', ...headers });
    res.end(body === undefined ? '' : JSON.stringify(body));
  };
  let raw = '';
  for await (const chunk of req) raw += chunk;
  let body = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return send(400, { message: 'Invalid JSON body' });
  }
  req.claims = requestClaims(req);
  if (handleAuth(req, url, body, send)) return;
  if (await handleRest(pool, typeCache, req, url, body, send)) return;
  send(404, { message: `Fake Supabase has no route for ${req.method} ${url.pathname}` });
});

server.listen(PORT, '127.0.0.1', () => console.log(`Fake Supabase on http://127.0.0.1:${PORT} (database ${NAME})`));
```


### `tests/unit/article-body.test.tsx`

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Doc } from '@/lib/doc/schema';
import { ArticleBody } from '@/modules/content/ArticleBody';

const doc = (content: unknown[]) => ({ type: 'doc', content }) as Doc;

describe('ArticleBody', () => {
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


### `tests/unit/doc.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { EMPTY_DOC } from '@/lib/doc/schema';
import { sanitizeDoc } from '@/lib/doc/sanitize';
import { docText, readingMinutes, wordCount } from '@/lib/doc/text';

const p = (text: string, marks?: unknown[]) => ({ type: 'paragraph', content: [{ type: 'text', text, ...(marks ? { marks } : {}) }] });

describe('sanitizeDoc', () => {
  it('keeps the blocks and marks the editor supports', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'What changed' }] },
        p('Prices rose ', [{ type: 'bold' }]),
        { type: 'bulletList', content: [{ type: 'listItem', content: [p('One')] }] },
        { type: 'orderedList', attrs: { start: 3 }, content: [{ type: 'listItem', content: [p('Three')] }] },
        { type: 'blockquote', content: [p('Quoted')] },
        { type: 'horizontalRule' },
        { type: 'pullQuote', attrs: { text: 'We are not done.', attribution: 'Sri Mulyani, finance minister' } },
        { type: 'editorNote', attrs: { kind: 'correction', date: '2026-11-13', text: 'An earlier version misstated the figure.' } },
        { type: 'keyFigures', attrs: { title: 'Harvest', items: [{ value: '31.5m', label: 'tonnes' }, { value: '−2.4%', label: 'on year' }], source: 'BPS' } },
        { type: 'youtube', attrs: { videoId: 'dQw4w9WgXcQ', title: 'Briefing' } },
        { type: 'readMore', attrs: { articleId: '0b8a6f5e-58a8-4d5c-9b8e-0a5b8a1c2d3e', title: 'Earlier story' } },
        {
          type: 'table',
          content: [
            { type: 'tableRow', content: [{ type: 'tableHeader', attrs: { colspan: 1, rowspan: 1 }, content: [p('Year')] }] },
            { type: 'tableRow', content: [{ type: 'tableCell', attrs: { colspan: 2, rowspan: 1 }, content: [p('2026')] }] },
          ],
        },
      ],
    };
    expect(sanitizeDoc(doc)).toEqual(doc);
  });

  it('drops unknown attributes, unsafe links and marks it does not know', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { class: 'x' },
          content: [
            { type: 'text', text: 'safe', marks: [{ type: 'link', attrs: { href: 'https://bps.go.id', target: '_blank', onclick: 'x' } }] },
            { type: 'text', text: ' bad', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }, { type: 'italic' }] },
            { type: 'text', text: ' struck', marks: [{ type: 'strike' }, { type: 'bold' }, { type: 'bold' }] },
            { type: 'hardBreak' },
          ],
        },
      ],
    };
    expect(sanitizeDoc(doc)).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'safe', marks: [{ type: 'link', attrs: { href: 'https://bps.go.id' } }] },
            { type: 'text', text: ' bad', marks: [{ type: 'italic' }] },
            { type: 'text', text: ' struck', marks: [{ type: 'bold' }] },
            { type: 'hardBreak' },
          ],
        },
      ],
    });
  });

  it('turns blocks it does not allow in a place into paragraphs instead of losing their text', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Too big' }] },
        { type: 'heading', attrs: { level: 5 }, content: [{ type: 'text', text: 'Too small' }] },
        { type: 'codeBlock', content: [{ type: 'text', text: 'let x = 1' }] },
        { type: 'blockquote', content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Inside' }] }] },
        { type: 'iframe', attrs: { src: 'https://evil.example' } },
      ],
    };
    expect(sanitizeDoc(doc)).toEqual({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Too big' }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Too small' }] },
        p('let x = 1'),
        { type: 'blockquote', content: [p('Inside')] },
      ],
    });
  });

  it('drops special blocks that are empty or invalid', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'pullQuote', attrs: { text: '   ', attribution: 'Nobody' } },
        { type: 'youtube', attrs: { videoId: 'too-short', title: 'x' } },
        { type: 'readMore', attrs: { articleId: 'nope', title: 'x' } },
        { type: 'keyFigures', attrs: { title: 'x', items: [], source: '' } },
        { type: 'editorNote', attrs: { kind: 'rumour', date: 'yesterday', text: 'Still kept as an update' } },
      ],
    };
    expect(sanitizeDoc(doc)).toEqual({
      type: 'doc',
      content: [{ type: 'editorNote', attrs: { kind: 'update', date: '', text: 'Still kept as an update' } }],
    });
  });

  it('returns an empty document for anything that is not a document', () => {
    expect(sanitizeDoc(null)).toEqual(EMPTY_DOC);
    expect(sanitizeDoc({ type: 'paragraph' })).toEqual(EMPTY_DOC);
    expect(sanitizeDoc('<p>hi</p>')).toEqual(EMPTY_DOC);
  });

  it('limits key figures to four and trims overlong text', () => {
    const items = Array.from({ length: 6 }, (_, i) => ({ value: String(i), label: 'x'.repeat(300) }));
    const clean = sanitizeDoc({ type: 'doc', content: [{ type: 'keyFigures', attrs: { title: '', items, source: '' } }] });
    const block = clean.content[0] as { attrs: { items: { label: string }[] } };
    expect(block.attrs.items).toHaveLength(4);
    expect(block.attrs.items[0].label).toHaveLength(120);
  });
});

describe('document text', () => {
  it('collects readable text for search and counting', () => {
    const doc = sanitizeDoc({
      type: 'doc',
      content: [
        p('Rice prices rose.'),
        { type: 'bulletList', content: [{ type: 'listItem', content: [p('Java')] }, { type: 'listItem', content: [p('Bali')] }] },
        { type: 'pullQuote', attrs: { text: 'Not done yet.', attribution: 'Minister' } },
        { type: 'youtube', attrs: { videoId: 'dQw4w9WgXcQ', title: 'Video title' } },
      ],
    });
    expect(docText(doc)).toBe('Rice prices rose.\nJava\nBali\nNot done yet.');
  });

  it('counts words, including numbers and contractions, and estimates reading time', () => {
    expect(wordCount('Indonesia’s GDP grew 5.1% in Q3, didn’t it?')).toBe(8);
    expect(wordCount('')).toBe(0);
    expect(readingMinutes(0)).toBe(0);
    expect(readingMinutes(1)).toBe(1);
    expect(readingMinutes(460)).toBe(2);
    expect(readingMinutes(461)).toBe(3);
  });
});
```


### `tests/unit/editor.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { parseArticleInput } from '@/modules/editor/input';
import { publishProblems } from '@/modules/editor/rules';
import { prepareSave } from '@/modules/editor/save';
import { intentLabel, statusActions, transition } from '@/modules/editor/status';

const NOW = new Date('2026-11-13T03:00:00Z');
const ID = '0b8a6f5e-58a8-4d5c-9b8e-0a5b8a1c2d3e';
const SECTION = '1c9e7a2b-3d4f-4a5b-8c6d-7e8f9a0b1c2d';
const AUTHOR = '2d0f8b3c-4e5a-4b6c-9d7e-8f9a0b1c2d3e';
const longBody = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'word '.repeat(160).trim() }] }] };

const raw = (over: Record<string, unknown> = {}) => ({
  id: ID,
  version: 3,
  title: 'Rice prices climb',
  slug: 'rice-prices-climb',
  slugAuto: true,
  sectionId: SECTION,
  type: 'news',
  kicker: '',
  standfirst: 'Why it matters for households.',
  body: longBody,
  isBreaking: false,
  authorIds: [AUTHOR],
  tagIds: [],
  relatedIds: [],
  sources: [],
  scheduledAt: null,
  majorUpdate: false,
  ...over,
});

describe('status actions', () => {
  it('offers one next step per status, with the rest as secondary actions', () => {
    expect(statusActions('draft')).toEqual({ primary: 'review', others: ['save', 'publish', 'schedule', 'archive'] });
    expect(statusActions('review')).toEqual({ primary: 'publish', others: ['save', 'schedule', 'draft', 'archive'] });
    expect(statusActions('scheduled')).toEqual({ primary: 'update', others: ['publish', 'unschedule', 'archive'] });
    expect(statusActions('published')).toEqual({ primary: 'update', others: ['unpublish', 'archive'] });
    expect(statusActions('archived')).toEqual({ primary: 'restore', others: [] });
  });

  it('labels actions in plain words', () => {
    expect(intentLabel('publish', 'review')).toBe('Publish');
    expect(intentLabel('publish', 'draft')).toBe('Publish now');
    expect(intentLabel('update', 'published')).toBe('Update');
    expect(intentLabel('update', 'scheduled')).toBe('Save changes');
    expect(intentLabel('unschedule', 'scheduled')).toBe('Cancel schedule');
  });
});

describe('transition', () => {
  const draft = { status: 'draft' as const, published_at: null, scheduled_at: null };

  it('publishes now, keeping the first publication time when there is one', () => {
    expect(transition(draft, 'publish', { now: NOW })).toMatchObject({
      ok: true,
      status: 'published',
      published_at: NOW.toISOString(),
      scheduled_at: null,
      note: 'Published',
      needsRules: true,
    });
    const before = { status: 'draft' as const, published_at: '2026-10-01T00:00:00.000Z', scheduled_at: null };
    expect(transition(before, 'publish', { now: NOW })).toMatchObject({ published_at: '2026-10-01T00:00:00.000Z' });
  });

  it('schedules only for a time at least a minute ahead', () => {
    const at = new Date('2026-11-14T02:00:00Z');
    expect(transition(draft, 'schedule', { now: NOW, scheduledAt: at })).toMatchObject({
      ok: true,
      status: 'scheduled',
      scheduled_at: at.toISOString(),
      note: 'Scheduled for 14 Nov 2026, 09:00 WIB',
    });
    expect(transition(draft, 'schedule', { now: NOW })).toEqual({ ok: false, field: 'scheduledAt', error: 'Choose a date and time to publish.' });
    expect(transition(draft, 'schedule', { now: NOW, scheduledAt: new Date(NOW.getTime() + 30_000) })).toEqual({
      ok: false,
      field: 'scheduledAt',
      error: 'Choose a time at least a minute from now.',
    });
  });

  it('marks a major update on a published article', () => {
    const live = { status: 'published' as const, published_at: '2026-11-01T00:00:00.000Z', scheduled_at: null };
    expect(transition(live, 'update', { now: NOW })).toMatchObject({ ok: true, status: 'published', note: 'Updated' });
    expect(transition(live, 'update', { now: NOW }).ok && 'major_update_at' in transition(live, 'update', { now: NOW })).toBe(false);
    expect(transition(live, 'update', { now: NOW, majorUpdate: true })).toMatchObject({ major_update_at: NOW.toISOString(), note: 'Major update' });
  });

  it('autosaves drafts with a throttled revision and refuses actions a status does not offer', () => {
    expect(transition(draft, 'autosave', { now: NOW })).toMatchObject({ ok: true, status: 'draft', note: 'Autosaved', throttle: true, needsRules: false });
    const live = { status: 'published' as const, published_at: '2026-11-01T00:00:00.000Z', scheduled_at: null };
    expect(transition(live, 'autosave', { now: NOW })).toEqual({ ok: false, error: 'This action is not available for a published article.' });
    expect(transition({ ...draft, status: 'archived' }, 'publish', { now: NOW })).toEqual({ ok: false, error: 'This action is not available for an archived article.' });
  });

  it('cancels a schedule, unpublishes and archives', () => {
    const scheduled = { status: 'scheduled' as const, published_at: null, scheduled_at: '2026-11-20T00:00:00.000Z' };
    expect(transition(scheduled, 'unschedule', { now: NOW })).toMatchObject({ status: 'draft', scheduled_at: null, note: 'Schedule cancelled' });
    expect(transition(scheduled, 'archive', { now: NOW })).toMatchObject({ status: 'archived', scheduled_at: null });
    const live = { status: 'published' as const, published_at: '2026-11-01T00:00:00.000Z', scheduled_at: null };
    expect(transition(live, 'unpublish', { now: NOW })).toMatchObject({ status: 'draft', published_at: '2026-11-01T00:00:00.000Z', note: 'Unpublished' });
  });
});

describe('publish rules', () => {
  const ready = { title: 'Rice prices climb', slug: 'rice-prices-climb', sectionId: SECTION, authorIds: [AUTHOR], standfirst: 'Why.', wordCount: 150 };

  it('passes a complete article', () => {
    expect(publishProblems(ready)).toEqual({});
  });

  it('names every missing piece next to its field', () => {
    expect(
      publishProblems({ title: ' ', slug: 'untitled-0a1b2c3d', sectionId: null, authorIds: [], standfirst: '', wordCount: 149 }),
    ).toEqual({
      title: 'Add a headline before publishing.',
      slug: 'Set the address before publishing. It fills in from the headline.',
      sectionId: 'Choose a section.',
      authorIds: 'Add at least one author.',
      standfirst: 'Add a standfirst: one or two sentences under the headline.',
      body: 'The article needs at least 150 words. It has 149.',
    });
  });
});

describe('parseArticleInput', () => {
  it('accepts a well-formed article and trims the text fields', () => {
    const result = parseArticleInput(raw({ title: '  Rice prices climb  ', sources: [{ title: 'BPS', url: 'https://bps.go.id', publisher: '', accessed: '' }, { title: '', url: '', publisher: '', accessed: '' }] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.title).toBe('Rice prices climb');
    expect(result.value.sources).toEqual([{ title: 'BPS', url: 'https://bps.go.id', publisher: '', accessed: '' }]);
    expect(result.errors).toEqual({});
  });

  it('reports field problems without rejecting the whole save', () => {
    const result = parseArticleInput(
      raw({ slug: 'Rice Prices', title: 'x'.repeat(201), sources: [{ title: '', url: 'ftp://x', publisher: '', accessed: 'soon' }] }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.errors).toEqual({
      title: 'Keep the headline under 200 characters.',
      slug: 'Use lowercase letters, numbers and single hyphens.',
      sources: 'Each source needs a title and a link that starts with https:// or http://. Dates use YYYY-MM-DD.',
    });
  });

  it('refuses input that is not an article', () => {
    expect(parseArticleInput(null)).toEqual({ ok: false, error: 'The editor sent something unexpected. Reload the page and try again.' });
    expect(parseArticleInput(raw({ id: 'nope' })).ok).toBe(false);
    expect(parseArticleInput(raw({ authorIds: ['nope'] })).ok).toBe(false);
    expect(parseArticleInput(raw({ type: 'gossip' })).ok).toBe(false);
  });
});

describe('prepareSave', () => {
  const current = { status: 'draft' as const, published_at: null, scheduled_at: null };
  const parsed = (over: Record<string, unknown> = {}) => {
    const result = parseArticleInput(raw(over));
    if (!result.ok) throw new Error(result.error);
    return result;
  };

  it('builds the fields, relations and revision note for a publish', () => {
    const plan = prepareSave({ input: parsed(), current, intent: 'publish', now: NOW });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.fields).toMatchObject({
      title: 'Rice prices climb',
      slug: 'rice-prices-climb',
      slug_auto: true,
      section_id: SECTION,
      status: 'published',
      published_at: NOW.toISOString(),
      word_count: 160,
      reading_minutes: 1,
    });
    expect(plan.fields.body_text).toBe('word '.repeat(160).trim());
    expect(plan).toMatchObject({ authors: [AUTHOR], tags: [], related: [], revision: 'Published', throttle: false });
  });

  it('checks the publish rules only for steps that put an article in front of readers', () => {
    const thin = parsed({ standfirst: '', body: { type: 'doc', content: [] } });
    expect(prepareSave({ input: thin, current, intent: 'save', now: NOW }).ok).toBe(true);
    expect(prepareSave({ input: thin, current, intent: 'publish', now: NOW })).toEqual({
      ok: false,
      errors: { standfirst: 'Add a standfirst: one or two sentences under the headline.', body: 'The article needs at least 150 words. It has 0.' },
    });
  });

  it('blocks any save while a field is malformed, and reads the schedule in WIB', () => {
    expect(prepareSave({ input: parsed({ slug: 'Bad Slug' }), current, intent: 'autosave', now: NOW })).toEqual({
      ok: false,
      errors: { slug: 'Use lowercase letters, numbers and single hyphens.' },
    });
    const plan = prepareSave({ input: parsed({ scheduledAt: '2026-11-14T09:00' }), current, intent: 'schedule', now: NOW });
    expect(plan.ok && plan.fields.scheduled_at).toBe('2026-11-14T02:00:00.000Z');
  });
});
```


### `tests/unit/slug-time.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { isSlug, RESERVED_SLUGS, slugify } from '@/lib/slug';
import { formatWib, parseWibInput, toWibInput, wibDayStart } from '@/lib/time';

describe('slugify', () => {
  it('turns a headline into a lowercase, hyphenated address', () => {
    expect(slugify('Rice prices climb as El Niño dries Java’s fields')).toBe('rice-prices-climb-as-el-nino-dries-javas-fields');
    expect(slugify('  Q3 GDP: 5.1% & rising!  ')).toBe('q3-gdp-5-1-and-rising');
    expect(slugify('Bank Indonesia ⇢ holds')).toBe('bank-indonesia-holds');
    expect(slugify('!!!')).toBe('');
  });

  it('keeps addresses to 80 characters, cutting at a hyphen when it can', () => {
    const slug = slugify('word '.repeat(40));
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith('-')).toBe(false);
    expect(slug.endsWith('word')).toBe(true);
    expect(slugify('a'.repeat(100))).toHaveLength(80);
  });

  it('recognises valid slugs and knows the reserved ones', () => {
    expect(isSlug('rice-prices')).toBe(true);
    expect(isSlug('Rice-prices')).toBe(false);
    expect(isSlug('rice--prices')).toBe(false);
    expect(isSlug('-rice')).toBe(false);
    expect(isSlug('')).toBe(false);
    expect(isSlug('a'.repeat(81))).toBe(false);
    expect(RESERVED_SLUGS).toContain('newsroom');
    expect(RESERVED_SLUGS).toContain('sitemaps');
  });
});

describe('WIB time', () => {
  it('reads a date-time input as Jakarta time and writes it back', () => {
    expect(parseWibInput('2026-11-14T09:00')?.toISOString()).toBe('2026-11-14T02:00:00.000Z');
    expect(parseWibInput('2026-11-14T03:30')?.toISOString()).toBe('2026-11-13T20:30:00.000Z');
    expect(toWibInput(new Date('2026-11-13T20:30:00Z'))).toBe('2026-11-14T03:30');
  });

  it('refuses inputs that are not real date-times', () => {
    expect(parseWibInput('')).toBeNull();
    expect(parseWibInput('2026-02-30T09:00')).toBeNull();
    expect(parseWibInput('2026-11-14 09:00')).toBeNull();
    expect(parseWibInput('2026-11-14T24:00')).toBeNull();
  });

  it('formats dates for the Newsroom in WIB', () => {
    const date = new Date('2026-11-13T14:40:00Z');
    expect(formatWib(date)).toBe('13 Nov 2026, 21:40');
    expect(formatWib(date, 'date')).toBe('13 Nov 2026');
    expect(formatWib(date, 'time')).toBe('21:40');
    expect(formatWib(date, 'short')).toBe('13 Nov · 21:40');
    expect(formatWib('2026-11-13T17:05:00Z', 'short')).toBe('14 Nov · 00:05');
  });

  it('finds the start of the WIB day', () => {
    expect(wibDayStart(new Date('2026-11-13T18:00:00Z')).toISOString()).toBe('2026-11-13T17:00:00.000Z');
    expect(wibDayStart(new Date('2026-11-13T16:59:00Z')).toISOString()).toBe('2026-11-12T17:00:00.000Z');
  });
});
```


### `tests/unit/taxonomy.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { parseAuthor, parseSection, parseTag } from '@/modules/taxonomy/validate';

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};

describe('parseSection', () => {
  it('fills the address from the name and trims the text', () => {
    expect(parseSection(form({ name: '  Business & Economy ', slug: '', description: ' Money. ', in_nav: 'on' }))).toEqual({
      values: { name: 'Business & Economy', slug: 'business-and-economy', description: 'Money.', inNav: true },
      errors: {},
    });
    expect(parseSection(form({ name: 'Law', slug: 'law-and-courts', description: '' })).values).toMatchObject({ slug: 'law-and-courts', inNav: false });
  });

  it('explains what is wrong with each field', () => {
    expect(parseSection(form({ name: '', slug: 'Bad Slug', description: 'x'.repeat(301) })).errors).toEqual({
      name: 'Give the section a name.',
      slug: 'Use lowercase letters, numbers and single hyphens.',
      description: 'Keep the description under 300 characters.',
    });
    expect(parseSection(form({ name: 'Search', slug: '', description: '' })).errors).toEqual({
      slug: 'The site already uses /search. Choose another address.',
    });
  });
});

describe('parseTag', () => {
  it('accepts a tag and limits the name', () => {
    expect(parseTag(form({ name: 'El Niño', slug: '', description: '' }))).toEqual({
      values: { name: 'El Niño', slug: 'el-nino', description: '' },
      errors: {},
    });
    expect(parseTag(form({ name: 'x'.repeat(61), slug: 'x', description: '' })).errors).toEqual({ name: 'Keep the name under 60 characters.' });
  });
});

describe('parseAuthor', () => {
  it('collects the profile links that are filled in', () => {
    const result = parseAuthor(
      form({
        name: 'Rani Prameswari',
        slug: '',
        role: 'Business correspondent',
        bio: 'Covers trade.',
        link_label_0: 'X',
        link_url_0: 'https://x.com/rani',
        link_label_1: '',
        link_url_1: '',
      }),
    );
    expect(result).toEqual({
      values: {
        name: 'Rani Prameswari',
        slug: 'rani-prameswari',
        role: 'Business correspondent',
        bio: 'Covers trade.',
        links: [{ label: 'X', url: 'https://x.com/rani' }],
      },
      errors: {},
    });
  });

  it('refuses links that are not web addresses', () => {
    const result = parseAuthor(form({ name: 'Rani', slug: '', role: '', bio: '', link_label_0: 'Mail', link_url_0: 'javascript:alert(1)' }));
    expect(result.errors).toEqual({ links: 'Each link needs a label and an address that starts with https:// or http://.' });
  });
});
```


### `tests/unit/youtube.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { youtubeId } from '@/lib/doc/youtube';

describe('youtubeId', () => {
  it('reads the common YouTube link shapes and bare IDs', () => {
    for (const link of [
      'dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s',
      'youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ?si=abc',
      'https://m.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      'https://www.youtube.com/live/dQw4w9WgXcQ',
    ]) {
      expect(youtubeId(link)).toBe('dQw4w9WgXcQ');
    }
  });

  it('refuses other sites and broken links', () => {
    expect(youtubeId('https://vimeo.com/12345678901')).toBeNull();
    expect(youtubeId('https://evil.example/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(youtubeId('https://www.youtube.com/watch?v=short')).toBeNull();
    expect(youtubeId('')).toBeNull();
  });
});
```


### `vitest.config.mts`

```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` throws outside React Server Components; unit tests import server modules directly.
      'server-only': fileURLToPath(new URL('./tests/stubs/empty.ts', import.meta.url)),
    },
  },
  test: {
    // Plain class names in rendered markup, so component tests read like the HTML they check.
    css: { modules: { classNameStrategy: 'non-scoped' } },
    projects: [
      { extends: true, test: { name: 'unit', include: ['tests/unit/**/*.test.{ts,tsx}'], environment: 'node' } },
      {
        extends: true,
        test: { name: 'db', include: ['tests/db/**/*.test.ts'], environment: 'node', fileParallelism: false, testTimeout: 30000, hookTimeout: 60000 },
      },
    ],
  },
});
```
