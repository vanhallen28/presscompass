# Konten awal PressCompass

Delapan belas artikel penjelas (explainer, analysis, feature) berbahasa Inggris dengan ilustrasinya, tiga di setiap rubrik,
plus halaman About, Contact, dan Privacy policy, untuk mengisi situs sebelum artikel redaksi sendiri terbit. Semuanya
ditulis dari sumber publik yang dicantumkan di bagian **Sources** setiap artikel, dengan angka bertanggal. Ini bukan berita
yang dikarang: periksa ulang angkanya bila artikel tetap tayang lama, karena data seperti status gunung api, utang Whoosh,
atau angka inflasi berubah.

| Rubrik | Artikel |
|---|---|
| News | Why Indonesia has three time zones · How Indonesia goes home for Eid · How Indonesia marks Independence Day |
| Politics | How Indonesia's parliament works · Nusantara: where Indonesia's new capital stands · How Indonesia elects its president (Chart) |
| Business | How Indonesia keeps rice on the shelves · Why Indonesia stopped selling raw nickel ore (Chart) · Whoosh: the fast train and its debts |
| World | What BRICS membership means for Indonesia · ASEAN welcomes its eleventh member, Timor-Leste · Indonesia and the North Natuna Sea |
| Science | How Indonesia watches its 127 active volcanoes · Why Indonesia's peatlands keep burning · How many Komodo dragons are left |
| Data | Indonesia's economy in 2025 (Chart) · Where Indonesia's 290 million people live (Chart) · Prices in Indonesia: inflation since 2020 (Chart) |

Ilustrasi (1800 × 1200 JPEG, 18 berkas di `images/`) dibuat khusus untuk PressCompass, jadi bebas dipakai. Kreditnya
**Illustration: PressCompass** dan tampil apa adanya di bawah gambar (kredit biasa tampil sebagai "Photo: …").

## Memasang

```bash
npm run check
npm run content:starter -- --email alamat-kontak@anda
```

- Sebelum menulis apa pun, perintah ini memeriksa `.env`, Supabase (dan migrasinya), serta kunci Cloudinary. Bila ada yang salah, ia berhenti dengan pesan cara memperbaikinya, dan tidak ada yang berubah.
- Gambar diunggah ke Cloudinary (`presscompass/images/starter-*`) dan masuk ke **Media** dengan alt text, keterangan, dan kredit.
- Rubrik News, Politics, Business, World, Science, Data dibuat bila belum ada. Rubrik yang sudah ada tidak diubah.
- Penulis **PressCompass Desk** (Staff) dan tag dibuat bila belum ada.
- Artikel langsung terbit dengan waktu terbit tersebar dalam dua hari terakhir, masing-masing dengan satu versi awal di History.
- `--email` mengganti `[add your contact email here]` dengan alamat Anda dan menerbitkan About, Contact, Privacy policy. Tanpa `--email`, halaman itu masuk sebagai Draft. Halaman yang sudah Anda ubah di Newsroom tidak disentuh.
- Aman dijalankan ulang: artikel, gambar, rubrik, tag, penulis, dan halaman yang sudah ada dilewati. Menjalankan ulang di proyek yang sudah berisi 10 artikel lama hanya menambah 8 artikel baru.
- Bila `npm run dev` sedang berjalan dan `.env` berisi `CRON_SECRET`, situs lokal langsung diperbarui.
- `npm run content:starter -- --draft` memasukkan semuanya sebagai Draft untuk diperiksa dulu di Newsroom.
- `npm run content:starter -- --dry-run` hanya memeriksa berkas, tanpa menyentuh Supabase atau Cloudinary.

Jalankan **sebelum** `git push`: build Vercel menyiapkan halaman dari isi database, jadi deploy berikutnya langsung memuat artikel ini.

## Mengubah atau menghapus

Setelah dipasang, artikel menjadi artikel biasa di Newsroom (**Articles**): ubah, Unpublish, atau hapus seperti artikel lain.
Gambar yang tidak dipakai lagi bisa dihapus di **Media**. Mengubah berkas di folder ini tidak mengubah artikel yang sudah dipasang.

## Format berkas (untuk menambah artikel)

Setiap artikel di `articles/` diawali blok `---` berisi `title`, `slug`, `section` (slug rubrik di atas), `type`
(news, analysis, explainer, opinion, feature), `kicker`, `standfirst`, `image` (nama berkas di `images/` tanpa `.jpg`),
`alt`, `caption`, `tags`, `related` (slug artikel lain di paket ini), `hoursAgo`, dan `sources`
(`- Judul | URL | Penerbit | YYYY-MM-DD`). Isinya memakai `## ` untuk subjudul, paragraf, daftar `- `, **tebal**, *miring*,
[tautan](https://…), serta blok ` ```figures ` (Key figures) dan ` ```chart ` (Chart) berisi JSON. `npm test` memeriksa
bahwa setiap berkas lolos aturan editor (`tests/unit/starter.test.ts`).

Ilustrasi digambar ulang dengan:

```bash
python3 content/starter/tools/scenes.py /tmp/scenes
node content/starter/tools/render.mjs /tmp/scenes content/starter/images
```
