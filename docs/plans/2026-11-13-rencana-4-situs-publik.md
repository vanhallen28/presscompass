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
