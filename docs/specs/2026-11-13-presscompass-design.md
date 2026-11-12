# PressCompass · Design Spec (website + Newsroom CMS)

**Tanggal:** 2026-11-13
**Status:** disetujui pemilik 13 November 2026, dibangun mulai v0.1.0. Revisi v0.1.1: satu proyek Supabase. v0.2.0: Newsroom inti (lihat catatan lingkup di §17).
**Pemilik:** pemilik PressCompass (pengguna CMS tunggal)
**Desain:** design system https://claude.ai/artifact/D3Mgp73bxchiin6SNrCxS3 dan preview `presscompass-preview.html` (Front page, Article, Newsroom CMS)
**Catatan brand:** PROJECT WEB `claude/presscompass-brand-design-spec.md`
**Proyek pembanding:** point.lat (`claude/point-lat-decisions.md`). Pola yang sudah terbukti di sana dipakai ulang: Mesin Indexing, cron Supabase, alur zip, dan aturan Vercel Hobby.

---

## 1. Ringkasan

PressCompass adalah media berita umum tentang Indonesia **berbahasa Inggris** di presscompass.site. Situs publik dan CMS-nya (Newsroom) dibangun dalam satu aplikasi Next.js di **Vercel Hobby (gratis)**, dengan **Supabase Free** sebagai database dan login, dan **Cloudinary Free** untuk semua gambar. Tanpa Docker dan tanpa layanan berbayar.

Aplikasi tersambung ke Supabase hanya lewat kredensial bawaan proyek Supabase: Project URL, **publishable key**, dan **secret key**. Semua yang tampil di situs (artikel, halaman, beranda, menu, footer, teks situs, pengaturan SEO) disimpan di Supabase dan diedit dari Newsroom. Setiap konten yang terbit atau berubah besar otomatis dikabarkan ke mesin pencari, dan status indeksnya dipantau dari CMS.

### Kriteria sukses

1. Pemilik bisa mengubah semua isi dan tata letak situs (artikel, halaman, beranda, menu, footer, teks situs, SEO) dari Newsroom tanpa menyentuh kode.
2. Setiap terbit tercatat di log indexing dengan hasil tiap langkah, dan status indeks Google tampil di daftar artikel dalam 7 hari.
3. Halaman artikel dan beranda lolos ambang "baik" Core Web Vitals di uji lab HP: LCP < 2,5 dtk, INP < 200 ms, CLS < 0,1.
4. Seluruh teks situs dan CMS berbahasa Inggris; tidak ada kalimat bahasa Indonesia di situs.
5. Seluruh biaya bulanan Rp0 selama situs non-komersial dan pemakaian di bawah kuota gratis (§19).

## 2. Keputusan

| Topik | Keputusan (sumber) |
|---|---|
| Desain | Dikunci: design system PressCompass dan preview HTML (pemilik, 13 Nov) |
| Logo utama | Simbol jarum mata pena + logotype satu baris (pemilik, 12 Nov) |
| Bahasa | Situs dan CMS hanya bahasa Inggris, British English (pemilik, 12 Nov) |
| Stack | Next.js (App Router) + Supabase + Vercel, semuanya paket gratis. Node 26, npm (pemilik, 13 Nov) |
| CMS | **Kustom native Supabase**: Supabase Auth dan Postgres + RLS, lewat API key Supabase. Tanpa Payload atau CMS pihak ketiga (pemilik, 13 Nov) |
| Hosting | Vercel **Hobby**. Sah karena situs **non-komersial** (pemilik, 13 Nov). Pindah ke Pro sebelum ada iklan, langganan berbayar, atau konten bersponsor |
| Pengguna CMS | Pemilik sendiri, satu akun admin (pemilik, 13 Nov) |
| Pengiriman | Zip bernomor versi + perintah terminal npm, seperti point.lat (pemilik, 13 Nov) |
| Docker | Tidak dipakai di mana pun (pemilik, 13 Nov) |
| Indexing | Sitemap + Search Console API + IndexNow + URL Inspection. Google Indexing API opsional, mati bawaan (resmi hanya untuk JobPosting dan BroadcastEvent) |
| Jadwal | Supabase Cron setiap 5 menit memanggil endpoint aplikasi; cron Vercel harian sebagai cadangan |
| Proyek Supabase | **Satu** proyek `presscompass` untuk produksi, Preview Vercel, dan komputer pemilik (pemilik, 13 Nov, v0.1.1) |
| Media | **Cloudinary** untuk semua gambar (pemilik, 13 Nov): unggah langsung dari browser, ukuran dan format otomatis `f_auto,q_auto` dari CDN Cloudinary. Supabase Storage tidak dipakai |

## 3. Brand dan bahasa

Brand, logo, warna, tipografi, komponen, dan aturan suara ada di design system. Ringkasnya:

- **Logo:** simbol jarum mata pena + logotype PressCompass satu baris, ujung utara merah `compass-mark`.
- **Tagline:** "News with a sense of direction."
- **Warna:** paper `#f6f4ef`, ink/navy `#0f1e33`, compass `#b83a24` (UI) dan `#c8432b` (logo), meridian `#22507c`. Tema terang dan gelap, semua pasangan teks lolos AA.
- **Huruf:** Newsreader (berita), IBM Plex Sans (antarmuka dan CMS), IBM Plex Mono (waktu dan angka), di-host sendiri.
- **Suara:** tenang dan analitis, British English, judul sentence case, tanpa tanda seru dan clickbait.
- **Format:** `2.1%`, `Rp12,400`, `Thursday, 12 November 2026`, `19:50 WIB (UTC+7)`.

**Bahasa CMS:** Newsroom juga berbahasa Inggris (Draft, In review, Scheduled, Published, Archived), sesuai preview yang dikunci. Dokumen untuk pemilik (spesifikasi, rencana, runbook, CHANGELOG) tetap berbahasa Indonesia.

## 4. Arsitektur

```
Browser pembaca ──► Vercel CDN ──► Next.js (App Router, region sin1)
                                     ├─ Situs publik (dirender server, cache bertag, revalidasi saat terbit)
                                     ├─ /newsroom (CMS, hanya pemilik yang masuk)
                                     └─ /api/* (form, cron, revalidasi, indexing, tanda tangan unggah)
                                   ├──► Supabase (Singapura): Postgres + RLS, Auth
                                   ├──► Google Search Console API dan URL Inspection API
                                   └──► IndexNow (api.indexnow.org)
Browser (Newsroom) ──► Cloudinary (unggah langsung dengan tanda tangan dari server)
Browser pembaca ──► CDN Cloudinary (gambar f_auto,q_auto)
Supabase Cron (pg_cron + pg_net) ──► GET /api/cron/run setiap 5 menit (rahasia dari Supabase Vault)
Vercel Cron ──► GET /api/cron/run sekali sehari (cadangan, batas Hobby)
```

### Kredensial Supabase (sinkron lewat API key bawaan)

| Env | Isi | Dipakai di |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | server dan browser |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` | situs publik (baca konten terbit) dan CMS di browser (login) |
| `SUPABASE_SECRET_KEY` | `sb_secret_...` | **hanya server**: cron, indexing, form pembaca, log |

Kredensial Cloudinary: `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` (nama cloud, publik di URL gambar), `CLOUDINARY_API_KEY` dan `CLOUDINARY_API_SECRET` (**hanya server**, untuk tanda tangan unggah dan hapus).

Kunci lama `anon` dan `service_role` tidak dipakai karena Supabase menghentikannya akhir 2026. Secret key tidak pernah dikirim ke browser, tidak masuk repo, dan tidak tampil di CMS.

### Tiga jalur akses data

1. **Situs publik:** komponen server membaca lewat publishable key (peran `anon`). RLS hanya mengizinkan baris yang sudah terbit. Hasilnya di-cache dengan tag dan dibuang saat konten terbit atau berubah.
2. **Newsroom:** pemilik masuk lewat Supabase Auth (sesi di cookie lewat `@supabase/ssr`). Semua perubahan lewat Server Actions dengan sesi pemilik (peran `authenticated`), dijaga RLS `is_staff()`.
3. **Pekerjaan sistem:** cron, antrean indexing, form pembaca, dan log memakai secret key di route handler server.

Pembaca tidak pernah menulis langsung ke Supabase. Form newsletter, kontak, dan log 404 lewat route handler server dengan anti-spam, lalu ditulis memakai secret key.

### Rendering dan cache

- Halaman publik dirender server dan disimpan cache dengan tag: `article:{id}`, `section:{slug}`, `author:{slug}`, `tag:{slug}`, `page:{slug}`, `home`, `nav`, `settings`, `sitemap`.
- Terbit, batal terbit, hapus, dan perubahan besar membuang tag yang terdampak. Simpan draf tidak menyentuh situs.
- JavaScript klien di situs hanya untuk sakelar tema, menu HP, pencarian, form newsletter, dan salin tautan.
- API cache Next.js yang tepat (`'use cache'` + `cacheTag` atau fungsi cache yang setara) dipilih di Rencana 1 dari dokumentasi Next.js terbaru, lalu dibungkus satu modul supaya mudah diganti.

### Jadwal dan pekerjaan latar

- Endpoint `GET /api/cron/run` dengan `Authorization: Bearer CRON_SECRET` menjalankan semua pekerjaan yang jatuh tempo: terbit terjadwal, antrean indexing, cek status indeks, sinkron Search Console harian, pindai tautan, dan pembersihan log.
- **Supabase Cron** (`pg_cron` + `pg_net`) memanggil endpoint itu setiap 5 menit dengan rahasia dari Supabase Vault. Gratis, dan sekaligus menjaga proyek Supabase Free tidak dijeda karena sepi.
- **Vercel Cron** sekali sehari sebagai cadangan (Hobby hanya mengizinkan sekali sehari per jadwal).
- Saat konten terbit, antrean langsung dijalankan lewat `after()` Next.js, jadi kabar ke mesin pencari tidak menunggu cron.
- Klaim pekerjaan atomik (`UPDATE ... RETURNING`), jadi panggilan ganda aman.

### Lingkungan (tanpa Docker)

| Tempat | Supabase |
|---|---|
| Produksi (`presscompass.site`), deploy Preview Vercel, dan komputer pemilik (`npm run dev`) | satu proyek `presscompass` (Free, Singapura), env yang sama di semua lingkungan Vercel dan di `.env` |
| Tes otomatis | Postgres bawaan runner CI dan Supabase tiruan; tidak pernah Supabase sungguhan |

- Keputusan pemilik 13 November 2026 (v0.1.1): satu proyek saja. Draf tetap tersembunyi dari pembaca karena RLS, dan jatah 2 proyek gratis Supabase tidak terpakai habis.
- Akibatnya `npm run dev` dan deploy Preview membaca dan menulis data produksi. Karena itu adapter layanan luar (Google, IndexNow) wajib `fake` di luar Vercel Production, dan migrasi selalu lulus CI dulu sebelum `npm run db:push`.
- Aplikasi menolak berjalan bila `app_meta.project` bukan `presscompass`: kunci proyek lain (misalnya point.lat) atau migrasi yang belum diterapkan.

### Skema database (migrasi)

- Migrasi berupa file SQL di `supabase/migrations/`, berurutan dan hanya menambah.
- Cara menjalankan, berurutan dari yang dipilih:
  1. Claude menjalankan migrasi lewat koneksi Supabase di sesi ini, bila proyek ada di akun Supabase yang tersambung ke Claude.
  2. `npx supabase db push` dari komputer pemilik (tanpa memasang CLI; sekali `npx supabase link` dengan password database). Bahwa perintah ini berjalan tanpa Docker diverifikasi di Rencana 1 sebelum dijadikan langkah resmi.
  3. Cadangan: tempel file SQL di SQL Editor Supabase.
- Tipe TypeScript database dibuat Claude dan di-commit, jadi pemilik tidak perlu menjalankan generator.

### Struktur folder (rencana)

```
presscompass/
  CLAUDE.md                     aturan proyek
  CHANGELOG.md                  riwayat versi (bahasa Indonesia)
  docs/specs/  docs/plans/  docs/ops/
  supabase/migrations/          SQL berurutan
  supabase/seed/                data awal (pengaturan, menu, halaman wajib)
  src/app/(site)/               situs publik
  src/app/newsroom/             CMS
  src/app/api/                  cron, form, revalidasi, indexing
  src/modules/{content,editor,media,seo,indexer,monitor,forms,auth}/
  src/components/site/  src/components/newsroom/  src/components/ds/
  src/styles/tokens.css         token dari design system
  tests/unit/  tests/db/  tests/e2e/
```

## 5. Modul (antarmuka kecil, implementasi dalam)

| Modul | Antarmuka | Di dalamnya | Adapter |
|---|---|---|---|
| `content` | `getPublished(kind, key)`, `listPublished(query)`, `getLayout('home' \| 'nav' \| 'settings')` | query Supabase, bentuk data siap render, tag cache | `supabase` (publishable key), `memory` untuk tes E2E publik |
| `editor` | `saveDraft`, `transition(id, action)`, `restoreRevision` (Server Actions) | validasi per status, alur status, jadwal, revisi, slug dan redirect otomatis, pemicu revalidasi dan indexing | sesi pemilik + RLS |
| `media` | `signUpload(staff) → signature`, `registerUpload(result) → media`, `imageUrl(media, preset)` | tanda tangan unggah, preset transformasi, loader `next/image`, hapus aset | `cloudinary`, `fake` untuk tes dan pratinjau tanpa kredensial |
| `seo` | `metadata(doc, settings)`, `jsonLd(doc, settings)`, `analyse(doc) → checks` | aturan judul, meta, canonical, robots, schema per jenis, checklist panel SEO, cek tulisan | fungsi murni |
| `indexer` | `notify(events)`, `runIndexer(now)` | antrean, dedup, jendela kirim, retry 1/5/30 menit, kuota harian, cek status bertahap, log | `real` (Search Console, URL Inspection, IndexNow, Indexing API), `fake` (dipilih `INDEXER_ADAPTER`) |
| `monitor` | `runMonitor(now)`, `getDashboard(period)` | sinkron Search Analytics, pindai tautan, halaman yatim, ringkasan dashboard | `real`, `fake` |
| `forms` | `subscribe(input, req)`, `sendMessage(input, req)`, `log404(input, req)` | validasi, kolom jebakan, `Sec-Fetch-Site`, batas laju per sidik HMAC (IP tidak disimpan) | secret key |
| `auth` | `requireStaff()`, `signIn`, `signOut` | sesi `@supabase/ssr`, pengecekan peran, MFA | Supabase Auth |

## 6. Model data (Supabase Postgres)

Semua tabel di skema `public` dengan RLS menyala. Peran `anon` hanya bisa `SELECT` baris yang terbit dan tabel tampilan publik. Peran `authenticated` hanya bisa menulis bila `is_staff()` benar (baris di `staff` untuk `auth.uid()`). Tabel sistem (antrean, log, analitik, pembaca) tidak terbuka untuk `anon` sama sekali.

### Konten

| Tabel | Kolom utama |
|---|---|
| `articles` | `title`, `slug`, `section_id`, `type` (news, analysis, explainer, opinion, feature), `kicker_label` opsional, `standfirst`, `body` (JSON dokumen editor), `body_text` (teks polos untuk pencarian dan hitung kata), `lead_media_id`, `lead_caption`, `status` (draft, review, scheduled, published, archived), `scheduled_at`, `published_at`, `updated_at`, `major_update_at` (dasar `lastmod`), `is_breaking`, `seo` (JSON: title, description, keyphrase, secondary, canonical, noindex, og_media_id), `sources` (JSON: judul, URL, penerbit, tanggal akses), `word_count`, `reading_minutes`, `search` (tsvector bahasa Inggris, generated) |
| `article_authors` | `article_id`, `author_id`, `position` |
| `article_tags` | `article_id`, `tag_id` |
| `article_related` | `article_id`, `related_id`, `position` (pilihan editor; sisanya otomatis dari rubrik dan tag) |
| `article_revisions` | `article_id`, `snapshot` (JSON), `note`, `created_at`. Disimpan 50 versi terakhir per artikel |
| `sections` | `name`, `slug`, `description`, `position`, `in_nav`, `seo` |
| `tags` | `name`, `slug`, `description` |
| `authors` | `name`, `slug`, `role` (business correspondent dsb.), `bio`, `photo_media_id`, `links` (JSON) |
| `pages` | `title`, `slug`, `blocks` (JSON page builder), `status`, `seo`, `published_at` |
| `media` | `public_id` Cloudinary, `kind` (image), `format`, `alt`, `caption`, `credit`, `width`, `height`, `bytes`, `original_name` |
| `redirects` | `from_path`, `to_path`, `code` (301, 308, 410), `auto`, `hits` |

### Tampilan dan pengaturan (satu baris per kunci, versi draf dan terbit)

| Kunci | Isi |
|---|---|
| `home` | daftar blok beranda (§7) |
| `nav` | menu utama rubrik, tautan baris atas (Newsletters, Sign in), label tombol Subscribe, kolom footer, tautan sosial |
| `site` | nama, tagline, deskripsi, teks "about" di footer, email kontak, pengaturan pita Latest (aktif, jam ke belakang, jumlah), teks blok newsletter, tema bawaan |
| `seo` | pola judul, meta bawaan, gambar OG bawaan, nama publikasi Google News, organisasi (logo, sameAs), kode verifikasi, aturan robots tambahan, Mesin Indexing (kunci IndexNow, properti Search Console, batas cek harian, sakelar Indexing API dan kuotanya) |

Disimpan di tabel `layouts` (`key`, `draft` JSON, `published` JSON, `published_at`). Situs hanya membaca kolom `published`; tombol Publish di CMS menyalin draf ke terbit lalu membuang tag terkait.

### Sistem (hanya secret key dan pemilik)

`indexing_queue`, `indexing_log`, `index_status`, `search_daily`, `search_pages`, `monitor_tasks`, `link_findings`, `external_links`, `not_found_log`, `newsletter_subscribers`, `contact_messages`, `rate_limits` (sidik HMAC, kedaluwarsa 24 jam), `staff`, `app_meta`.

File gambar disimpan di Cloudinary (§11); Supabase hanya menyimpan data gambarnya (`media`).

## 7. Newsroom (CMS)

Alamat `/newsroom`, tampilan mengikuti preview Newsroom yang dikunci: sidebar `paper-sunken`, panel `paper-raised` dengan `radius-md`, teks antarmuka IBM Plex Sans. Login di `/newsroom/login` (email dan password, pendaftaran publik dimatikan, MFA TOTP Supabase disarankan).

### Menu

| Grup | Halaman |
|---|---|
| — | **Dashboard**: kartu Published today, In review, Scheduled, Drafts; ringkasan Google 28 hari (klik, impresi); status indeks; Needs attention (kabar Google gagal, tautan rusak, 404 baru, artikel tanpa meta) |
| Content | **Articles**, **Pages**, **Homepage**, **Sections**, **Tags**, **Authors**, **Media** |
| Site | **Navigation and footer**, **Site settings** |
| SEO | **SEO dashboard**, **Index status**, **Indexing log**, **Redirects**, **404 log**, **Link checker**, **SEO settings** |
| Readers | **Newsletter subscribers** (unduh CSV), **Messages** |
| — | **Account** (profil, password, MFA) |

### Artikel

- **Daftar:** tab status dengan jumlah (All, Drafts, In review, Scheduled, Published, Archived), cari, filter rubrik dan penulis, kolom status indeks, aksi massal (publish, unpublish, archive, delete).
- **Editor:**
  - judul, standfirst, slug (otomatis dari judul, bisa diubah), rubrik, jenis, penulis (urutan), tag;
  - gambar utama dan keterangannya;
  - isi dengan editor blok berbasis **Tiptap** (inti berlisensi MIT, tanpa ekstensi berbayar);
  - sumber, artikel terkait, tanda breaking;
  - tab SEO (§9);
  - kotak status: Save draft, Send for review, Schedule (tanggal dan jam WIB), Publish, Unpublish, Archive. Hanya satu tombol utama, yaitu langkah maju berikutnya;
  - sakelar **Major update** (mengubah `major_update_at` dan memicu kabar ke mesin pencari);
  - autosave draf setiap 10 detik bila ada perubahan;
  - riwayat versi dengan Restore;
  - **Preview** draf di tampilan situs asli, hanya untuk pemilik yang masuk.
- **Blok isi:** paragraf, H2, H3, daftar, kutipan, **Pull quote**, gambar (dengan keterangan dan kredit), **Key figures** (2 sampai 4 angka + sumber), **Chart** (batang atau garis dari tabel kecil, digambar SVG oleh situs), tabel, catatan editor (update atau koreksi), tautan artikel (kartu "Read more"), embed video YouTube (memuat pemutar hanya setelah diklik), pemisah.
- **Aturan terbit** (diblokir bila gagal): judul, slug unik, rubrik, satu penulis, standfirst, gambar utama dengan alt, isi minimal 150 kata. Aturan SEO lain hanya peringatan.

### Halaman, Beranda, Navigasi

- **Pages:** halaman statis (About, Editorial standards, Corrections, Contact, Privacy, Terms) dengan page builder: teks, judul seksi, kartu, FAQ, form kontak, form newsletter, daftar tim.
- **Homepage:** blok yang bisa ditambah, diurutkan, disembunyikan, dan diedit, lalu Publish:
  1. Lead + Top stories (otomatis dari terbaru, atau dipilih editor);
  2. Section row (rubrik, jumlah 3 sampai 8);
  3. Data band (kicker, judul, teks, tautan, angka, grafik);
  4. Opinion (otomatis dari jenis opinion);
  5. Most read + Newsletter (Most read dari klik Google 7 hari bila cukup, selain itu terbaru dengan judul berbeda);
  6. Teks bebas.
  
  Judul setiap blok ("Top stories", "Most read") bisa diubah.
- **Navigation and footer:** menu rubrik, tautan baris atas, label Subscribe, kolom footer, tautan sosial, teks hak cipta.
- **Site settings:** nama, tagline, deskripsi, email, pita Latest, teks newsletter, tema bawaan (ikuti perangkat, terang, gelap).

Semua teks yang terlihat pembaca bisa diedit dari CMS. Pengecualian: label teknis untuk pembaca layar dan pesan galat sistem (misalnya "Page not found") tetap di kode, karena harus konsisten dan teruji.

## 8. Situs publik dan URL

| Rute | Isi |
|---|---|
| `/` | beranda dari blok `home` |
| `/{section}` | rubrik; halaman berikutnya `/{section}/page/{n}` (24 per halaman) |
| `/{section}/{slug}` | artikel |
| `/author/{slug}`, `/tag/{slug}` | profil penulis dan tag, berhalaman |
| `/{page}` | halaman statis (About, Contact, dll.) |
| `/search` | pencarian teks penuh Postgres (noindex) |
| `/newsletter`, `/newsletter/unsubscribe` | daftar dan berhenti |
| `/sitemap.xml`, `/sitemaps/{kind}.xml`, `/news-sitemap.xml`, `/feed.xml`, `/{section}/feed.xml`, `/robots.txt`, `/{indexnow-key}.txt` | teknis |

- Slug rubrik dan halaman tidak boleh bentrok (dicek di CMS). Kata `page`, `author`, `tag`, `search`, `newsletter`, `newsroom`, `api` dicadangkan.
- Mengganti slug artikel atau memindah rubrik membuat redirect 308 otomatis dari alamat lama.
- Layout mengikuti preview: baris atas (tanggal, Newsletters, Sign in, Subscribe), masthead dengan logo utama di tengah, navigasi rubrik dengan penanda merah untuk rubrik aktif, pita Latest, footer navy.
- "Sign in" di baris atas disembunyikan secara bawaan (belum ada akun pembaca) dan bisa dinyalakan nanti.
- Tema gelap mengikuti perangkat, dengan sakelar di footer (skrip kecil sebelum paint, tanpa kedip).

## 9. SEO

### Panel SEO di editor

1. Keyphrase utama dan sekunder.
2. Checklist (hijau, kuning, merah; hanya peringatan):
   - judul SEO 50 sampai 60 karakter, meta 140 sampai 160;
   - keyphrase di judul, slug, standfirst, dan 100 kata pertama;
   - H2/H3 berurutan;
   - 3 sampai 5 tautan internal, minimal 1 sumber luar;
   - semua gambar ber-alt, gambar utama minimal 1200 px;
   - panjang kalimat rata-rata, kalimat pasif, tingkat keterbacaan bahasa Inggris.
3. **Writing check** di browser tanpa biaya: menandai pola tulisan AI dan klise bahasa Inggris (berdasarkan skill humanizer), tanda seru, serta kalimat berangka tanpa sumber.
4. Peringatan kanibalisasi: keyphrase yang sama sudah dipakai artikel lain.
5. Saran tautan internal dari rubrik dan tag yang sama.
6. Pratinjau hasil Google (desktop dan HP) dan kartu sosial.
7. Canonical, noindex, gambar OG khusus, sakelar Major update.

### Tingkat situs

- Metadata lengkap: title dengan pola, description, canonical, `robots` dengan `max-image-preview:large`, Open Graph, kartu X.
- **Gambar OG otomatis** per artikel lewat `next/og`: latar paper, kicker, judul Newsreader, logo utama. Dipakai bila editor tidak memilih gambar OG.
- JSON-LD: `NewsArticle` (jenis news), `Article` (analysis, explainer, feature), `OpinionNewsArticle` (opinion), `BreadcrumbList`, `NewsMediaOrganization` (logo, sameAs, kebijakan redaksi dan koreksi), `Person` (penulis), `WebSite`.
- Sitemap index per jenis (artikel per bulan, rubrik, penulis, tag, halaman). `lastmod` hanya berubah saat terbit atau Major update.
- **Google News sitemap:** artikel 48 jam terakhir, maksimal 1.000.
- RSS seluruh situs dan per rubrik.
- `robots.txt` dari SEO settings dan merujuk sitemap index.
- Redirect: manual di CMS dan otomatis saat slug atau rubrik berganti. Log 404 dengan tombol "Create redirect".
- Pemeriksa tautan: tautan internal rusak dan halaman yatim dipindai harian, tautan luar dicek mingguan secara bertahap.
- Halaman paginasi punya canonical sendiri, tetap diindeks, tetapi tidak masuk sitemap.

### Dashboard SEO

Klik, impresi, CTR, dan posisi untuk periode 7, 28, dan 90 hari dibanding periode sebelumnya, grafik klik harian, halaman teratas, status indeks, log indexing, tautan rusak, halaman yatim, dan 404 teratas. Data Search Console disinkron sekali sehari. Tanpa kredensial Google, setiap bagian menjelaskan sebabnya.

## 10. Mesin Indexing (otomatis)

Pemicu: terbit, Major update, pindah alamat, batal terbit, dan hapus, untuk artikel, halaman, rubrik, dan penulis. Halaman noindex dianggap tidak publik.

| Langkah | Detail |
|---|---|
| 1. Revalidasi | buang tag halaman, rubrik, beranda, dan sitemap |
| 2. Search Console | `sitemaps.submit` sitemap index dan news sitemap, paling sering sekali per 30 menit; kabar di antaranya digabung |
| 3. IndexNow | satu POST untuk semua URL yang antre ke `api.indexnow.org`, paling sering sekali per 5 menit (Bing, Yandex, Naver, Seznam, Yep) |
| 4. Google Indexing API (opsional) | hanya bila sakelar dinyalakan, dengan peringatan bahwa Google hanya mengizinkannya untuk JobPosting dan BroadcastEvent; kuota dari CMS |
| 5. Cek status | URL Inspection pada +6 jam, +24 jam, +3 hari, +7 hari, +14 hari, +30 hari; berhenti saat Indexed; batas harian dari CMS (bawaan 1.000 dari kuota Google 2.000 per properti). Tombol "Check now" per URL |
| 6. Log | setiap langkah tercatat dengan hasil, kode HTTP, dan pesan |

- Gagal: diulang 3 kali dengan jeda 1, 5, dan 30 menit, lalu tampil di Needs attention. Kuota Google habis (429): ditunda ke tengah malam waktu Pasifik.
- Tanpa pustaka Google: token akses dari JWT RS256 akun layanan (`node:crypto`).
- Ping sitemap Google tidak dipakai, karena Google sudah menghentikannya pada 2023.
- **Batas yang perlu dipahami:** sistem memastikan Google dan mesin pencari lain langsung tahu ada URL baru. Kapan dan apakah URL itu masuk indeks tetap keputusan Google, dan status itu yang dipantau di CMS.

## 11. Media: Cloudinary

Keputusan pemilik 13 November 2026: semua gambar lewat Cloudinary, sama dengan point.lat.

- **Unggah dari Newsroom:** browser mengunggah langsung ke Cloudinary dengan tanda tangan dari `POST /api/media/sign` (hanya pemilik yang masuk). File tidak lewat fungsi Vercel, jadi batas unggah server sekitar 4,5 MB tidak berlaku. Setelah unggah, data hasilnya (public ID, ukuran, format, byte) disimpan ke tabel `media`.
- **Transformasi saat masuk:** gambar dibatasi lebar maksimal 2560 px dengan `q_auto`, supaya penyimpanan kecil. Folder `presscompass/images`.
- **Pengiriman:** loader `next/image` khusus Cloudinary membuat `srcset` dengan `f_auto,q_auto` (AVIF atau WebP sesuai peramban) dan potongan per preset (`hero` 16:9, `card` 3:2, `square` 1:1 untuk avatar). Optimasi gambar Vercel tidak dipakai, jadi kuota 5.000 transformasi Hobby tidak tersentuh.
- `width` dan `height` selalu diisi (CLS 0). Gambar di bawah lipatan dimuat lambat, gambar utama beranda dan artikel diprioritaskan (LCP).
- Alt wajib sebelum gambar dipakai di artikel terbit. Keterangan dan kredit opsional.
- **Pustaka media:** cari, filter, ganti alt atau keterangan, lihat dipakai di artikel mana, dan hapus bila tidak dipakai (aset di Cloudinary ikut dihapus).
- **Tanpa kredensial** (tes, pratinjau awal) aplikasi memakai adapter `fake`; di produksi aplikasi menolak berjalan tanpa kredensial Cloudinary.
- Gambar OG otomatis tetap dibuat `next/og` (§9), bukan Cloudinary.

## 12. Performa, aksesibilitas, motion

| Anggaran | Nilai |
|---|---|
| LCP (lab HP) | < 2,5 dtk |
| INP | < 200 ms |
| CLS | < 0,1 |
| JS klien situs | total < 160 KiB gzip per halaman; JS milik PressCompass < 15 KB |
| Font | Newsreader variable dan IBM Plex di-host sendiri lewat `next/font/local`, subset Latin, satu preload |

- WCAG 2.2 AA: kontras token (§3), `focus-ring` meridian, skip link, heading berurutan, label terlihat, target sentuh 44 px, `lang="en"`.
- Motion mengikuti design system: 120, 200, dan 320 ms `ease-out`. Tidak ada animasi yang berjalan terus; semua mati saat `prefers-reduced-motion`.

## 13. Keamanan dan privasi

- RLS di semua tabel; `anon` hanya membaca konten terbit. Uji RLS otomatis di CI (§15).
- Secret key, `CRON_SECRET`, `HMAC_SECRET`, dan JSON akun layanan Google hanya di env server Vercel.
- Login Newsroom: pendaftaran dimatikan, password minimal 15 karakter, MFA TOTP disarankan, dan semua halaman `/newsroom` memeriksa sesi dan peran di server.
- Header keamanan: CSP, `nosniff`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`. HSTS dari Vercel.
- Form pembaca: kolom jebakan, `Sec-Fetch-Site`, isian maksimal 10 KB, batas laju per sidik HMAC harian (IP tidak disimpan, dihapus 24 jam).
- Tanpa cookie pelacak dan tanpa skrip pihak ketiga, jadi tidak perlu banner persetujuan. YouTube hanya dimuat setelah diklik.
- Halaman Privacy menjelaskan data newsletter dan form kontak; pesan kontak dihapus otomatis setelah 12 bulan.

## 14. Penanganan galat

| Situasi | Perilaku |
|---|---|
| Validasi terbit gagal | pesan di isian terkait; simpan draf tetap bisa |
| Simpan bertabrakan (dua tab) | versi diperiksa; pesan "This article changed in another window" dengan pilihan muat ulang |
| Unggah gambar gagal | pesan di dialog, file tidak tersimpan setengah |
| Langkah indexing gagal | diulang, lalu Needs attention; publikasi tetap berhasil |
| Supabase tidak terjangkau | situs tetap menyajikan cache terakhir; CMS menampilkan pesan koneksi |
| 404 | halaman 404 dengan pencarian dan tulisan terbaru, dicatat di log 404 |
| 500 | halaman galat statis, log Vercel |

## 15. Testing dan CI

- **Unit (Vitest):** `seo`, `indexer` (dengan adapter palsu dan repo memori: dedup, jendela, retry, kuota, urutan cek), konversi dokumen editor ke HTML, slug dan redirect, aturan terbit, URL gambar Cloudinary per preset.
- **Database:** migrasi dijalankan di Postgres bawaan runner GitHub Actions dengan skema `auth` tiruan (peran `anon`, `authenticated`, fungsi `auth.uid()`), lalu tes RLS: `anon` tidak bisa membaca draf, tidak bisa menulis apa pun, dan pemilik bisa.
- **E2E (Playwright):** terhadap build produksi dan Supabase tiruan (`tests/fake-supabase/`): Auth tiruan + Data API yang menjalankan SQL sungguhan di PostgreSQL lokal dengan peran dan RLS Supabase. Alur Newsroom penuh (rubrik, tag, penulis, editor, status, jadwal, riwayat, konflik, aksi massal, axe) diuji di setiap push; situs publik menyusul dengan cara yang sama.
- **Kualitas:** Lighthouse CI (beranda, artikel, rubrik), axe, design-audit sebelum rilis.
- **CI:** setiap push dan pull request: type check, lint, unit, database, build, E2E, Lighthouse. Tanpa Docker dan tanpa rahasia produksi.

## 16. Cakupan

**MVP:** semua di §6 sampai §11. Newsroom lengkap (artikel, halaman, beranda, navigasi, pengaturan, media, rubrik, tag, penulis), situs publik, panel dan dashboard SEO, Mesin Indexing, newsletter tersimpan, form kontak, mode gelap, RSS, gambar OG otomatis.

**Fase 2 (bila diminta):**
- live blog (`LiveBlogPosting`);
- statistik kunjungan first-party;
- asisten AI di editor;
- pengiriman newsletter;
- akun pembaca;
- iklan (wajib Vercel Pro).

**Di luar cakupan:** paywall, komentar, multi-bahasa, aplikasi mobile, plugin unggahan.

## 17. Peta rencana implementasi

Setiap rencana ditulis tepat sebelum dikerjakan (skill writing-plans), dieksekusi task demi task dengan review, lalu dikirim sebagai zip bernomor versi.

Catatan lingkup v0.2.0: blok gambar dan gambar utama pindah ke Rencana 3 (butuh pustaka media), blok Chart ke Rencana 4 (digambar SVG oleh situs), tab SEO editor tetap Rencana 6. Terbit terjadwal berjalan saat Newsroom dibuka (`publish_due_articles()`); pemanggil otomatis datang bersama situs publik.

| Rencana | Isi | Versi |
|---|---|---|
| 1. Fondasi | proyek Next.js (npm, Node 26), token dan font dari design system, komponen dasar, skema Supabase v1 + RLS, tiga klien Supabase, login Newsroom, penjaga lingkungan, CI, `CLAUDE.md` | v0.1.0 |
| 2. Newsroom inti | kerangka CMS, Rubrik, Tag, Penulis, Artikel (editor blok, alur status, jadwal, autosave, revisi, pratinjau) | v0.2.0 |
| 3. Media Cloudinary | unggah bertanda tangan, transformasi masuk, loader `next/image`, pustaka dan pemilih media, gambar utama + keterangan, blok gambar, aturan terbit "gambar utama dengan alt" | v0.3.0 |
| 4. Situs publik | beranda, artikel, rubrik, penulis, tag, halaman, cari, 404, header, footer, pita Latest, mode gelap, cache bertag, blok Chart (SVG), endpoint cron untuk terbit terjadwal + revalidasi | v0.4.0 |
| 5. Semua bisa diedit | penyusun beranda, page builder, navigasi dan footer, pengaturan situs, newsletter, form kontak, Pembaca | v0.5.0 |
| 6. SEO | metadata, JSON-LD, sitemap + news, RSS, robots, OG otomatis, redirect, log 404, panel SEO dan Writing check | v0.6.0 |
| 7. Mesin Indexing + Dashboard SEO | antrean, adapter Google dan IndexNow, Supabase Cron, status indeks, Search Analytics, dashboard, pemeriksa tautan | v0.7.0 |
| 8. Rilis | header keamanan, cadangan mingguan, Lighthouse, runbook, domain, Search Console, rilis produksi | v1.0.0 |

## 18. Setup dari pemilik

1. **GitHub:** repo privat baru `presscompass` (pemilik yang membuat dan mendorong).
2. **Vercel Hobby:** proyek dari repo itu, region fungsi `sin1`, domain `presscompass.site`.
3. **Supabase:** satu proyek Free `presscompass` di Singapura.
   - Project URL, publishable key, secret key (Settings, API Keys). Isi ke env Vercel (semua lingkungan) dan `.env` lokal, tidak pernah ke percakapan atau repo.
   - Authentication: matikan pendaftaran, buat satu pengguna (email Anda).
4. **Cloudinary Free:** cloud name, API key, API secret (Settings, API Keys). Bisa memakai akun Cloudinary point.lat dengan folder terpisah, atau akun baru supaya kuota tidak terbagi.
5. **Google:**
   - properti domain `presscompass.site` di Search Console (verifikasi DNS);
   - Search Console API aktif di Google Cloud;
   - akun layanan + kunci JSON, dengan email akun layanan sebagai Owner properti.
6. **Env Vercel:** kunci Supabase, kredensial Cloudinary, `CRON_SECRET`, `HMAC_SECRET`, `INDEXER_ADAPTER` (`real` di Production, `fake` di Preview), `GOOGLE_SERVICE_ACCOUNT_JSON` (Production saja).
7. **Supabase Cron:** ekstensi `pg_cron` dan `pg_net`, rahasia `cron_secret` di Vault (perintah SQL siap tempel di runbook).
8. **Komputer:** Node 26 lewat nvm, git, unzip. Tanpa Docker.

## 19. Risiko dan mitigasi

| Risiko | Mitigasi |
|---|---|
| Vercel Hobby hanya untuk non-komersial | situs tanpa iklan dan langganan berbayar; pindah ke Pro sebelum monetisasi |
| Kuota Hobby (1 juta pemanggilan fungsi, 4 jam CPU aktif, 100 GB transfer per bulan); fitur yang melewati kuota bisa diblokir sampai 30 hari | halaman di-cache CDN, gambar di-cache setahun, pemantauan Usage di runbook |
| Supabase Free: database 500 MB, egress 5 GB, proyek dijeda setelah 7 hari sepi | halaman di-cache CDN Vercel, Supabase Cron menjaga aktivitas, indikator ukuran database di Dashboard |
| Cloudinary Free: 25 kredit per bulan, 1 kredit = 1.000 transformasi atau 1 GB penyimpanan atau 1 GB bandwidth gambar; berkas gambar maksimal 10 MB | transformasi masuk 2560 px, preset `srcset` terbatas, pemakaian kredit dipantau di dashboard Cloudinary (runbook) |
| Satu proyek untuk produksi, Preview, dan komputer: salah edit atau migrasi rusak langsung mengenai situs live | draf tersembunyi oleh RLS; migrasi hanya menambah dan lulus CI di PostgreSQL dulu; adapter Google dan IndexNow `fake` di luar Production; cadangan mingguan (Rencana 8) |
| Supabase Free tanpa backup otomatis | ekspor mingguan lewat API (secret key), dienkripsi, disimpan di GitHub (Rencana 8) |
| Indexing tidak bisa dipaksa | sitemap bersih, Search Console + IndexNow langsung saat terbit, konten berkualitas, status dipantau |
| CMS kustom lebih banyak dibangun daripada Payload | modul kecil dengan antarmuka jelas, rencana bertahap, tes di setiap rencana |
| Kode Claude ditolak deploy Vercel Hobby (penulis commit bukan pemilik, temuan point.lat) | perintah pasang memuat `git commit --amend --reset-author` sebelum push |
| Domain baru lambat dikenal Google | cek status sampai +30 hari, tautan internal kuat, distribusi lewat newsletter dan sosial |

## 20. Skill per tahap

Semua skill yang ditautkan pemilik aktif saat tahapnya tiba. Di awal tahap, Claude memanggil skill lewat alat Skill (aturan using-superpowers) lalu mengikuti isinya. Skill yang tidak relevan untuk tahap itu tidak dipanggil. Pemilik juga bisa memanggil skill mana pun dengan `/nama-skill`.

| Tahap | Skill | Aktif saat | Hasil |
|---|---|---|---|
| Setiap sesi | using-superpowers | awal setiap permintaan | daftar skill untuk permintaan itu |
| Setiap sesi | context-engineering | awal sesi, ganti tugas, konteks menurun | `CLAUDE.md` dan log keputusan ringkas dan benar |
| Ide dan keputusan | brainstorming | fitur atau perubahan baru sebelum kode | pertanyaan, 2 sampai 3 pendekatan, desain disetujui |
| Ide dan keputusan | brand | logo, warna, materi bermerek | aturan logo dan token konsisten |
| Rencana | writing-plans | setelah desain disetujui | rencana per task dengan kode, tes, perintah npm |
| Rencana | codebase-design, design-an-interface | modul baru atau antarmuka berubah | modul dalam dengan antarmuka kecil, beberapa bentuk dibandingkan |
| Build | executing-plans | menjalankan rencana | task demi task dengan review |
| Build | ponytail | setiap tugas kode | perubahan terkecil yang menyelesaikan tugas |
| Desain dan UI | design-system, ui-ux-pro-max, ui-styling | komponen atau layar baru | sesuai token dan komponen PressCompass |
| Desain dan UI | landing-page-design | beranda, Newsletter, About | halaman yang mengarah ke satu tindakan |
| Desain dan UI | css-native | animasi dan efek | CSS modern tanpa JavaScript |
| Desain dan UI | magic-ui | efek React yang diminta | hanya bila lolos anggaran JS dan aturan motion |
| Desain dan UI | theme-factory | materi luar situs (media kit, laporan) | materi serasi dengan merek |
| Desain dan UI | design | aset merek lanjutan, banner sosial | aset kampanye |
| Motion | motion-design | animasi baru | kurva dan durasi sesuai design system |
| Motion | gsap, gsap-core, gsap-performance | animasi yang tidak bisa dengan CSS | hanya bila muat anggaran JS 15 KB; gsap-performance mengukurnya |
| Data | build-dashboard | Dashboard CMS dan dashboard SEO | kartu angka dan grafik dari data Supabase dan Search Console |
| Konten | seo-content-brief | aturan panel SEO dan artikel baru | brief: intent, outline, pertanyaan, sumber |
| Konten | technical-blog-writing | artikel explainer dan dokumentasi | tulisan teknis yang akurat |
| Konten | copywriting | judul, CTA, teks newsletter dan About | copy bahasa Inggris yang jelas |
| Konten | ux-copy | label, pesan galat, teks kosong di situs dan CMS | microcopy bahasa Inggris yang lugas |
| Konten | humanizer | Writing check di CMS dan sebelum terbit | pola tulisan AI ditandai |
| Konten | writing-skills, skill-creator | membuat skill khas PressCompass (gaya tulisan, checklist redaksi) | skill baru `/nama` |
| Review | code-review | setiap task dan sebelum zip | temuan diperbaiki sebelum kirim |
| Review | design-critique | layar baru atau perubahan visual | kritik hierarki, kontras, konsistensi |
| Review | design-audit | sebelum rilis | tanpa temuan Critical |
| Video (Fase 2) | huashu-art-motion, remotion-render | video penjelas | video dari naskah |

## 21. Alur pembaruan (zip + perintah terminal)

- Setiap rencana selesai dikirim sebagai `presscompass-vX.Y.Z.zip`: clone bersih `main` dengan riwayat git dan tag versi, tanpa `.env` dan `node_modules`.
- Bersama blok perintah npm siap tempel, tanpa komentar `#` (zsh meneruskannya sebagai argumen).
- Riwayat untuk pemilik ada di `CHANGELOG.md`.

Perintah standar (folder mengikuti point.lat):

```bash
cd "$HOME/Documents/Virgiawan/website done"
rm -rf presscompass-lama
mv presscompass presscompass-lama
unzip -q "$(ls -t ~/Downloads/presscompass*.zip | head -1)"
cp presscompass-lama/.env presscompass/.env
cd presscompass
npm ci
git commit --amend --no-edit --reset-author
git describe --tags
git push origin main
```

Kiriman pertama (v0.1.0) memakai perintah khusus karena folder lama belum ada. Langkah sekali jalan (env baru, migrasi, pengaturan dashboard) ditulis di kiriman yang membutuhkannya.

## Sumber riset (diakses 13 November 2026)

- Vercel Hobby (non-komersial, kuota, Pro): https://vercel.com/docs/plans/hobby
- Optimasi gambar Vercel (5.000 transformasi Hobby, 402 saat lewat kuota): https://vercel.com/docs/image-optimization/limits-and-pricing
- Supabase Free (2 proyek, database 500 MB, egress 5 GB): https://supabase.com/docs/guides/platform/billing-on-supabase
- Proyek Free dijeda saat sepi 7 hari: https://supabase.com/docs/guides/platform/free-project-pausing
- Kunci API publishable dan secret, kunci lama dihentikan akhir 2026: https://supabase.com/docs/guides/api/api-keys
- Cloudinary Free (25 kredit, nilai 1 kredit): https://cloudinary.com/pricing
- Batas berkas Cloudinary Free 10 MB: fakta riset point.lat (`claude/point-lat-decisions.md`)
- Perintah CLI untuk proyek hosted: https://supabase.com/docs/guides/local-development/local-and-hosted-projects
- Indexing API hanya untuk JobPosting dan BroadcastEvent: https://developers.google.com/search/apis/indexing-api/v3/quickstart
- Fakta riset point.lat (IndexNow, ping sitemap dihentikan, news sitemap 48 jam, cron Vercel): `claude/point-lat-decisions.md`
