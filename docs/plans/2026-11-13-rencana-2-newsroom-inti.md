# Rencana 2 · Newsroom inti (v0.2.0)

> **Untuk agen:** jalankan task demi task (skill executing-plans), TDD, commit per task. Kode akhir setiap file ada di lampiran di bagian bawah dokumen ini (dibuat dari repo setelah eksekusi).

**Tujuan:** pemilik bisa mengelola rubrik, tag, dan penulis, lalu menulis artikel di editor blok dengan alur draf → review → jadwal/terbit → arsip, autosave, riwayat versi, dan pratinjau.

**Arsitektur:**
- Logika murni (slug, dokumen editor, alur status, aturan terbit, waktu WIB) diuji unit.
- Penyimpanan artikel atomik lewat satu fungsi SQL `save_article` (cek versi, slug unik, relasi, riwayat) yang berjalan dengan sesi pemilik, jadi RLS tetap berlaku.
- Redirect 308 otomatis dibuat trigger database saat alamat publik berubah.
- E2E memakai PostgreSQL sungguhan lewat Supabase tiruan yang menerjemahkan permintaan supabase-js ke SQL dengan peran dan RLS yang sama.

**Stack:** Next.js 16.4.6 (Cache Components), Supabase (`@supabase/ssr`, `@supabase/supabase-js`), Tiptap 3.32.3 (inti MIT), Vitest, Playwright.

## Batasan global

- Semua teks yang dilihat pemilik di Newsroom berbahasa Inggris (British, sentence case, tanpa tanda seru).
- Tanpa Docker. Tes database dan E2E memakai PostgreSQL biasa.
- Setiap halaman, layout, dan Server Action Newsroom memanggil `requireStaff()`.
- Migrasi hanya menambah, dengan RLS dan tes di `tests/db/`.
- Komponen memakai token CSS design system, bukan warna tetap.
- Zona waktu tampilan dan input jadwal: WIB (Asia/Jakarta, UTC+7). Database tetap UTC.

## Keputusan rencana

| Topik | Keputusan |
|---|---|
| Lingkup blok isi | Paragraf, H2, H3, daftar, kutipan, Pull quote, Editor's note (update atau koreksi), Key figures (2 sampai 4), tabel, YouTube (klik untuk memuat), kartu Read more, pemisah. **Gambar** (blok dan gambar utama) ikut Rencana 3 karena butuh pustaka media. **Chart** ikut Rencana 4 karena digambar SVG oleh situs. |
| Aturan terbit v0.2.0 | Judul, slug sudah diisi (bukan `untitled-…`) dan unik, rubrik, minimal satu penulis, standfirst, isi minimal 150 kata. Aturan gambar utama dengan alt ditambahkan di Rencana 3. |
| Tab SEO di editor | Rencana 6. Kolom `seo` tidak diubah editor v0.2.0. |
| Alur status | draft → review → published/scheduled → archived. Satu tombol utama per status (langkah maju berikutnya), aksi lain di bawahnya. Unpublish, Archive, dan Delete meminta konfirmasi. Artikel terbit tidak bisa dihapus; batalkan terbit atau arsipkan dulu. |
| Autosave | Setiap 10 detik bila ada perubahan, hanya untuk Draft dan In review. Artikel terjadwal dan terbit disimpan lewat tombol (Save changes / Update) supaya perubahan ke situs live selalu disengaja. |
| Riwayat versi | Satu versi per simpan manual dan per perubahan status; autosave paling banyak satu versi per 10 menit; 50 versi terakhir per artikel. Restore menyimpan keadaan sekarang dulu ("Before restore"). |
| Tabrakan dua jendela | Kolom `version` naik di setiap update (trigger). Simpan dengan versi lama ditolak: "This article changed in another window." |
| Slug | Otomatis dari judul sampai diubah manual atau artikel pernah terbit. Slug otomatis yang bentrok diberi akhiran `-2`, `-3`; slug manual yang bentrok ditolak dengan pesan di kolom slug. |
| Redirect otomatis | Trigger: alamat artikel terbit berubah (slug atau rubrik), slug rubrik berubah (rubrik + artikel terbitnya), slug tag atau penulis berubah (bila punya artikel terbit). Rantai dipendekkan jadi satu lompatan. |
| Terbit terjadwal | Fungsi `publish_due_articles()` dipanggil setiap halaman Newsroom dibuka. Pemanggil otomatis (cron `/api/cron/run`) datang bersama situs publik dan revalidasi cache. |
| Tag baru dari editor | Belum: tag dibuat di halaman Tags. Ditinjau lagi setelah dipakai. |
| E2E | `tests/fake-supabase/` menggantikan `tests/e2e/mock-supabase.mjs`: Auth tiruan + REST yang menjalankan SQL sungguhan di PostgreSQL lokal (database `presscompass_e2e`) dengan peran `anon`/`authenticated`/`service_role` dan klaim JWT. Data API yang kompleks dibaca lewat fungsi SQL (RPC), jadi penerjemah cukup mendukung filter sederhana. |

## Struktur file

| File | Tanggung jawab |
|---|---|
| `supabase/migrations/20261114000100_newsroom_core.sql` | trigger versi, redirect otomatis, pangkas riwayat; fungsi `save_article`, `record_revision`, `set_article_status`, `publish_due_articles`, `newsroom_articles`, `article_status_counts`, `newsroom_usage`, `newsroom_dashboard` |
| `src/lib/slug.ts` | `slugify`, `isSlug`, `RESERVED_SLUGS` |
| `src/lib/time.ts` | `parseWibInput`, `toWibInput`, `formatWib`, `wibDayStart` |
| `src/lib/doc/schema.ts`, `sanitize.ts`, `text.ts` | model dokumen editor, sanitasi allowlist, teks polos dan hitung kata |
| `src/modules/editor/status.ts` | aksi per status, rencana transisi, label dan catatan riwayat |
| `src/modules/editor/rules.ts` | aturan terbit → galat per kolom |
| `src/modules/editor/input.ts` | validasi bentuk input editor dari klien |
| `src/modules/editor/queries.ts`, `actions.ts` | baca dan tulis artikel (server) |
| `src/modules/taxonomy/validate.ts`, `queries.ts`, `actions.ts` | rubrik, tag, penulis |
| `src/modules/content/ArticleBody.tsx` | render dokumen ke React (pratinjau sekarang, situs di Rencana 4) |
| `src/components/newsroom/*` | kit UI Newsroom: Field, SelectField, StatusBadge, Notice, ConfirmButton, PageHeader, tabel |
| `src/components/newsroom/editor/*` | editor Tiptap, toolbar, node view, dialog blok |
| `src/app/newsroom/(app)/{articles,sections,tags,authors}/…` | halaman Newsroom |
| `src/app/newsroom/preview/[id]/page.tsx` | pratinjau artikel |
| `tests/fake-supabase/*` | Supabase tiruan untuk E2E dan pratinjau lokal |

## Task

### Task 1: Supabase tiruan dengan PostgreSQL sungguhan
- Pindahkan Auth tiruan ke `tests/fake-supabase/auth.mjs`; tambah `rest.mjs` (select dengan kolom, filter `eq/neq/gt/gte/lt/lte/like/ilike/is/in`, `order`, `limit/offset`, `count=exact`, objek tunggal; insert/upsert; update; delete; RPC dengan argumen bernama); `database.mjs` membuat database baru dari stub + migrasi + dua pengguna.
- Playwright dan CI job `e2e` menjalankan PostgreSQL runner (`scripts/ci-postgres.sh`).
- Tes: E2E fondasi lama tetap lulus dengan Supabase tiruan baru.

### Task 2: Migrasi newsroom_core + tes database
- Tes dulu (`tests/db/newsroom.test.ts`): versi naik; konflik versi; slug bentrok (manual ditolak, otomatis diberi akhiran); relasi berurutan; riwayat (dicatat, dibatasi 10 menit untuk autosave, dipangkas ke 50); redirect artikel, rubrik, rantai, kembali ke alamat lama; `publish_due_articles`; daftar dan hitungan; non-staf dan `anon` ditolak.

### Task 3: Kit UI Newsroom dan menu
- Field, SelectField, Checkbox, StatusBadge (ikon + kata), Notice, ConfirmButton (`<dialog>`), PageHeader, gaya tabel dari preview terkunci; menu sidebar Content: Articles, Sections, Tags, Authors.

### Task 4: Rubrik, tag, penulis
- Tes unit validasi (nama, slug otomatis, slug dicadangkan, deskripsi, tautan penulis https).
- Halaman daftar (jumlah artikel), buat, ubah, hapus (diblokir bila dipakai artikel), urutan rubrik (naik/turun), tampil di navigasi.
- E2E: buat rubrik, ubah slug, hapus; tag; penulis.

### Task 5: Inti editor murni
- `slugify`, dokumen (sanitasi, teks, kata, menit baca), alur status, aturan terbit, waktu WIB, validasi input. Semua TDD.

### Task 6: Render artikel dan pratinjau
- `ArticleBody` (tanpa `dangerouslySetInnerHTML`; tautan hanya http, https, mailto, relatif; YouTube `youtube-nocookie.com` setelah klik).
- Halaman pratinjau dengan tipografi artikel dari preview terkunci dan pita "Preview".

### Task 7: Daftar artikel
- Tab status dengan jumlah, cari, filter rubrik dan penulis, halaman 25 baris, aksi massal (Publish, Unpublish, Archive, Delete) dengan laporan artikel yang belum memenuhi aturan terbit; tombol New article (Server Action, bukan GET).

### Task 8: Editor artikel
- Judul, standfirst, isi Tiptap dengan toolbar dan blok khusus (dialog di portal), panel: status, slug, rubrik, jenis, label kicker, penulis berurutan, tag, breaking, sumber, artikel terkait, Major update.
- Autosave, status simpan, peringatan saat meninggalkan halaman, konflik versi, galat aturan terbit di kolomnya.
- E2E: tulis artikel → autosave → kirim review → terbit; jadwal; batalkan terbit; arsip; konflik dua tab; pratinjau.

### Task 9: Riwayat versi
- Daftar versi (waktu WIB, catatan), pratinjau versi, Restore dengan konfirmasi.

### Task 10: Dashboard
- Kartu Published today, In review, Scheduled (berikutnya), Drafts; pemeriksaan fondasi tetap; daftar "Coming next" diperbarui.

### Task 11: Verifikasi dan kiriman
- Type check, lint, unit, database, E2E, build; cek visual terang/gelap, desktop/HP; CHANGELOG, versi 0.2.0, tag, zip, dokumen proyek.
