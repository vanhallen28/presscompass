# PressCompass

Media berita berbahasa Inggris tentang Indonesia di presscompass.site, lengkap dengan CMS sendiri (Newsroom) di `/newsroom`.

- **Stack:** Next.js 16 (App Router) di Vercel Hobby, Supabase Free (database dan login), Cloudinary Free (gambar, mulai v0.3.0).
- **Tanpa Docker.** Semua perintah memakai npm dan Node 26.
- **Sinkron ke Supabase** hanya lewat kunci bawaan proyek Supabase: Project URL, publishable key, dan secret key.

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm ci` | memasang dependensi persis sesuai `package-lock.json` |
| `npm run dev` | menjalankan situs di http://localhost:3000 dengan proyek Supabase pratinjau dari `.env` |
| `npm run db:login` | masuk ke Supabase CLI (sekali per komputer, membuka browser) |
| `npm run db:link -- --project-ref KODE` | menautkan folder ini ke proyek Supabase (meminta password database) |
| `npm run db:push` | menerapkan migrasi baru ke proyek Supabase yang ditautkan |
| `npm run staff:grant -- email@anda.com` | memberi akses Newsroom ke pengguna Supabase |

Langkah pemasangan lengkap: `docs/ops/setup.md`. Riwayat versi: `CHANGELOG.md`.

## Tes

CI GitHub menjalankan semua tes di setiap push. Anda tidak perlu menjalankannya di komputer; centang hijau di GitHub adalah buktinya.
