rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // --- Helper Functions ---
    
    // Cek apakah user sudah login
    function isSignedIn() { return request.auth != null; }
    
    // Ambil role user dari koleksi 'users'
    // Pastikan document user memiliki field 'role'
    function userRole() {
      return isSignedIn()
        ? get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role
        : null;
    }
    
    // Helper untuk cek role spesifik
    function isAdmin() { return userRole() == 'admin'; }
    function isEmployee() { return userRole() == 'employee'; }
    function isCustomer() { return userRole() == 'customer'; }

    // --- Users Collection (RBAC Roles) ---
    match /users/{uid} {
      allow read: if isSignedIn() && (request.auth.uid == uid || isAdmin() || isEmployee());
      allow write: if isSignedIn() && (
        (
          isAdmin() &&
          !(uid == request.auth.uid && request.resource.data.role != 'admin')
        )
        ||
        (
          request.auth.uid == uid &&
          request.resource.data.role == resource.data.role
        )
        ||
        (
          isEmployee() &&
          resource == null &&
          request.resource.data.role == 'customer'
        )
      );
    }

    // --- Customers Data (Detail Nasabah) ---
    match /customers/{customerId} {
      // Admin & Employee bisa baca semua data nasabah (untuk list nasabah)
      // Nasabah hanya bisa baca profil sendiri
      allow read: if isSignedIn() && (
        isAdmin() || isEmployee() || (isCustomer() && request.auth.uid == customerId)
      );
      
      // Hanya Admin & Employee yang bisa kelola data nasabah (edit limit, data diri, dll)
      // Nasabah bisa update profil sendiri (opsional, sesuaikan kebutuhan)
      // REVISION: Employee sebaiknya tidak bisa DELETE nasabah
      allow create, update: if isSignedIn() && ( 
        request.auth.uid == customerId ||
        isAdmin() || 
        isEmployee() 
      );
      allow delete: if isSignedIn() && isAdmin();
    }

    // --- Transactions (Audit Trail & Financial Records) ---
    // Menyimpan riwayat kredit dan pembayaran
    match /transactions/{txId} {
      // Admin & Employee bisa lihat semua transaksi (untuk laporan & audit)
      // Nasabah hanya bisa lihat transaksi milik sendiri (riwayat pembelian/bayar)
      allow read: if isSignedIn() && (
        isAdmin() || isEmployee() || (isCustomer() && resource.data.customerId == request.auth.uid)
      );
      
      // Hanya Admin & Employee yang bisa buat/edit transaksi
      // Krusial untuk mencatat kredit baru dan pembayaran piutang
      // REVISION: Employee tidak boleh DELETE transaksi (audit trail)
      allow create, update: if isSignedIn() && ( isAdmin() || isEmployee() );
      allow delete: if isSignedIn() && isAdmin();
    }

    // --- Stock History (Log Perubahan Stok Barang) ---
    match /stock_history/{historyId} {
      allow read: if isSignedIn() && ( isAdmin() || isEmployee() );
      allow create: if isSignedIn() && ( isAdmin() || isEmployee() );
      // History sebaiknya tidak dihapus sembarangan, tapi Admin diberi akses jika perlu koreksi
      allow update, delete: if isSignedIn() && isAdmin();
    }

    // --- Proofs (Bukti Foto KTP / Dokumen) ---
    match /proofs/{docId} {
      allow read: if isSignedIn();
      allow write: if isSignedIn() && ( isAdmin() || isEmployee() );
    }

    // --- Products (Data Barang Katalog) ---
    match /products/{productId} {
      allow read: if isSignedIn();
      // REVISION: Employee hanya boleh UPDATE (kurangi stok), tidak boleh hapus produk
      allow create, delete: if isSignedIn() && isAdmin();
      allow update: if isSignedIn() && ( isAdmin() || isEmployee() );
    }

    // --- Settings (Pengaturan Aplikasi Global) ---
    match /settings/{docId} {
      allow read: if isSignedIn();
      allow write: if isSignedIn() && isAdmin();
    }

    // --- Global Stats (Total Piutang, Statistik Dashboard) ---
    // Koleksi ini menyimpan 'totalReceivables' dan data ringkasan lainnya secara real-time.
    // WAJIB bisa dibaca/tulis oleh Admin dan Employee.
    // Employee butuh akses tulis karena saat mereka input transaksi/pembayaran, 
    // sistem akan otomatis mengupdate counter global di sini (via atomic increment).
    match /stats/{docId} {
      allow read: if isSignedIn() && ( isAdmin() || isEmployee() );
      allow write: if isSignedIn() && ( isAdmin() || isEmployee() );
    }
  }
}
