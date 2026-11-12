# Pemasangan PressCompass v0.1.0

Panduan sekali jalan untuk pemilik: Supabase, komputer, GitHub, dan Vercel. Semua gratis dan tanpa Docker.
Rahasia (password database, secret key) tidak pernah dikirim lewat percakapan; isi langsung di tempatnya.

## A. Supabase (dua proyek gratis)

1. Buka https://supabase.com/dashboard, pilih **New project**.
   - Nama `presscompass-preview`, region **Southeast Asia (Singapore)**.
   - Password database: buat yang panjang dan **hanya huruf dan angka** (tanda seperti `#`, `/`, `?` merusak perintah). Simpan di pengelola password.
2. Ulangi untuk proyek produksi bernama `presscompass`.
   - Jatah gratis Supabase 2 proyek per akun. Bila akun ini masih memegang proyek gratis point.lat yang aktif, pakai akun Supabase lain.
3. Di **setiap** proyek:
   - **Authentication, Sign In / Providers:** matikan izin pendaftaran pengguna baru (Allow new users to sign up). Newsroom hanya untuk Anda.
   - **Authentication, Users, Add user, Create new user:** email Anda, password minimal 15 karakter, centang **Auto Confirm User**.
   - **Project Settings, API Keys:** catat **Project URL**, **publishable key** (`sb_publishable_...`), dan **secret key** (`sb_secret_...`). Jangan pakai kunci lama `anon` atau `service_role`.
   - Catat juga **kode proyek** (20 huruf di URL dashboard, `supabase.com/dashboard/project/KODE`).

## B. Komputer (Mac)

1. Pasang zip (perintah ada di pesan pengiriman v0.1.0).
2. Buat `.env` dari contoh, lalu isi dengan kunci proyek **pratinjau**:

   ```bash
   cp .env.example .env
   open -e .env
   ```

3. Terapkan skema ke proyek pratinjau. `db:login` membuka browser untuk masuk Supabase (sekali saja); `db:link` meminta password database proyek itu; `db:push` menanyakan konfirmasi:

   ```bash
   npm run db:login
   npm run db:link -- --project-ref KODE_PRATINJAU
   npm run db:push
   ```

4. Beri akses Newsroom ke akun Anda di proyek pratinjau, lalu jalankan:

   ```bash
   npm run staff:grant -- email@anda.com
   npm run dev
   ```

5. Buka http://localhost:3000/newsroom dan masuk. Kartu **Foundation** di Dashboard harus menunjukkan **Database Connected** dan **Environment Preview**.

## C. Skema proyek produksi

```bash
npm run db:link -- --project-ref KODE_PRODUKSI
npm run db:push
npm run db:link -- --project-ref KODE_PRATINJAU
```

Baris terakhir menautkan kembali ke pratinjau, supaya `db:push` berikutnya tidak tidak sengaja mengubah produksi.

Akses Newsroom produksi diberikan lewat **SQL Editor** proyek produksi (supaya secret key produksi tidak masuk terminal). Ganti emailnya, lalu Run:

```sql
insert into public.staff (user_id)
select id from auth.users where email = 'email@anda.com'
on conflict (user_id) do nothing;
```

## D. GitHub

1. Buat repo **privat** baru bernama `presscompass` di GitHub, tanpa README.
2. Kirim kode (perintah push ada di pesan pengiriman). CI berjalan otomatis; tunggu centang hijau.

## E. Vercel (Hobby)

1. **Add New, Project**, impor repo `presscompass`. Framework terdeteksi Next.js.
2. **Environment Variables** sebelum deploy pertama:

   | Nama | Production | Preview |
   |---|---|---|
   | `NEXT_PUBLIC_SITE_URL` | `https://presscompass.site` | (kosongkan) |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL produksi | Project URL pratinjau |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key produksi | publishable key pratinjau |
   | `SUPABASE_SECRET_KEY` | secret key produksi | secret key pratinjau |

3. Deploy. Region fungsi sudah dikunci ke Singapura (`sin1`) lewat `vercel.json`.
4. **Settings, Domains:** tambahkan `presscompass.site` dan ikuti petunjuk DNS Vercel di tempat domain dibeli.
5. Periksa:
   - https://presscompass.site menampilkan halaman "Launching soon";
   - https://presscompass.site/newsroom meminta masuk, lalu Dashboard menunjukkan **Database Connected** dan **Environment Production**.

## Bila ada masalah

| Gejala | Penyebab dan jalan keluar |
|---|---|
| Dashboard: "The Newsroom is not configured yet" saat masuk | env Supabase belum diisi atau salah ketik; periksa `.env` atau env Vercel, lalu deploy ulang |
| Semua halaman Vercel galat 500, log: "connected to the production Supabase project" | env Preview memakai kunci produksi (atau sebaliknya); perbaiki env Vercel, lalu deploy ulang |
| Masuk ditolak: "This account does not have Newsroom access" | baris `staff` belum dibuat untuk proyek itu (langkah B4 atau C) |
| `db:push`: IPv6 is not supported | jalankan `npm run db:link` lagi (link memakai pooler IPv4), lalu ulangi `db:push` |
| Deploy Vercel diblokir: commit author tidak punya akses | perintah pasang selalu memuat `git commit --amend --no-edit --reset-author` sebelum push; jalankan lalu push lagi |
