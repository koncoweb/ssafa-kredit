// Placeholder untuk konfigurasi database (SQLite/WatermelonDB)
// Siapkan interface di sini untuk memudahkan migrasi nanti.

export interface DatabaseService {
  init(): Promise<void>;
  sync(): Promise<void>; // Untuk sinkronisasi online/offline
}

export const dbService: DatabaseService = {
  init: async () => {
    console.log('Database initialized (Mock)');
  },
  sync: async () => {
    console.log('Syncing data... (Mock)');
  },
};
