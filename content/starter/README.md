# Konten awal PressCompass

Sepuluh artikel penjelas (explainer dan analysis) berbahasa Inggris dengan ilustrasinya, untuk mengisi situs sebelum
artikel redaksi sendiri terbit. Semuanya ditulis dari sumber publik yang dicantumkan di bagian **Sources** setiap artikel,
dengan angka bertanggal. Ini bukan berita yang dikarang: periksa ulang angkanya bila artikel tetap tayang lama, karena
data seperti status gunung api atau luas kebakaran berubah.

| Artikel | Rubrik | Gambar |
|---|---|---|
| How Indonesia keeps rice on the shelves | Business | `rice.jpg` |
| Why Indonesia stopped selling raw nickel ore (dengan Chart) | Business | `nickel.jpg` |
| How Indonesia's parliament works | Politics | `parliament.jpg` |
| How Indonesia watches its 127 active volcanoes | Science | `volcano.jpg` |
| Nusantara: where Indonesia's new capital stands | Politics | `nusantara.jpg` |
| What BRICS membership means for Indonesia | World | `world.jpg` |
| Why Indonesia's peatlands keep burning | Science | `haze.jpg` |
| Indonesia's economy in 2025: what drove growth (dengan Chart) | Data | `economy.jpg` |
| Where Indonesia's 290 million people live (dengan Chart) | Data | `population.jpg` |
| Why Indonesia has three time zones | News | `timezones.jpg` |

Ilustrasi (1800 × 1200 JPEG) dibuat khusus untuk PressCompass, jadi bebas dipakai. Kreditnya
**Illustration: PressCompass** dan tampil apa adanya di bawah gambar (kredit biasa tampil sebagai "Photo: …").

## Memasang

```bash
npm run content:starter
```

- Gambar diunggah ke Cloudinary (`presscompass/images/starter-*`) dan masuk ke **Media** dengan alt text, keterangan, dan kredit.
- Rubrik News, Politics, Business, World, Science, Data dibuat bila belum ada. Rubrik yang sudah ada tidak diubah.
- Penulis **PressCompass Desk** (Staff) dan tag dibuat bila belum ada.
- Artikel langsung terbit dengan waktu terbit tersebar dalam 30 jam terakhir, masing-masing dengan satu versi awal di History.
- Aman dijalankan ulang: artikel, gambar, rubrik, tag, dan penulis yang sudah ada dilewati.
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
