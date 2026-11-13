# Rencana 3 · Media Cloudinary (v0.3.0)

> **Untuk agen:** jalankan task demi task (skill executing-plans), TDD, commit per task. Kode akhir ada di lampiran di bawah (dibuat dari repo setelah eksekusi).

**Tujuan:** pemilik bisa mengunggah gambar ke Cloudinary dari Newsroom, mengelolanya di pustaka media (alt, keterangan, kredit, dipakai di mana, hapus), memilih gambar utama artikel, menyisipkan blok gambar di isi, dan memberi foto penulis. Artikel baru bisa terbit bila gambar utamanya ada dan semua gambar ber-alt.

**Arsitektur:**
- Browser mengunggah langsung ke Cloudinary dengan parameter yang ditandatangani server (Server Action `prepareUpload`), jadi file tidak lewat fungsi Vercel.
- Server lalu memeriksa aset lewat Admin API Cloudinary (`registerUpload`) dan menyimpan ukurannya dari Cloudinary, bukan dari browser.
- Gambar dikirim dari CDN Cloudinary dengan `srcset` (`f_auto,q_auto`, lebar terbatas) oleh komponen `CloudImage` yang bisa dirender server maupun klien.
- Penggunaan media (gambar utama, blok gambar di isi, foto penulis) dihitung oleh fungsi SQL dari data yang ada, tanpa tabel tambahan.
- Tes memakai Cloudinary tiruan di server tiruan yang sama dengan Supabase tiruan: menerima unggahan multipart, **memeriksa tanda tangan**, membaca ukuran PNG/JPEG/GIF, melayani Admin API, destroy, dan pengiriman gambar.

**Stack:** tanpa dependensi baru. Tanda tangan SHA-1 dengan `node:crypto`, HTTP dengan `fetch`, unggah dari browser dengan `XMLHttpRequest` (untuk progres).

## Batasan global

- Semua batasan Rencana 1 dan 2 tetap berlaku (bahasa, tanpa Docker, `requireStaff()`, RLS, token desain, id unik per mount).
- Kredensial: `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` (publik, ada di URL gambar), `CLOUDINARY_API_KEY` dan `CLOUDINARY_API_SECRET` (hanya server). Secret tidak pernah dikirim ke browser.
- Override khusus tes: `NEXT_PUBLIC_CLOUDINARY_DELIVERY_URL` dan `CLOUDINARY_API_URL` (bawaan `https://res.cloudinary.com` dan `https://api.cloudinary.com`). Pemilik tidak pernah mengisinya.
- Format yang diterima: JPEG, PNG, WebP, AVIF, GIF; maksimal 10 MB (batas berkas Cloudinary Free).
- Transformasi masuk `c_limit,w_2560,q_auto`; folder `presscompass/images`; `overwrite=false`; public ID `presscompass/images/<slug-nama>-<8 hex>` dibuat server.
- Pengiriman: preset `original` (`c_limit`), `hero` (16:9), `card` (3:2), `square` (1:1), semuanya `c_fill,g_auto` kecuali original; lebar `srcset` 320/640/960/1280/1920, tidak melebihi lebar asli.

## Keputusan rencana

| Topik | Keputusan |
|---|---|
| `next/image` | Tidak dipakai. Loader kustom Next hanya membuat `srcset`, dan fungsi loader tidak bisa dioper dari Server Component. `CloudImage` membuat `<img srcset sizes width height>` yang sama tanpa JavaScript klien dan bisa diuji unit. Optimasi gambar Vercel tetap tidak tersentuh. |
| Tanpa kredensial | Situs tetap berjalan; unggah dimatikan dengan pesan cara mengisi kunci; Dashboard menulis "Media: Not connected". Spesifikasi §11 meminta produksi menolak berjalan; diubah menjadi peringatan karena Newsroom yang mati lebih merugikan, dan tanpa kredensial memang belum ada gambar. |
| Alt | Disimpan di media (satu sumber), bisa diubah dari pustaka maupun dialog pemilih. Keterangan per pemakaian: `lead_caption` untuk gambar utama, `caption` di blok gambar (bawaan dari keterangan media). Kredit dari media. |
| Aturan terbit | Ditambah: gambar utama dipilih dan ber-alt; semua gambar di isi ber-alt. |
| Hapus media | Diblokir bila dipakai. Baris database dihapus dulu, lalu aset di Cloudinary (`destroy` dengan `invalidate`). Bila destroy gagal, dicatat di log. |
| Penggunaan | `media_usage(id)` dan hitungan di `newsroom_media()` membaca `lead_media_id`, `photo_media_id`, dan blok `image` di `articles.body` lewat `jsonb_path_query`. |

## Task

### Task 1: Inti media murni
- `src/lib/media/url.ts`: preset, `cloudinaryUrl`, `imageSources` (src, srcset, width, height per preset). Tes unit.
- `src/modules/media/cloudinary.ts`: `signParams` (contoh resmi Cloudinary sebagai vektor tes), `uploadPlan`, `publicIdFor`, klien Admin API (`fetchResource`, `destroyAsset`). Tes unit.
- `src/modules/media/validate.ts`: jenis dan ukuran file, detail media (alt ≤ 300, keterangan ≤ 300, kredit ≤ 120). Tes unit.

### Task 2: Cloudinary tiruan + migrasi
- `tests/fake-supabase/cloudinary.mjs`: upload multipart bertanda tangan, Admin API, destroy, pengiriman gambar, CORS.
- Migrasi `20261115000100_media.sql`: `media_usage`, `newsroom_media`, hak akses. Tes database.

### Task 3: Pustaka media
- Server Actions `prepareUpload`, `registerUpload`, `updateMedia`, `deleteMedia`, `searchMedia`; halaman `/newsroom/media` dan `/newsroom/media/[id]`; komponen `UploadButton` dengan progres; menu Media.

### Task 4: Pemilih gambar, gambar utama, blok gambar, foto penulis
- `ImagePickerDialog` (pustaka + unggah + alt/keterangan/kredit).
- Editor: kartu Lead image di panel, tombol Image di toolbar, node `image` (skema, sanitasi, Tiptap, `ArticleBody`), aturan terbit baru, pratinjau dengan gambar.
- Penulis: foto profil.

### Task 5: Verifikasi dan kiriman
- Semua tes, E2E media, cek visual, dokumen (`.env.example`, setup Cloudinary), CHANGELOG, versi 0.3.0, zip.
