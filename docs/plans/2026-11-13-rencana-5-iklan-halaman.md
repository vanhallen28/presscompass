# Rencana 5: Iklan, persetujuan cookie, dan halaman statis (v0.5.0)

**Permintaan pemilik (13 November 2026):** "tambahkan semua jenis kode iklan dan kode adsense, buat halaman baru", lalu editor artikel seperti WordPress dengan skor standar Google, dan pengindeksan otomatis. Pemilik memilih tiga versi berurutan: v0.5.0 iklan, v0.6.0 editor + skor SEO, v0.7.0 indexing. Jenis iklan yang dipilih: Google AdSense, Google Ad Manager (GPT), kode jaringan lain, dan Meta Pixel.

**Tujuan:** semua kode iklan dan pelacakan bisa diisi dari satu halaman **Ads** di Newsroom, tampil di slot tetap tanpa menggeser halaman, dan hanya dimuat setelah pembaca menyetujui; ditambah halaman statis (Pages) karena AdSense memeriksa Privacy policy, About, dan Contact sebelum menyetujui situs.

**Arsitektur:**

- Database: `ad_settings` (satu baris) dan `ad_slots` (8 penempatan tetap), hanya staf yang bisa membaca dan mengubah. Situs membaca lewat `site_ads()` (security definer) yang mengembalikan kode hanya saat sakelar menyala; ID penerbit AdSense, tag verifikasi, dan baris `ads.txt` selalu dikembalikan.
- Modul `src/modules/ads` (tipe, validasi murni, query, Server Action) dan `src/modules/pages`.
- Situs: layout `(site)` memasang skrip awal persetujuan, `AdRuntime` (memuat AdSense, GPT, Meta Pixel, dan kode `<head>`/`<body>` sekali), dan `ConsentBanner`. `AdSlot` (server) memesan kotak setinggi pengaturan; `AdFill` (klien) mengisinya saat pembaca sudah setuju dan slot hampir terlihat.
- Halaman tetap statis: server tidak membaca cookie. Skrip awal menulis `<html data-consent="unset|necessary|all">` sebelum halaman tampil, dan CSS memakai atribut itu untuk banner dan slot.

## Keputusan

| Hal | Keputusan | Alasan |
|---|---|---|
| Vercel Hobby | Sakelar utama "Show ads and run tracking code" mati bawaan, dengan peringatan di halaman Ads | Fair Use Vercel: Hobby hanya non-komersial; "the inclusion of advertisements ... like Google AdSense" termasuk komersial |
| Selama sakelar mati | Meta `google-adsense-account`, tag verifikasi lain, dan `/ads.txt` tetap terpasang | Supaya pemilik bisa mendaftar dan diverifikasi AdSense atau jaringan lain sebelum pindah ke Pro |
| Persetujuan | Banner sendiri dengan dua pilihan setara (Accept all, Necessary only), cookie `pc_consent` 12 bulan, Consent Mode v2 (semua `denied` sebelum pilihan), tombol Cookie settings di footer, menarik persetujuan menghapus cookie iklan di domain lalu memuat ulang | Pembaca berbahasa Inggris datang juga dari EEA, Inggris, Swiss; Meta Pixel dan jaringan lain tidak dicakup CMP Google; UU PDP meminta persetujuan. Pola sama dengan point.lat |
| Persetujuan bisa dimatikan | Kotak "Ask readers before loading ads and tracking code" (bawaan menyala) | Keputusan hukum milik pemilik; bila dimatikan semua kode dimuat langsung |
| Syarat menyalakan | Tautan Privacy policy wajib diisi | AdSense dan Meta mewajibkan kebijakan privasi |
| Penempatan | 8 slot tetap: bawah header, beranda (setelah baris rubrik kedua), daftar (setelah cerita keenam), dua di dalam artikel (setelah paragraf ke-N, hanya bila masih ada dua paragraf sesudahnya), akhir artikel, kolom samping artikel, atas footer. Tidak ada di halaman statis dan 404 | Iklan di tempat tetap dengan ruang dipesan, jauh dari judul dan navigasi (kebijakan penempatan AdSense) |
| Tinggi slot | Per slot untuk HP dan layar lebar; 0 menyembunyikan slot di ukuran itu | Mencegah pergeseran tata letak (CLS) |
| AdSense | ID penerbit diterima dalam bentuk `ca-pub-`, `pub-`, atau baris ads.txt; unit Display (responsif), In-article, In-feed (dengan layout key), Multiplex; Auto ads lewat kotak sendiri | Format kode resmi AdSense; Auto ads diatur di AdSense per situs |
| Google Ad Manager | Path unit + ukuran per slot; `gpt.js` dimuat sekali, slot didefinisikan saat terlihat dan dihapus saat halaman ditinggalkan | Navigasi Next.js tanpa muat ulang |
| Kode jaringan lain | Kode `<head>` dan akhir `<body>` disisipkan langsung (skrip berjalan); kode slot berjalan di iframe `srcdoc` seukuran slot dengan `<base target="_blank">` | Banyak kode banner memakai `document.write`; iframe mengisolasi tata letak |
| Meta Pixel | ID pixel; PageView setiap halaman, juga saat pindah halaman tanpa muat ulang | Pola kode dasar Meta |
| Halaman statis | Tabel `pages` (sudah ada sejak Rencana 1), isi disimpan sebagai blok `[{type: "text", body}]`, editor blok yang sama dengan artikel, status Draft/Published, tampil di `/{alamat}` dan di footer. Rubrik dan halaman tidak boleh memakai alamat yang sama | Page builder penuh tetap Rencana 8; bentuk blok menyiapkannya |
| Draf halaman | About, Contact, Privacy policy dari `npm run content:starter` sebagai Draft; email kontak ditulis sebagai `[add your contact email here]` | Teks hukum dan kontak milik pemilik; draf sesuai perilaku situs (cookie `pc_consent`, tema di local storage, Vercel, Cloudinary, Google, Meta) |

## Tugas (sudah dikerjakan)

1. Migrasi `20261117000100_ads_pages.sql`: `ad_settings`, `ad_slots` (RLS staf, tanpa insert/delete lewat Data API), `site_ads()`, `page_body()`, `site_page()`, `site_pages()`, `media_usage()` menghitung halaman. Tes `tests/db/ads-pages.test.ts`.
2. `src/modules/ads`: `types.ts`, `validate.ts` (ID AdSense, ads.txt IAB, tag verifikasi, ukuran GPT, form pengaturan dan slot, posisi slot dalam artikel), `queries.ts`, `actions.ts`. Tes `tests/unit/ads.test.ts`.
3. Newsroom: `/newsroom/ads` (pengaturan + tabel slot), `/newsroom/ads/[placement]`, menu Site, Ads.
4. Situs: layout `(site)`, `consent.ts`, `loader.ts`, `AdRuntime`, `AdFill`, `AdSlot`, `ConsentBanner`, `CookieSettingsButton`, slot di `SitePage`, beranda, `ListView`, halaman artikel; `/ads.txt`.
5. Pages: `src/modules/pages`, `/newsroom/pages`, editor `PageEditor`, `StaticPageView`, rute `[section]` jatuh ke halaman bila rubrik tidak ada, tautan footer, `Used in` di Media.
6. Konten awal: `content/starter/pages/` (about, contact, privacy-policy) diimpor sebagai Draft.
7. E2E: `tests/e2e/ads.spec.ts` (proyek Playwright `ads` yang berjalan setelah semua tes lain, domain Google dan Meta dijawab skrip tiruan), `tests/e2e/pages.spec.ts`.

## Hasil

- Unit 128, database 48, E2E 64 lulus (23 dilewati sengaja). Build berhasil; `/ads.txt` prerender dan diperbarui lewat tag `site`.
- Cek visual: banner terang dan di HP, artikel dengan slot (bawah header, dalam artikel, akhir, kolom samping), halaman Ads dan editor halaman di Newsroom; tidak ada geser samping di 390 px.

## Sumber riset

- Vercel Fair Use Guidelines, Commercial usage (diperbarui 14 September 2026): https://vercel.com/docs/limits/fair-use-guidelines
- Tag meta `google-adsense-account` untuk verifikasi situs: https://developers.google.com/adsense/platforms/direct/meta-tags
- Meta Pixel dan GDPR (`fbq('consent', 'revoke' | 'grant')`): https://developers.facebook.com/documentation/meta-pixel/implementation/gdpr
- Format kode unit AdSense, panduan ads.txt, kebijakan penempatan, Consent Mode, persyaratan CMP Google: riset point.lat Rencana 8A (`claude/point-lat-rencana-8a-iklan-privasi.md`), dipakai ulang.
