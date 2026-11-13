# Pemasangan PressCompass

Panduan sekali jalan untuk pemilik: Supabase, komputer, GitHub, Vercel, Cloudinary, dan jadwal terbit. Semua gratis dan tanpa Docker.
Rahasia (password database, secret key, API secret Cloudinary, `CRON_SECRET`) tidak pernah dikirim lewat percakapan; isi langsung di tempatnya.

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
   | `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | cloud name (langkah E) |
   | `CLOUDINARY_API_KEY` | API key (langkah E) |
   | `CLOUDINARY_API_SECRET` | API secret (langkah E) |
   | `CRON_SECRET` | 64 karakter acak (langkah F) |

3. Deploy. Region fungsi sudah dikunci ke Singapura (`sin1`) lewat `vercel.json`.
4. **Settings, Domains:** tambahkan `presscompass.site` dan ikuti petunjuk DNS Vercel di tempat domain dibeli.
5. Periksa:
   - https://presscompass.site menampilkan beranda (berisi kalimat sambutan sampai artikel pertama terbit);
   - https://presscompass.site/newsroom meminta masuk, lalu Dashboard menunjukkan **Database Connected** dan **Deployment Production**.

## E. Cloudinary (gambar, gratis)

Semua gambar disimpan dan dikirim oleh Cloudinary. Tanpa langkah ini Newsroom tetap jalan, tetapi tombol unggah mati dan Dashboard menulis **Media: Cloudinary is not connected**.

1. Buka https://cloudinary.com/users/register_free dan buat akun **Free** (atau masuk ke akun yang sudah ada; gambar PressCompass masuk folder sendiri, `presscompass/images`).
2. Di console Cloudinary buka **Settings, API Keys**. Catat:
   - **Cloud name** (tertulis di atas halaman, juga di Dashboard);
   - **API Key** (angka);
   - **API Secret** (klik ikon mata untuk melihatnya). Ini rahasia: jangan dikirim ke siapa pun.
3. Isi ketiganya di `.env` komputer:

   ```bash
   open -e .env
   ```

   ```
   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=cloud-name-anda
   CLOUDINARY_API_KEY=angka-api-key
   CLOUDINARY_API_SECRET=api-secret-anda
   ```

4. Isi juga di **Vercel, Settings, Environment Variables** dengan nama yang sama, semua lingkungan tercentang (tabel langkah D2). Setelah itu **Deployments, titik tiga di deploy terbaru, Redeploy**, karena `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` dibaca saat build.
5. Periksa: jalankan ulang `npm run dev`, buka Dashboard. Baris **Media** harus menulis **Cloudinary connected**. Buka **Media**, unggah satu gambar, isi Alt text, simpan.

Periksa juga di Cloudinary, **Settings, Security**: **Strict transformations** harus mati (situs membuat ukuran gambar saat diminta, misalnya `w_640,f_auto,q_auto`), dan di **Restricted image types** jenis **Uploaded** tidak dicentang. Keduanya mati pada akun baru.

Yang **tidak** perlu: upload preset, unsigned upload, `CLOUDINARY_URL` (API environment variable), SDK Cloudinary, membuat folder (folder `presscompass/images` dibuat sendiri saat unggah pertama). `NEXT_PUBLIC_CLOUDINARY_DELIVERY_URL` dan `CLOUDINARY_API_URL` hanya untuk tes; jangan diisi.

Bila API Secret bocor: **Settings, API Keys, Generate New API Key**, isi pasangan baru di `.env` dan Vercel, Redeploy, lalu ubah **Status** kunci lama menjadi **Disabled**.

Kuota Free: 25 kredit per bulan (1 kredit = 1.000 transformasi, atau 1 GB penyimpanan, atau 1 GB bandwidth). Gambar dikecilkan ke lebar maksimal 2560 px saat diunggah supaya hemat. Pemakaian bisa dilihat di Dashboard Cloudinary.

## F. Jadwal terbit (cron)

Artikel terjadwal diterbitkan oleh `GET /api/cron/run`. Vercel Hobby hanya boleh memanggilnya sekali sehari (sekitar 06.00 WIB, sudah diatur di `vercel.json`). Supaya artikel terjadwal terbit paling lambat 5 menit setelah waktunya, Supabase Cron memanggil endpoint yang sama setiap 5 menit. Gratis, dan sekaligus menjaga proyek Supabase Free tidak dijeda karena sepi. Membuka Newsroom juga menerbitkan artikel yang jatuh tempo.

1. Buat rahasia di Terminal Mac:

   ```bash
   openssl rand -hex 32
   ```

   Salin keluarannya (64 karakter) ke pengelola password. Jangan kirim ke siapa pun.
2. **Vercel, Settings, Environment Variables:** tambah `CRON_SECRET` dengan nilai itu, semua lingkungan tercentang. Lalu **Deployments, titik tiga di deploy terbaru, Redeploy**.
3. **Supabase, Database, Extensions:** nyalakan **pg_cron** dan **pg_net**.
4. **Supabase, Integrations, Vault, Add new secret:** nama `cron_secret`, nilai sama persis dengan `CRON_SECRET`. Rahasia tidak diketik di SQL Editor, supaya tidak tersimpan di riwayat kueri.
5. **Supabase, SQL Editor**, jalankan (ganti alamat bila domain belum aktif, misalnya dengan alamat `….vercel.app` dari Vercel, Settings, Domains):

   ```sql
   select cron.schedule(
     'presscompass-run',
     '*/5 * * * *',
     $$
     select net.http_get(
       url := 'https://presscompass.site/api/cron/run',
       headers := jsonb_build_object(
         'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
       ),
       timeout_milliseconds := 30000
     );
     $$
   );
   ```

   **Hasil yang diharapkan:** satu baris berisi nomor job.
6. Periksa setelah 10 menit:

   ```sql
   select status, return_message, start_time from cron.job_run_details order by start_time desc limit 3;
   select status_code, error_msg, created from net._http_response order by created desc limit 3;
   ```

   Hasilnya `succeeded` dan `status_code` 200. Di Vercel, Logs dengan path `/api/cron/run` menampilkan 12 permintaan per jam.

Mematikan: `select cron.unschedule('presscompass-run');`. Rahasia hanya memberi izin menerbitkan artikel yang memang sudah jatuh tempo (aman bila terpanggil berlebih). Bila bocor, buat nilai baru, ganti di Vercel dan Vault, lalu Redeploy.

## G. Konten awal (opsional)

Sepuluh artikel penjelas dengan ilustrasinya untuk mengisi situs sebelum artikel sendiri terbit (`content/starter/README.md`).
Butuh `.env` yang sudah berisi kunci Supabase dan Cloudinary (langkah B dan E).

```bash
npm run content:starter
```

**Hasil yang diharapkan:** daftar `Published: ...` dan baris `10 of 10 starter articles added.` Lalu push ke GitHub supaya deploy berikutnya memuatnya.
Untuk memeriksa dulu di Newsroom: `npm run content:starter -- --draft`, lalu terbitkan dari **Articles**.

## Bila ada masalah

| Gejala | Penyebab dan jalan keluar |
|---|---|
| Halaman masuk: "The Newsroom is not configured yet" | env Supabase belum diisi atau salah ketik; periksa `.env` atau env Vercel, lalu deploy ulang |
| Semua halaman Vercel galat 500, log: "no PressCompass marker" atau "belong to ..., not PressCompass" | kunci Supabase milik proyek lain (misalnya point.lat), atau `npm run db:push` belum dijalankan |
| Masuk ditolak: "This account does not have Newsroom access" | jalankan `npm run staff:grant -- email@anda.com` (langkah B4) |
| `db:push`: IPv6 is not supported | jalankan `npm run db:link` lagi (link memakai pooler IPv4), lalu ulangi `db:push` |
| Unggah gambar: "Cloudinary is not connected yet" | tiga nilai Cloudinary belum ada di `.env` (komputer) atau di Vercel; isi (langkah E), lalu jalankan ulang `npm run dev` atau Redeploy di Vercel |
| Unggah gambar: "Cloudinary refused the file: Invalid Signature" (atau "Invalid API key") | API key atau API secret salah ketik, atau milik akun lain dari cloud name; salin ulang dari Settings, API Keys |
| Gambar tampil kosong padahal unggah berhasil | `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` salah, atau Vercel belum di-Redeploy setelah env diisi |
| `net._http_response` berisi `status_code` 401 | `cron_secret` di Vault tidak sama dengan `CRON_SECRET` di Vercel; ubah salah satunya (tidak perlu menjadwal ulang) |
| `status_code` 503: "CRON_SECRET is not set" | `CRON_SECRET` belum ada di Vercel atau kurang dari 32 karakter; isi lalu Redeploy |
| Artikel sudah terbit di Newsroom tetapi situs masih menampilkan "Page not found" | muat ulang halaman setelah beberapa detik: situs menyimpan halaman di cache dan diperbarui sesaat setelah Publish |
| Build Vercel gagal dengan pesan `site_list:` atau `sections:` | build membaca Supabase untuk menyiapkan halaman; proyek Supabase dijeda atau tidak terjangkau. Pulihkan proyek (Supabase, Restore), lalu Redeploy. Deploy lama tetap tayang |
| `content:starter`: "Cloudinary did not take ...: Invalid Signature" | API key atau secret Cloudinary di `.env` salah; salin ulang (langkah E) |
| `content:starter`: "This Supabase project is not set up for PressCompass" | kunci di `.env` milik proyek lain, atau `npm run db:push` belum dijalankan |
| Deploy Vercel diblokir: commit author tidak punya akses | perintah pasang selalu memuat `git commit --amend --no-edit --reset-author` sebelum push; jalankan lalu push lagi |
