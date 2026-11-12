# Riwayat versi

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
