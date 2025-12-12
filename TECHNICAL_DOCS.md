# Dokumentasi Teknis - Fitur Baru (v1.1)

Dokumen ini menjelaskan detail teknis implementasi fitur-fitur baru pada aplikasi SSAFA Kredit Mobile.

## 1. Modul Transaksi & Notifikasi

### Fitur
- **Modal Notifikasi Informatif**: Menggantikan `Alert` standar dengan modal UI yang lebih kaya (ikon, detail transaksi, opsi tindak lanjut).
- **Feedback Transaksi**: Menampilkan status sukses/gagal dengan detail yang relevan.

### Implementasi Teknis
- **File**: `app/(admin)/transaction.tsx`
- **Komponen**: Menggunakan `Portal` dan `Dialog` dari React Native Paper.
- **State**:
  - `successModalVisible`: Mengontrol visibilitas modal sukses.
  - `errorModalVisible`: Mengontrol visibilitas modal error.
  - `lastTransactionId`: Menyimpan ID transaksi terakhir untuk ditampilkan.
  - `errorDetails`: Menyimpan pesan error spesifik.
- **Alur**:
  1. `handleSubmit` memanggil `createCreditTransaction`.
  2. Jika sukses -> `setLastTransactionId` -> `setSuccessModalVisible(true)`.
  3. Jika gagal -> `setErrorDetails` -> `setErrorModalVisible(true)`.

## 2. Manajemen Stok Barang (Automated)

### Fitur
- **Auto-Decrement**: Stok berkurang otomatis saat transaksi kredit disetujui.
- **Peringatan Stok Rendah/Habis**: Mencegah transaksi jika stok < 1.
- **Update Stok Manual**: Admin dapat mengubah stok di menu edit produk.
- **Riwayat Stok (Audit Log)**: Mencatat setiap perubahan stok (transaksi, manual, restock).

### Implementasi Teknis
- **Service**: `src/services/productService.ts` & `src/services/transactionService.ts`
- **Koleksi Firestore**:
  - `products`: Menyimpan data produk terkini (field `stock`).
  - `stock_history`: Koleksi baru untuk log perubahan.
- **Atomic Transaction**:
  - Menggunakan `runTransaction` Firestore untuk memastikan konsistensi data.
  - Saat transaksi kredit: Cek stok -> Kurangi Stok -> Buat Log History -> Buat Transaksi Kredit. Semua terjadi atau tidak sama sekali.
- **Interface StockHistory**:
  ```typescript
  interface StockHistory {
    id: string;
    productId: string;
    oldStock: number;
    newStock: number;
    changeAmount: number;
    type: 'transaction' | 'manual_adjustment' | 'restock';
    referenceId?: string; // ID Transaksi jika type='transaction'
    updatedBy: string;
    createdAt: any;
  }
  ```

## 3. Opsi Cicilan Bebas (Custom Tenor)

### Fitur
- **Periode Harian**: Menambahkan opsi 'Harian' selain Mingguan/Bulanan.
- **Input Manual**: Admin dapat memasukkan jumlah hari cicilan secara bebas (tidak terpaku pada preset).
- **Kalkulasi Otomatis**: Angsuran dihitung otomatis berdasarkan: `(Harga Kredit - DP) / Jumlah Hari`.

### Implementasi Teknis
- **File**: 
  - `src/types/index.ts`: Update `CreditTransaction.tenorType` include `'daily'`.
  - `app/(admin)/transaction.tsx`: UI input kondisional untuk tenor harian.
  - `src/services/transactionService.ts`: Logika penjadwalan jatuh tempo untuk harian (`dueDate.setDate(prev + 1)`).
  - `src/services/printService.ts`: Support cetak struk untuk tenor harian.

## 4. Panduan Maintenance

### Menambah Tipe Tenor Baru
1. Update interface `CreditTransaction` di `src/types/index.ts`.
2. Update `SegmentedButtons` di `transaction.tsx`.
3. Update logika `getNextDueDate` dan `getFullSchedule` di `transaction.tsx`.
4. Update `createCreditTransaction` di `transactionService.ts` untuk loop tanggal jatuh tempo.
5. Update template PDF di `printService.ts`.

### Debugging Stok
- Cek koleksi `stock_history` di Firestore untuk melacak siapa dan kapan stok berubah.
- Pastikan `productId` di history cocok dengan dokumen di `products`.

### Deployment
- Tidak ada perubahan rules Firestore khusus yang memblokir fitur ini (asumsi rules standar allow read/write auth users).
- Pastikan index Firestore dibuat jika query report/history menjadi lambat (filter by `productId` + sort `createdAt`).
