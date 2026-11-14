# Rencana 6: Editor ala WordPress, skor SEO, dan dasar SEO situs (v0.6.0)

**Permintaan pemilik (13 November 2026):** "untuk halaman artikel buat itu seperti wordpress dan ada scoring berdasarkan standar google". Pemilik memilih "Editor Newsroom + skor SEO" dan tiga versi berurutan; v0.6.0 adalah versi kedua. Indexing otomatis (Search Console, IndexNow, status indeks) tetap v0.7.0.

**Tujuan:** menulis artikel terasa seperti WordPress (bilah atas dengan tombol terbit, panel samping bertab yang bisa dilipat, tombol + dan perintah `/` untuk menambah blok), dengan panel SEO dan keterbacaan seperti Yoast yang menilai artikel menurut pedoman Google Search Central. Situs mendapat semua dasar SEO: metadata lengkap, JSON-LD, sitemap, Google News sitemap, RSS, robots.txt, gambar OG otomatis, redirect manual, dan log 404.

**Arsitektur:**

- `src/modules/seo/` berisi analisis murni (`analysis.ts`, `readability.ts`, `snippet.ts`, `writing.ts`), pengaturan SEO (`settings.ts`), metadata Next (`metadata.ts`), JSON-LD (`jsonld.ts`), XML sitemap dan RSS (`xml.ts`), serta query dan Server Action.
- Analisis yang sama berjalan di browser (panel langsung berubah saat mengetik) dan di server saat menyimpan, sehingga skor tersimpan di `articles.seo.scores` dan tampil di daftar Articles.
- Data situs dibaca lewat fungsi SQL `site_*` baru (sitemap, news sitemap, feed, pengaturan SEO), di-cache dengan tag yang sudah ada (`site`, `articles`, `taxonomy`).
- Pengaturan SEO disimpan di `layouts` kunci `seo` (draf dan terbit diisi bersamaan, sama seperti tombol Save biasa).

## Keputusan

| Hal | Keputusan | Alasan |
|---|---|---|
| Bilah atas editor | Lengket di atas: kembali, status, keadaan simpan, skor SEO dan keterbacaan, History, Preview, Save draft, dan satu tombol utama (Send for review, Publish, Update, Restore) | Pola WordPress: tombol terbit selalu terlihat. Aksi lain (Schedule, Publish now, Unpublish, Archive) tetap di panel Status |
| Panel samping | Dua tab, **Article** dan **SEO**. Setiap kartu bisa dilipat; kartu yang berisi kesalahan terbuka sendiri. Daftar masalah terbit pindah ke atas halaman | Seperti tab Post dan panel plugin di Gutenberg; masalah terlihat dari tab mana pun |
| Menambah blok | Tombol **+** di toolbar membuka daftar blok dengan kotak cari; mengetik `/` di paragraf kosong membuka daftar yang sama di posisi kursor (panah, Enter, Esc) | Dua cara utama Gutenberg |
| Data SEO artikel | `articles.seo`: `title`, `description`, `keyphrase`, `related` (maks. 4 keyphrase tambahan), `canonical`, `noindex`, `ogMediaId`, `scores` (`seo`, `readability`, dihitung server) | Kolom `seo` jsonb sudah ada sejak Rencana 1 dan sudah ikut riwayat versi |
| Skor | Setiap cek bernilai hijau 9, kuning 5, merah 0; skor = jumlah ÷ (9 × jumlah cek) × 100. 75 ke atas **Good**, 45 ke atas **OK**, di bawahnya **Needs work** | Mirip Yoast (9, 6, 3) tetapi lebih ketat, supaya beberapa lampu merah tidak tetap "Good". Skor hanya saran; aturan terbit tidak berubah (spesifikasi §7) |
| Panjang judul | Diukur dalam piksel (Arial 20 px, perkiraan lebar huruf), hijau 400 sampai 600 px, dengan " · PressCompass" ikut dihitung | Google memotong judul sesuai lebar layar, bukan jumlah huruf ("truncated ... to fit the device width"); 600 px kira-kira 50 sampai 60 huruf seperti spesifikasi §9 |
| Panjang meta | Hijau 120 sampai 160 huruf; kosong memakai standfirst (diberi tahu) | Google tidak memberi batas, tetapi memotong cuplikan; deskripsi harus unik dan berupa ringkasan, bukan daftar kata kunci |
| Cek SEO | keyphrase ada dan panjangnya wajar, di judul SEO (lebih baik di awal), di meta, di alamat, di standfirst, di 100 kata pertama, kepadatan 0,5 sampai 3 persen, di subjudul, panjang teks, urutan H2/H3, 3 sampai 5 tautan internal, minimal 1 sumber luar, teks tautan deskriptif, gambar utama minimal 1200 px dan ber-alt, semua gambar ber-alt, keyphrase di alt, keyphrase dan judul belum dipakai artikel lain, noindex | Pedoman Google: title link, snippet, link best practices, Discover (gambar 1200 px, `max-image-preview:large`), spam policy (keyword stuffing), people-first content (sumber) |
| Cek keterbacaan | Flesch Reading Ease, kalimat di atas 20 kata, paragraf di atas 150 kata, teks tanpa subjudul di atas 300 kata, kalimat pasif, kata transisi, tiga kalimat berurutan dengan awal sama | Standar umum keterbacaan bahasa Inggris (Yoast, Hemingway) |
| Writing check | Klise dan pola tulisan AI (daftar kecil berdasarkan skill humanizer), tanda seru, kalimat berangka tanpa sumber | Spesifikasi §9 poin 3; gaya PressCompass tanpa tanda seru |
| Kanibalisasi dan saran tautan | Server Action membaca artikel lain dengan keyphrase atau judul SEO yang sama, dan menyarankan artikel terbit dari rubrik atau tag yang sama yang belum ditautkan (tombol Copy link) | Spesifikasi §9 poin 4 dan 5 |
| Pratinjau | Google desktop dan HP (judul dan deskripsi dipotong sesuai lebar), kartu sosial | Seperti Yoast |
| Indexing situs | Sakelar baru di SEO settings, **Let search engines index the site**, mati bawaan. Selama mati semua halaman `noindex, nofollow` (perilaku sekarang). Deploy Preview Vercel selalu noindex | Situs belum dirilis; menyalakannya keputusan pemilik. robots.txt tetap mengizinkan crawl supaya peninjau AdSense bisa membaca halaman |
| Metadata | Judul berpola dari SEO settings, deskripsi, canonical, `max-image-preview:large`, Open Graph `article` (waktu terbit, ubah, rubrik, tag, penulis), kartu X `summary_large_image`, RSS di `alternates` | Spesifikasi §9 |
| Gambar OG | Pilihan editor (Cloudinary 1200 × 630), atau kartu otomatis `/og/{id}` dari `next/og`: latar paper, logo, kicker merah, judul Newsreader, gambar utama di kanan. Font WOFF statis Newsreader 500 dan IBM Plex Sans 600 (OFL) di `src/fonts/og/` | `next/og` (Satori) tidak membaca WOFF2 maupun font variabel. Gambar utama di kartu supaya tidak sekadar teks (Discover menghindari gambar penuh teks) |
| JSON-LD | `NewsArticle` (news), `OpinionNewsArticle` (opinion), `Article` (analysis, explainer, feature) dengan gambar 16:9, 4:3, 1:1, penulis terpisah per orang dengan URL, tanggal ISO dengan zona waktu, sumber sebagai `citation`; `BreadcrumbList`; `WebSite` + `NewsMediaOrganization` di beranda; `ProfilePage` + `Person` di halaman penulis | Pedoman Article structured data Google (diperbarui 8 September 2026) |
| Sitemap | `/sitemap.xml` (index) → `/sitemaps/articles-YYYY-MM.xml`, `sections.xml`, `authors.xml`, `tags.xml`, `pages.xml`, dengan gambar utama (`image:image`). `lastmod` artikel = Major update atau waktu terbit. Artikel noindex atau ber-canonical ke tempat lain tidak masuk | Spesifikasi §9 |
| News sitemap | `/news-sitemap.xml`: artikel 48 jam terakhir, maks. 1.000, nama publikasi dari SEO settings, bahasa `en` | Pedoman News sitemap Google |
| RSS | `/feed.xml` dan `/{rubrik}/feed.xml`, 30 artikel terbaru, RSS 2.0 dengan `dc:creator`, `media:content` | Spesifikasi §8 |
| robots.txt | Izinkan semua kecuali `/newsroom`, `/api/`, `/search`; aturan tambahan dari SEO settings; merujuk sitemap index dan news sitemap. Deploy Preview: `Disallow: /` | Spesifikasi §9 |
| Redirect | Halaman **Redirects** (dari, ke, 301, 308, atau 410). Alamat dengan tiga bagian atau lebih ditangkap rute catch-all supaya redirect juga berlaku di sana | Redirect otomatis saat slug berubah sudah ada sejak v0.2.0 |
| Log 404 | Halaman 404 mengirim beacon kecil ke `/api/not-found`; `log_not_found()` menghitung per alamat (maks. 1.000 alamat, yang lama dibuang), mengabaikan `/newsroom`, `/api`, `/_next`. Halaman **404 log** dengan tombol **Create redirect** dan **Dismiss** | Halaman tetap statis; tidak ada kerja server untuk pembaca biasa |

## Tugas

1. Rencana dan riset (dokumen ini).
2. `src/modules/seo/analysis.ts`, `readability.ts`, `snippet.ts`, `writing.ts` + `tests/unit/seo-analysis.test.ts`.
3. Kolom SEO artikel: `parseArticleInput` (`seo`), `prepareSave` (skor), `EditableArticle.seo`, Server Action `seoLookup`. Tes unit editor diperbarui.
4. Editor: bilah atas, tab Article/SEO, kartu lipat, blok inserter + perintah `/` (`BlockMenu`).
5. Panel SEO: keyphrase, pratinjau Google, judul SEO dan meta dengan bar lebar, daftar cek, writing check, kartu sosial, Advanced (canonical, noindex, gambar sosial), kanibalisasi, saran tautan; kolom SEO di daftar Articles.
6. Migrasi `20261118000100_seo.sql`: `not_found_log` (RLS staf), `log_not_found()`, `site_seo()`, `site_sitemap()`, `site_sitemap_articles()`, `site_news_sitemap()`, `site_feed()`, `site_article` memuat `seo`. Tes `tests/db/seo.test.ts`.
7. Situs: metadata semua rute, JSON-LD, `/og/[id]`, logo PNG untuk organisasi (`/brand/logo.png`).
8. `/sitemap.xml`, `/sitemaps/[file]`, `/news-sitemap.xml`, `/feed.xml`, `/[section]/feed.xml`, `robots.txt`.
9. Newsroom grup **SEO**: SEO settings, Redirects, 404 log; beacon di halaman 404; catch-all.
10. E2E, cek visual, dokumen, v0.6.0.

## Hasil

- Unit 175, database 56, E2E 71 lulus (30 dilewati sengaja). Build berhasil; sitemap, feed, robots.txt, dan logo organisasi disiapkan saat build dan diperbarui lewat tag cache.
- Cek visual: editor (bilah atas, tab SEO, menu `/` dan `+`) terang, gelap, dan di HP 390 px tanpa geser samping; kartu sosial otomatis 1200 × 630; halaman SEO settings, Redirects, 404 log.
- Skor 18 artikel awal dengan keyphrase dari tag pertamanya: SEO 60 sampai 90, keterbacaan 58 sampai 88.

## Batasan yang tersisa

- **Redirect dari cache tanpa header `Location`.** Next.js 16 (Cache Components) menjawab redirect yang sudah tersimpan di cache dengan status 308 tetapi tanpa header `Location`; browser tetap pindah lewat redirect di dalam halaman, dan kunjungan pertama mendapat 200 dengan redirect di dalam halaman. Redirect HTTP yang benar di semua kunjungan butuh `proxy.ts` untuk semua alamat publik (setiap kunjungan menjadi pemanggilan fungsi di Vercel), jadi ditimbang di Rencana 9 bersama 404 kunjungan pertama. **Diselesaikan di v0.6.1** setelah proyek pindah ke Vercel Pro: redirect disalin ke bulk redirects Vercel (CDN), tanpa `proxy.ts`.

## Sumber riset (diakses 14 November 2026)

- Influencing your title links in search results (diperbarui 10 Desember 2025): https://developers.google.com/search/docs/appearance/title-link
- Control your snippets in search results, meta description (diperbarui 20 April 2026): https://developers.google.com/search/docs/appearance/snippet
- Article (Article, NewsArticle, BlogPosting) structured data (diperbarui 8 September 2026): https://developers.google.com/search/docs/appearance/structured-data/article
- Get on Discover: gambar minimal 1200 px, `max-image-preview:large` (diperbarui 9 Maret 2026): https://developers.google.com/search/docs/appearance/google-discover
- News sitemaps: dua hari terakhir, 1.000 `news:news` (diperbarui 10 Desember 2025): https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap
- Next.js 16 (`node_modules/next/dist/docs`): Route Handlers dengan Cache Components, `generateStaticParams` untuk Route Handler, panduan JSON-LD, `ImageResponse`.
