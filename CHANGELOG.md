# Riwayat versi

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
