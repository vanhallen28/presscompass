# Riwayat versi

## v0.5.0 · 13 November 2026 · Iklan dan halaman statis (Rencana 5)

- **Ads** (menu baru Site, Ads di Newsroom), satu tempat untuk semua kode iklan dan pelacakan:
  - **Google AdSense:** ID penerbit (`ca-pub-`, `pub-`, atau baris ads.txt juga diterima), Auto ads, dan unit Display, In-article, In-feed, Multiplex di slot;
  - **Google Ad Manager (GPT):** path unit dan ukuran per slot;
  - **Meta Pixel:** PageView di setiap halaman;
  - **kode jaringan lain** (Adsterra, Media.net, PropellerAds, Google Tag Manager, dan sejenisnya) untuk `<head>`, akhir `<body>`, dan slot;
  - **tag verifikasi** `<meta>` jaringan iklan, dan **`/ads.txt`** dengan baris AdSense otomatis.
- **8 slot iklan tetap:** bawah header, beranda, daftar cerita, dua di dalam artikel (setelah paragraf pilihan), akhir artikel, kolom samping artikel, atas footer. Tinggi per slot untuk HP dan layar lebar, jadi halaman tidak bergeser saat iklan dimuat; 0 menyembunyikan slot.
- **Banner persetujuan cookie** dengan dua pilihan setara (Accept all, Necessary only) dan **Cookie settings** di footer. Sebelum pembaca setuju tidak ada kode Google, Meta, atau jaringan lain yang dimuat; Google Consent Mode v2 terpasang.
- **Sakelar utama mati bawaan.** Vercel Hobby hanya untuk penggunaan non-komersial: pindah ke Vercel Pro sebelum menyalakan iklan. Selama mati, tag verifikasi AdSense dan `ads.txt` tetap aktif supaya situs bisa diajukan ke AdSense dulu.
- **Pages** (menu baru): halaman statis seperti About, Contact, Privacy policy dengan editor blok yang sama dengan artikel, Draft/Published, alamat `/{alamat}`, dan tautan otomatis di footer.
- **Konten awal:** `npm run content:starter` kini juga menambahkan draf About, Contact, dan Privacy policy (lengkapi email kontak dan periksa teksnya sebelum terbit).
- **Langkah tambahan:** jalankan `npm run db:push` (migrasi baru `20261117000100_ads_pages.sql`) sebelum `git push`, lalu `npm run content:starter` untuk draf halaman. Panduan AdSense dan iklan: `docs/ops/setup.md` langkah H.
- Tes: 128 unit, 48 database, 64 E2E (iklan diuji dengan skrip Google dan Meta tiruan, tanpa jaringan).

## v0.4.1 · 13 November 2026 · Konten awal

- **Paket konten awal** di `content/starter`: 10 artikel penjelas berbahasa Inggris (beras, nikel, DPR/DPD/MPR, gunung api, Nusantara, BRICS, kebakaran gambut, ekonomi 2025, penduduk per provinsi, zona waktu) dengan sumber bertanggal, Key figures, dan 3 Chart, plus 10 ilustrasi 1800 × 1200 buatan sendiri.
- **`npm run content:starter`** mengunggah ilustrasi ke Cloudinary, mengisi Media (alt text, keterangan, kredit), membuat rubrik News, Politics, Business, World, Science, Data bila belum ada, penulis PressCompass Desk, tag, lalu artikel terbit (atau `-- --draft`). Aman dijalankan ulang; `-- --dry-run` hanya memeriksa berkas.
- **Kredit gambar:** kredit yang diawali label seperti `Illustration:` atau `Graphic:` tampil apa adanya; kredit lain tetap "Photo: …". Petunjuknya ada di halaman gambar di Media.
- **Perbaikan:** tabel data tersembunyi milik Chart tidak lagi melebarkan halaman artikel di HP.
- **Langkah tambahan:** jalankan `npm run content:starter` sebelum `git push` (tidak ada migrasi baru).
- Tes: 118 unit (termasuk pemeriksaan setiap artikel awal terhadap aturan editor), 43 database, 62 E2E.

## v0.4.0 · 13 November 2026 · Situs publik (Rencana 4)

- **Situs publik** dengan tata letak yang dikunci di preview: baris tanggal (WIB), masthead, navigasi rubrik dengan garis merah untuk rubrik aktif, pita **Latest** (artikel 24 jam terakhir), menu rubrik dan kotak cari dari tombol menu (tanpa JavaScript), footer navy.
- **Beranda** otomatis: artikel terbaru sebagai lead dengan 4 **Top stories**, satu baris untuk setiap rubrik di navigasi (tanpa mengulang artikel), dan **Opinion**. Sebelum ada artikel, beranda menampilkan kalimat sambutan.
- **Halaman artikel** `/{rubrik}/{slug}`: kicker rubrik dan jenis, judul, standfirst, byline dengan foto penulis, tanggal dan "Updated", waktu baca, tombol salin tautan (dan bagikan di HP), gambar utama dengan keterangan, isi, sumber, tag, rail **Related** (pilihan editor dulu, lalu otomatis), dan **More from** rubrik.
- **Rubrik, penulis, tag:** daftar artikel 24 per halaman dengan halaman berikutnya (`/business/page/2`). Halaman penulis memuat foto, jabatan, bio, dan tautan. Penulis dan tag tanpa artikel terbit tidak punya halaman.
- **Cari** `/search`: pencarian teks penuh di judul, standfirst, dan isi. **404** dengan kotak cari dan artikel terbaru.
- **Mode gelap:** mengikuti perangkat, dengan sakelar Auto, Light, Dark di footer yang diingat browser tanpa kedip saat halaman dibuka.
- **Blok Chart** di editor (tombol grafik di toolbar): grafik batang atau garis dari tabel yang ditempel dari spreadsheet, digambar SVG oleh situs, dengan tabel tersembunyi untuk pembaca layar.
- **Pratinjau Newsroom** kini memakai komponen yang sama dengan halaman situs.
- **Cache:** halaman situs disimpan dan diperbarui sendiri sesaat setelah Publish, Update, perubahan rubrik/tag/penulis, atau detail gambar di Newsroom.
- **Terbit terjadwal otomatis:** `GET /api/cron/run` dengan `CRON_SECRET`. Vercel Cron sekali sehari (sekitar 06.00 WIB); Supabase Cron setiap 5 menit dipasang sekali dari panduan (`docs/ops/setup.md`, langkah F).
- **Langkah tambahan:** isi `CRON_SECRET` di Vercel (buat dengan `openssl rand -hex 32`), lalu pasang Supabase Cron (langkah F).
- **Migrasi baru** `20261116000100_public_site.sql` (fungsi baca situs): jalankan `npm run db:push` sebelum push ke GitHub, karena build Vercel kini membaca Supabase.
- Tes: 90 unit, 43 database, 61 E2E.

## v0.3.0 · 13 November 2026 · Media Cloudinary (Rencana 3)

- **Media** (menu baru): pustaka gambar di Cloudinary. Unggah beberapa gambar sekaligus langsung dari browser ke Cloudinary dengan tanda tangan dari server (berkas tidak lewat Vercel). JPEG, PNG, WebP, AVIF, GIF sampai 10 MB; lebar dikecilkan ke maksimal 2560 px saat masuk, folder `presscompass/images`.
- **Halaman gambar:** Alt text, keterangan bawaan, kredit, ukuran, ID Cloudinary, daftar **Used in** (gambar utama, isi artikel, foto penulis), dan hapus bila tidak dipakai (data dan file di Cloudinary ikut terhapus). Gambar yang masih dipakai tidak bisa dihapus.
- **Pemilih gambar** di editor: cari di pustaka atau unggah langsung, lalu isi alt text dan kredit (tersimpan pada gambar) serta keterangan (per pemakaian).
- **Gambar utama** di panel editor dengan keterangannya sendiri, dan **blok Image** di toolbar isi artikel. Pratinjau menampilkan semuanya dengan keterangan dan "Photo: kredit".
- **Aturan terbit baru:** artikel butuh gambar utama, dan gambar utama serta setiap gambar di isi harus punya alt text. Berlaku juga untuk Publish massal.
- **Foto penulis** dipilih dari pustaka media di halaman Authors.
- **Pengiriman gambar:** `srcset` Cloudinary `f_auto,q_auto` (AVIF atau WebP), lebar 320 sampai 1920, potongan 16:9, 3:2, dan 1:1 dengan `g_auto`. Kuota optimasi gambar Vercel tidak terpakai.
- **Dashboard:** baris **Media** menulis apakah Cloudinary sudah tersambung. Tanpa kredensial Cloudinary situs tetap berjalan; hanya unggah yang dimatikan dengan penjelasan.
- **Langkah tambahan:** buat akun Cloudinary Free dan isi `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` di `.env` dan di Vercel (`docs/ops/setup.md`, langkah E).
- **Migrasi baru** `20261115000100_media.sql` (fungsi pemakaian gambar dan daftar pustaka): jalankan `npm run db:push` sebelum push ke GitHub.
- Tes: 74 unit, 35 database, 43 E2E. E2E memakai Cloudinary tiruan yang memeriksa tanda tangan unggah dan hapus seperti Cloudinary asli.

## v0.2.0 · 13 November 2026 · Newsroom inti (Rencana 2)

- **Articles:** daftar dengan tab status dan jumlahnya, cari (judul, alamat, penulis), filter rubrik dan penulis, 25 baris per halaman, dan aksi massal (Publish, Unpublish, Archive, Delete) yang menyebut artikel mana yang belum siap terbit dan kenapa.
- **Editor artikel:** judul, standfirst, isi dengan editor blok (H2, H3, tebal, miring, tautan, daftar, kutipan, pemisah, tabel, Pull quote, Key figures, Editor's note, video YouTube yang baru dimuat setelah diklik, kartu Read more), rubrik, jenis, label, breaking, penulis berurutan, tag, artikel terkait, dan sumber.
- **Alur status:** Draft → In review → Published atau Scheduled (tanggal dan jam WIB) → Archived, dengan satu tombol utama per status. Unpublish, Archive, dan Delete meminta konfirmasi. Artikel terbit tidak bisa dihapus sebelum dibatalkan terbitnya.
- **Aturan terbit:** judul, alamat, rubrik, minimal satu penulis, standfirst, dan isi minimal 150 kata. Yang kurang ditulis di kolomnya. Aturan gambar utama menyusul bersama pustaka media (v0.3.0).
- **Autosave** setiap 10 detik untuk Draft dan In review; artikel terbit disimpan lewat tombol Update (dengan sakelar Major update). Ctrl/Cmd+S menyimpan. Simpan dari jendela lama ditolak dengan pesan "This article changed in another window".
- **Riwayat versi:** 50 versi terakhir per artikel, bisa dilihat dan dipulihkan (keadaan sekarang disimpan dulu sebagai "Before restore").
- **Pratinjau** artikel dalam tata letak artikel situs, termasuk versi lama dari riwayat.
- **Sections, Tags, Authors:** buat, ubah, hapus (diblokir bila masih dipakai), urutan navigasi rubrik, tautan profil penulis.
- **Redirect otomatis 308** bila alamat artikel terbit berubah (slug atau rubrik), atau slug rubrik, tag, dan penulis berubah. Rantai redirect dipendekkan.
- **Dashboard:** Published today, In review, Scheduled (dan jadwal berikutnya), Drafts, artikel terbaru, status sistem.
- **Migrasi baru** `20261114000100_newsroom_core.sql`: jalankan `npm run db:push` sebelum push ke GitHub.
- Tes: 59 unit, 32 database, 35 E2E. E2E kini memakai Supabase tiruan yang menjalankan SQL sungguhan di PostgreSQL lokal, jadi RLS dan fungsi database ikut teruji.
- Perbaikan: peringatan `turbopack.root` di `npm run dev` hilang.

## v0.1.1 · 13 November 2026 · Satu proyek Supabase

- Permintaan pemilik: cukup **satu** proyek Supabase (`presscompass`) untuk produksi, deploy Preview Vercel, dan komputer Anda.
- Pengaman lingkungan diganti pengaman proyek: aplikasi menolak berjalan bila kunci Supabase bukan milik proyek PressCompass (misalnya kunci point.lat) atau migrasi belum diterapkan.
- Migrasi baru `20261113000200_single_project.sql` (hanya mengganti penanda di `app_meta`).
- Dashboard menulis "Deployment: Production" atau "Preview or local".
- Panduan pemasangan disederhanakan untuk satu proyek.

## v0.1.0 · 13 November 2026 · Fondasi (Rencana 1)

- Proyek Next.js 16.4.6 dengan npm dan Node 26, tanpa Docker.
- Token desain, font Newsreader dan IBM Plex (di-host sendiri), logo utama (simbol + logotype satu baris), ikon, dan tombol dari design system. Tema terang dan gelap mengikuti perangkat.
- Skema Supabase v1: rubrik, tag, penulis, media, artikel (dengan penulis, tag, terkait, dan riwayat versi), halaman, tata letak, redirect, staf, dan penanda lingkungan. Row Level Security di semua tabel: pembaca hanya melihat konten terbit, hanya staf yang menulis.
- Newsroom: halaman masuk di `/newsroom/login`, dashboard pemeriksaan fondasi, dan keluar. Hanya akun di tabel `staff` yang bisa masuk.
- Penjaga lingkungan: deploy Preview yang tersambung ke Supabase produksi (atau sebaliknya) menolak berjalan.
- Halaman depan sementara "Launching soon", tidak diindeks mesin pencari sampai peluncuran.
- CI GitHub Actions: type check, lint, 19 tes unit, 15 tes database dan RLS, build, dan 20 tes E2E (dengan axe dan Supabase tiruan), semuanya tanpa Docker.
