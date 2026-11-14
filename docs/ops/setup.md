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

## D. Vercel (Pro)

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

Artikel terjadwal diterbitkan oleh `GET /api/cron/run`. Sejak proyek Vercel memakai paket **Pro**, Vercel Cron memanggilnya **setiap 5 menit** (sudah diatur di `vercel.json`), jadi artikel terjadwal terbit paling lambat 5 menit setelah waktunya. Panggilan yang sama juga menyalin redirect ke Vercel (langkah J) dan menjaga proyek Supabase Free tetap aktif. Membuka Newsroom juga menerbitkan artikel yang jatuh tempo.

1. Buat rahasia di Terminal Mac (lewati bila `CRON_SECRET` sudah ada di Vercel):

   ```bash
   openssl rand -hex 32
   ```

   Salin keluarannya (64 karakter) ke pengelola password. Jangan kirim ke siapa pun.
2. **Vercel, Settings, Environment Variables:** `CRON_SECRET` dengan nilai itu, semua lingkungan tercentang. Vercel Cron mengirimnya sendiri ke endpoint. Lalu **Deployments, titik tiga di deploy terbaru, Redeploy**.
3. Periksa setelah 10 menit: **Vercel, proyek, Settings, Cron Jobs** menampilkan `/api/cron/run` dengan jadwal `*/5 * * * *`, dan **Logs** dengan path `/api/cron/run` menampilkan 12 permintaan per jam berstatus 200.
4. **Supabase Cron dari versi sebelumnya tidak diperlukan lagi.** Bila dulu Anda memasangnya, matikan di **Supabase, SQL Editor**:

   ```sql
   select cron.unschedule('presscompass-run');
   ```

   Bila tetap menyala pun aman: endpoint hanya menerbitkan artikel yang memang sudah jatuh tempo.

Catatan: bila proyek Vercel kembali ke Hobby, deploy akan gagal ("Hobby accounts are limited to daily cron jobs"). Ubah jadwal di `vercel.json` menjadi `0 23 * * *` dan pasang lagi Supabase Cron (lihat `docs/ops/setup.md` di v0.6.0).

## G. Konten awal (opsional)

Delapan belas artikel penjelas dengan ilustrasinya, plus halaman About, Contact, dan Privacy policy, untuk mengisi situs sebelum artikel sendiri terbit (`content/starter/README.md`). Butuh `.env` yang sudah berisi kunci Supabase dan Cloudinary (langkah B dan E).

```bash
npm run check
npm run content:starter -- --email alamat-kontak@anda
```

`npm run check` harus menulis ✓ untuk Supabase dan Cloudinary. `--email` mengisi alamat kontak di halaman Contact dan Privacy policy lalu menerbitkannya; tanpa `--email` halaman itu masuk sebagai Draft.

**Hasil yang diharapkan:** baris `✓ Cloudinary keys: accepted`, daftar `Published: ...`, lalu `Done. 18 published articles and 3 published pages`. Bila `npm run dev` sedang berjalan, situs lokal langsung diperbarui (atau hentikan dengan Ctrl+C dan jalankan lagi). Lalu push ke GitHub supaya deploy berikutnya memuatnya.
Untuk memeriksa artikel dulu di Newsroom: tambahkan `--draft`, lalu terbitkan dari **Articles**.

## H. Iklan: AdSense, Ad Manager, Meta Pixel, jaringan lain

Semua diisi di Newsroom, **Site, Ads**. Iklan baru tampil setelah sakelar **Show ads and run tracking code on the site** dinyalakan. Iklan termasuk penggunaan komersial, yang diizinkan Vercel di paket **Pro** (proyek PressCompass sudah Pro sejak 14 November 2026); jangan kembali ke Hobby selama iklan menyala.

1. **Halaman wajib.** Di **Pages**, lengkapi dan terbitkan **Privacy policy**, **About**, dan **Contact** (drafnya dari `npm run content:starter`). Ganti `[add your contact email here]` dengan email Anda. Teks Privacy policy sudah sesuai perilaku situs, tetapi itu tanggung jawab Anda; periksa sebelum terbit.
2. **Ads, Consent:** isi **Privacy policy link** `/privacy-policy`. Biarkan **Ask readers before loading ads and tracking code** menyala.
3. **Daftar AdSense** (https://adsense.google.com) dengan alamat `presscompass.site`. Isi **Publisher ID** (`ca-pub-...`, dari AdSense: Account, Settings, Account information) di Ads, lalu Save. Sakelar tetap mati: tag `google-adsense-account` dan `https://presscompass.site/ads.txt` langsung terpasang, jadi pilih verifikasi lewat **meta tag** atau **ads.txt** di AdSense. Status ads.txt di AdSense (Sites) harus **Authorized**. Persetujuan situs biasanya butuh beberapa hari sampai minggu.
4. **Iklan di wilayah EEA, Inggris, Swiss:** di AdSense, **Privacy & messaging, European regulations**, buat dan terbitkan pesan untuk presscompass.site (CMP Google, gratis). Tanpa itu, pembaca di sana hanya mendapat iklan terbatas.
5. **Unit iklan:** di AdSense **Ads, By ad unit**, buat unit (Display, In-feed, In-article, atau Multiplex). Di Newsroom, buka slot di tabel **Ad slots**, pilih **Google AdSense unit**, jenis yang sama, tempel angka `data-ad-slot` (untuk In-feed juga `data-ad-layout-key`), atur tinggi slot sesuai ukuran unit, centang **Show this slot**, Save. **Auto ads** (iklan yang ditaruh Google sendiri) dinyalakan lewat kotak **Load AdSense on every page for Auto ads** dan diatur di AdSense **Ads, By site**.
6. **Google Ad Manager:** di slot pilih **Google Ad Manager (GPT)**, isi path unit (`/kode-jaringan/nama-unit`, dari Ad Manager: Inventory, Ad units, Tags) dan ukuran (`300x250, 336x280`).
7. **Jaringan lain** (Adsterra, Media.net, PropellerAds, dan sejenisnya): kode banner ke slot (**Code from another network**); kode yang diminta di `<head>` atau sebelum `</body>` ke **Other code**; tag `<meta>` verifikasi mereka ke **Verification tags**; baris ads.txt mereka ke **ads.txt, Other lines**.
8. **Meta Pixel:** isi **Pixel ID** (Meta Events Manager, Data sources).
9. **Menyalakan:** setelah AdSense menyetujui situs (atau jaringan lain siap), centang **Show ads and run tracking code on the site**, Save. Buka situs di jendela penyamaran: banner muncul; setelah **Accept all**, slot terisi.

Mematikan: hapus centang sakelar, Save. Slot, banner, dan semua kode hilang dari situs dalam beberapa detik; tag verifikasi dan `ads.txt` tetap.

## I. SEO dan Google Search Console

Semua di Newsroom, grup **SEO**.

1. **SEO settings:** periksa nama situs, pola judul (`%s · PressCompass`), judul beranda, dan deskripsi situs (120 sampai 160 huruf). **Publication name** harus sama dengan nama yang nanti tampil di Google News. Isi **Profiles elsewhere** dengan alamat akun resmi PressCompass (X, Instagram, Facebook, LinkedIn), satu per baris, bila sudah ada.
2. **Menyalakan indexing:** saat situs siap dibaca publik, centang **Let search engines index the site**, Save. Situs Vercel Production berhenti memberi `noindex`; deploy Preview dan `npm run dev` tetap tersembunyi.
3. **Search Console** (https://search.google.com/search-console): tambahkan properti **Domain** `presscompass.site` dan verifikasi lewat DNS (Google memberi satu baris TXT untuk pengelola domain Anda). Lalu di **Sitemaps**, kirim `https://presscompass.site/sitemap.xml` dan `https://presscompass.site/news-sitemap.xml`. Pengiriman otomatis setiap kali terbit datang di v0.7.0.
4. **Saat menulis:** buka tab **SEO** di editor, isi **Focus keyphrase**, lalu ikuti daftar **Problems** dan **Improvements**. Skor hanya saran; aturan terbit tidak berubah.
5. **404 log:** periksa sesekali. Untuk alamat lama yang masih dicari, klik **Create redirect** dan isi alamat barunya.

## J. Redirect lewat Vercel (Pro)

Dengan paket Pro, redirect dari Newsroom (otomatis saat alamat artikel berubah, dan yang Anda buat di **SEO, Redirects**) dilayani langsung oleh CDN Vercel: pembaca dan Google mendapat redirect permanen 308 yang sungguhan di setiap kunjungan. Tanpa langkah ini redirect tetap jalan, tetapi lewat halaman.

1. **Token:** Vercel, foto profil, **Account Settings, Tokens, Create Token**. Nama `PressCompass redirects`, **Scope** tim Anda (bukan akun pribadi), **Expiration** paling lama yang tersedia. Salin token ke pengelola password; jangan kirim ke siapa pun.
2. **Team ID:** Vercel, pilih tim, **Settings, General**, salin **Team ID** (`team_...`).
3. **Project ID:** proyek presscompass, **Settings, General**, salin **Project ID** (`prj_...`).
4. **Vercel, proyek, Settings, Environment Variables**, centang **Production** saja:
   - `VERCEL_REDIRECTS_TOKEN` = token dari langkah 1;
   - `VERCEL_REDIRECTS_TEAM_ID` = Team ID;
   - `VERCEL_REDIRECTS_PROJECT_ID` = Project ID.

   Lalu **Redeploy** deploy Production terbaru.
5. Periksa setelah 5 menit: Newsroom, **SEO, Redirects** menulis "Vercel serves N redirects, updated …". Di Vercel, proyek, **Redirects**, daftar yang sama tampil. Kunjungi satu alamat lama: browser langsung pindah, dan `curl -sI https://presscompass.site/alamat-lama` menampilkan `308` dan baris `location:`.

Paket Pro mencakup 1.000 redirect seperti ini per proyek; lebih dari itu dikenai biaya kecil per 25.000 (lihat Vercel, Usage). Redirect "Gone (Page not found)" tidak ikut disalin; situs tetap menampilkan Page not found.

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
| Ads: "Add the privacy policy link (under Consent) before turning ads on" | isi Privacy policy link (langkah H2), lalu Save lagi |
| AdSense menulis ads.txt "Not found" atau "Unauthorized" | buka `https://presscompass.site/ads.txt`: barisnya harus memuat `pub-` dengan angka yang sama dengan ID penerbit; simpan Ads lagi bila perlu, tunggu AdSense memeriksa ulang (bisa sampai beberapa hari) |
| Slot tampil kosong setelah Accept all | unit AdSense baru atau situs belum disetujui (AdSense mengisi setelah disetujui), atau angka `data-ad-slot` salah |
| Search Console: "Couldn't fetch" untuk sitemap | buka alamat sitemap di browser; bila tampil XML, tunggu Google mencoba lagi (bisa sehari). Pastikan indexing sudah dinyalakan di SEO settings dan deploy Production yang terbaru |
| Pratinjau Facebook atau WhatsApp masih memakai gambar lama | platform itu menyimpan kartu lama beberapa hari; tanda Major update memperbarui alamat gambar otomatis. Facebook bisa dipaksa lewat Sharing Debugger |
| Redirects menulis "the last update failed (Vercel answered 403 ...)" | token tidak punya akses ke tim, atau Team ID/Project ID salah: buat token dengan Scope tim (langkah J1), periksa ketiga env, lalu Redeploy |
| Deploy gagal: "Hobby accounts are limited to daily cron jobs" | proyek Vercel kembali ke Hobby; lihat catatan di langkah F |
| Beranda menulis "The first stories are on their way" | belum ada artikel terbit: jalankan `npm run check`, perbaiki yang bertanda ✗, lalu `npm run content:starter` |
| `npm run dev`: "Supabase did not answer within 8.5 seconds" | koneksi ke Supabase tersendat atau proyek sedang dijeda/dipulihkan (Supabase Free menjeda proyek setelah 7 hari tanpa aktivitas): buka dashboard Supabase, pastikan proyek aktif, lalu muat ulang halaman |
| Deploy Vercel diblokir: commit author tidak punya akses | perintah pasang selalu memuat `git commit --amend --no-edit --reset-author` sebelum push; jalankan lalu push lagi |
