# SSAFA Kredit (Mobile)

## Dokumentasi Pemakaian

Dokumen ini menjelaskan cara penggunaan aplikasi berdasarkan role:

- Admin
- Employee (Karyawan)
- Customer (Nasabah)

### Cara Masuk & Navigasi Dasar

- Buka menu `Login`.
- Setelah login, aplikasi otomatis mengarahkan ke halaman sesuai role.
  - Admin -> area admin
  - Employee -> area karyawan
  - Customer -> area nasabah
- Untuk keluar akun, gunakan tombol `Logout` pada menu pengaturan/halaman terkait.

### Mode Online & Offline

- Aplikasi mendukung online/offline.
- Saat offline, aksi tertentu akan disimpan sebagai antrian dan dikirim otomatis ketika koneksi kembali.
- Indikator singkat muncul sebagai snackbar:
  - `Data disimpan sementara (offline)`
  - `Koneksi terputus` / `Koneksi kembali, mulai sinkronisasi`
  - `Sinkronisasi offline berhasil`

## Panduan Admin

### Tugas Utama Admin

- Mengelola nasabah (tambah/edit data).
- Mengelola karyawan.
- Mengelola katalog produk dan stok.
- Mencatat transaksi kredit baru.
- Melihat laporan dan ringkasan piutang.
- Mengatur pengaturan kredit (markup global & pilihan tenor).
- Menjalankan sinkronisasi offline & memantau log offline.

### Alur Umum Admin

1. Login sebagai admin.
2. Kelola master data:
   - `Data Nasabah` untuk menambah/mengubah data nasabah.
   - `Data Karyawan` untuk mengelola karyawan.
   - `Produk/Katalog` untuk mengelola produk dan stok.
3. Buat transaksi kredit:
   - Masuk menu `Transaksi`.
   - Pilih nasabah dan produk.
   - Tentukan tenor (mingguan/bulanan/harian jika tersedia), DP, dan catatan.
   - Simpan transaksi dan (opsional) cetak dokumen.
4. Catat pembayaran/setoran jika diperlukan.
5. Cek laporan:
   - Masuk menu `Laporan`.
   - Gunakan filter periode dan (opsional) filter nasabah.

### Pengaturan Kredit (Markup & Tenor)

- Masuk `Pengaturan` -> `Global Markup Kredit`.
- Ubah:
  - `Markup Global (%)`
  - `Pilihan Tenor Mingguan` (format: dipisah koma)
  - `Pilihan Tenor Bulanan` (format: dipisah koma)

### Sinkronisasi Offline & Viewer Log

- Menu: `Pengaturan` -> `Sinkronisasi Offline`
  - Mengirim antrian offline saat ini ke server.
  - Jika offline, akan muncul pemberitahuan bahwa sync otomatis berjalan saat online.

- Menu: `Pengaturan` -> `Viewer Log Offline`
  - Menampilkan ringkasan `Queued`, `Retry`, `Konflik`, `Gagal`.
  - Menampilkan daftar item antrian dan riwayat event (enqueue/synced/retry/conflict/failed).
  - Tombol:
    - `Sinkronkan`: memaksa sync saat online.
    - `Refresh`: memuat ulang data antrian/log.

## Panduan Employee (Karyawan)

### Tugas Utama Karyawan

- Mencatat pembayaran/setoran (kolektor).
- Membuat transaksi kredit baru (sesuai akses).
- Mengelola/menambah nasabah.
- Melihat katalog produk.

### Alur Catat Pembayaran/Setoran

1. Masuk menu `Setoran`.
2. Cari dan pilih nasabah.
3. Isi jumlah pembayaran dan catatan (opsional).
4. Simpan.
5. Jika offline:
   - Data akan disimpan sebagai antrian.
   - Akan dikirim otomatis ketika online kembali.

### Alur Transaksi Kredit Baru

1. Masuk menu `Transaksi`.
2. Pilih nasabah dan produk.
3. Isi DP, tenor, dan catatan.
4. Simpan transaksi.

### Alur Kelola Nasabah

- Menu `Nasabah`:
  - Tambah nasabah baru.
  - Edit data nasabah.
  - Jika offline saat edit:
    - Perubahan disimpan sebagai antrian dan akan disinkronkan otomatis saat online.

## Panduan Customer (Nasabah)

### Fitur Utama Nasabah

- Melihat katalog produk.
- Melihat detail produk dan simulasi cicilan.
- Mengajukan kredit dari detail produk.
- Melihat antrian sinkronisasi (transparansi saat offline).
- Melihat profil dan ringkasan transaksi.

### Melihat Produk & Simulasi

1. Masuk menu `Katalog`.
2. Pilih produk untuk melihat detail.
3. Di detail produk:
   - Terlihat harga tunai, stok, dan simulasi cicilan mingguan/bulanan.

### Ajukan Kredit (Online)

1. Di detail produk, tekan `Ajukan Kredit`.
2. Pilih tenor dan isi DP.
3. Isi catatan (opsional).
4. Tekan `Ajukan`.
5. Pengajuan terkirim dan tersimpan di koleksi pengajuan dengan status `pending`.

### Ajukan Kredit (Offline / Draft)

1. Di detail produk, tekan `Ajukan Kredit`.
2. Isi tenor, DP, catatan.
3. Tekan `Ajukan` saat tidak ada koneksi.
4. Aplikasi menyimpan pengajuan sebagai draft/antrian offline.
5. Saat online kembali, draft akan disinkronkan otomatis.

Catatan:

- Jika Anda membuka `Ajukan Kredit` lagi pada produk yang sama, form akan terisi dari draft terakhir.
- Anda bisa memantau statusnya di `Lihat antrian sinkronisasi`.

### Lihat Antrian Sinkronisasi (Nasabah)

- Di detail produk, tekan `Lihat antrian sinkronisasi`.
- Di dialog antrian:
  - Terlihat status (`queued`, `conflict`, `failed`) dan jumlah retry.
  - Tombol `Sinkronkan` hanya berhasil jika sedang online.

---

## Catatan Teknis Singkat (Opsional)

- Antrian offline disimpan secara lokal.
- Untuk data sensitif:
  - Web: disimpan dalam bentuk terenkripsi.
  - Native (Android/iOS): payload disimpan di SecureStore.

---

## Get started

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
