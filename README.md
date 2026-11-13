# PressCompass

Media berita berbahasa Inggris tentang Indonesia di presscompass.site, lengkap dengan CMS sendiri (Newsroom) di `/newsroom`.

- **Stack:** Next.js 16 (App Router) di Vercel Hobby, Supabase Free (database dan login), Cloudinary Free (gambar).
- **Tanpa Docker.** Semua perintah memakai npm dan Node 26.
- **Sinkron ke Supabase** hanya lewat kunci bawaan proyek Supabase: Project URL, publishable key, dan secret key.

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm ci` | memasang dependensi persis sesuai `package-lock.json` |
| `npm run dev` | menjalankan situs di http://localhost:3000 dengan proyek Supabase dari `.env` (data yang sama dengan situs live) |
| `npm run db:login` | masuk ke Supabase CLI (sekali per komputer, membuka browser) |
| `npm run db:link -- --project-ref KODE` | menautkan folder ini ke proyek Supabase (meminta password database) |
| `npm run db:push` | menerapkan migrasi baru ke proyek Supabase yang ditautkan |
| `npm run staff:grant -- email@anda.com` | memberi akses Newsroom ke pengguna Supabase |
| `npm run content:starter` | memasang 10 artikel awal beserta ilustrasinya (Cloudinary); aman dijalankan ulang |

Langkah pemasangan lengkap: `docs/ops/setup.md`. Memasang versi baru: `docs/ops/update.md`. Riwayat versi: `CHANGELOG.md`.

## Situs publik (v0.4.0)

- **Beranda** otomatis: lead dan Top stories, satu baris per rubrik di navigasi, Opinion.
- **Artikel** `/{rubrik}/{slug}` dengan byline, gambar utama, isi (termasuk Chart), sumber, tag, Related, dan More from; **rubrik**, **penulis** `/author/{slug}`, **tag** `/tag/{slug}` (24 artikel per halaman, `/page/2` dan seterusnya), **cari** `/search`, dan halaman 404.
- Header dengan tanggal (WIB), menu, navigasi rubrik, pita Latest (24 jam terakhir); footer navy dengan sakelar tema Auto, Light, Dark.
- Halaman disimpan di cache dan diperbarui sendiri setelah perubahan di Newsroom. Artikel terjadwal terbit lewat `/api/cron/run` (Vercel Cron harian, Supabase Cron 5 menit: `docs/ops/setup.md` langkah F).
- Situs masih `noindex` sampai rilis (Rencana 8).

## Konten awal (v0.4.1)

- Sepuluh artikel penjelas berbahasa Inggris dengan sumber dan ilustrasi buatan sendiri, satu atau dua per rubrik (News, Politics, Business, World, Science, Data), tiga di antaranya dengan Chart.
- Dipasang dengan `npm run content:starter` (atau `-- --draft` untuk diperiksa dulu). Setelah itu menjadi artikel biasa di Newsroom. Rincian: `content/starter/README.md`.

## Newsroom (v0.4.0)

- **Articles:** daftar dengan tab status, cari, filter, aksi massal; editor blok dengan autosave, jadwal (WIB), riwayat versi, dan pratinjau yang sama persis dengan halaman situs. Gambar utama, blok gambar, dan blok Chart (tempel tabel dari spreadsheet).
- **Media:** pustaka gambar di Cloudinary (unggah, alt text, kredit, dipakai di mana, hapus). Artikel hanya bisa terbit bila gambar utama dan semua gambarnya punya alt text.
- **Sections, Tags, Authors:** dibuat dan diubah di Newsroom, termasuk foto penulis; alamat lama otomatis dialihkan (308) bila alamat yang sudah terbit berubah.
- **Dashboard:** jumlah artikel per status, artikel terbaru, dan status database serta Cloudinary.

## Tes

CI GitHub menjalankan semua tes di setiap push. Anda tidak perlu menjalankannya di komputer; centang hijau di GitHub adalah buktinya.
