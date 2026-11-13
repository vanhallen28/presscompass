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

Langkah pemasangan lengkap: `docs/ops/setup.md`. Memasang versi baru: `docs/ops/update.md`. Riwayat versi: `CHANGELOG.md`.

## Newsroom (v0.3.0)

- **Articles:** daftar dengan tab status, cari, filter, aksi massal; editor blok dengan autosave, jadwal (WIB), riwayat versi, dan pratinjau. Gambar utama dan blok gambar dengan keterangan.
- **Media:** pustaka gambar di Cloudinary (unggah, alt text, kredit, dipakai di mana, hapus). Artikel hanya bisa terbit bila gambar utama dan semua gambarnya punya alt text.
- **Sections, Tags, Authors:** dibuat dan diubah di Newsroom, termasuk foto penulis; alamat lama otomatis dialihkan (308) bila alamat yang sudah terbit berubah.
- **Dashboard:** jumlah artikel per status, artikel terbaru, dan status database serta Cloudinary.

## Tes

CI GitHub menjalankan semua tes di setiap push. Anda tidak perlu menjalankannya di komputer; centang hijau di GitHub adalah buktinya.
