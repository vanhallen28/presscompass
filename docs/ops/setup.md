# Pemasangan PressCompass (v0.1.1)

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

Setiap pembaruan yang membawa migrasi cukup menjalankan `npm run db:push` sekali.

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
