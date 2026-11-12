# Memasang versi baru PressCompass

Setiap versi dikirim sebagai `presscompass-vX.Y.Z.zip`. Perintah di bawah berlaku untuk semua versi; langkah tambahan khusus satu versi ditulis di pesan pengirimannya dan di `CHANGELOG.md`.

## 1. Ganti folder dengan versi baru

Folder lama disimpan sebagai `presscompass-lama` (beserta `.env`-nya), lalu `.env` disalin ke folder baru.

```bash
cd "$HOME/Documents/Virgiawan/website done"
rm -rf presscompass-lama
mv presscompass presscompass-lama
unzip -q "$(ls -t ~/Downloads/presscompass*.zip | head -1)"
cp presscompass-lama/.env presscompass/.env
cd presscompass
nvm use
npm ci
```

## 2. Terapkan migrasi database (bila versi itu membawanya)

`db:push` hanya menerapkan migrasi yang belum ada di proyek Supabase dan menanyakan konfirmasi dulu. Bila tidak ada yang baru, ia menulis `Remote database is up to date`.

```bash
npm run db:link -- --project-ref KODE_PROYEK
npm run db:push
```

`db:link` cukup sekali per folder baru (kode proyek ada di URL dashboard Supabase, 20 huruf). Jalankan `db:push` **sebelum** push ke GitHub, supaya situs live tidak berjalan dengan kode baru di atas skema lama.

## 3. Kirim ke GitHub (Vercel deploy otomatis)

Pesan pengiriman memuat perintah siap tempel dengan nomor versinya. Bentuk umumnya (ganti `vX.Y.Z`):

```bash
git commit --amend --no-edit --reset-author
git tag -f -a vX.Y.Z -m "PressCompass vX.Y.Z"
git push origin main
git push origin vX.Y.Z
```

- `--reset-author` menjadikan commit terakhir milik Anda, karena Vercel Hobby hanya men-deploy commit pemilik akun. Tag dibuat ulang supaya menunjuk commit hasil amend.
- Bila `git push origin main` ditolak (`rejected`, `fetch first` atau `non-fast-forward`), GitHub masih memegang commit yang Anda ubah di versi sebelumnya. Kiriman zip selalu berisi riwayat lengkap, jadi aman menimpanya: `git push --force origin main`.
- Cek versi terpasang: `git describe --tags`.

## Bila ada masalah

| Gejala | Jalan keluar |
|---|---|
| `db:push`: `Cannot find project ref. Have you run supabase link?` | jalankan `npm run db:link -- --project-ref KODE_PROYEK` dulu |
| Keychain Mac menanyakan password "Supabase CLI" | isi password login Mac, pilih **Always Allow** |
| Halaman Newsroom menulis "This page could not load" setelah update | migrasi belum diterapkan: jalankan `npm run db:push`, lalu muat ulang |
| Deploy Vercel diblokir karena penulis commit | jalankan langkah 3 lagi (amend dengan `--reset-author`, lalu push) |
