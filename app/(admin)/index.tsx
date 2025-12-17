import React from 'react';
import { View } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { useAuthStore } from '../../src/store/authStore';
import { HomeHeader } from '../../src/components/home/HomeHeader';
import { ShortcutGrid } from '../../src/components/home/ShortcutGrid';

export default function AdminHome() {
  const { user } = useAuthStore();
  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <HomeHeader title="Dashboard Admin" />
      <View style={{ padding: 16 }}>
        <Text variant="headlineSmall" style={{ color: '#333' }}>Halo, {user?.name}</Text>
        <Card style={{ marginTop: 12 }}>
          <Card.Content>
            <Text variant="titleMedium">Ringkasan Cepat</Text>
            <Text variant="bodySmall" style={{ color: '#666' }}>Kelola produk, nasabah, laporan, dan pengguna.</Text>
          </Card.Content>
        </Card>
        <ShortcutGrid items={[
          { label: 'Produk', icon: 'shopping', route: '/(admin)/products' },
          { label: 'Nasabah', icon: 'account-group', route: '/(admin)/customers' },
          { label: 'Karyawan', icon: 'account-tie', route: '/(admin)/employees' },
          { label: 'Laporan', icon: 'file-chart', route: '/(admin)/reports' },
          { label: 'Users', icon: 'account-cog', route: '/(admin)/users' },
          { label: 'Pengaturan', icon: 'cog', route: '/(admin)/settings' },
        ]} />
      </View>
    </View>
  );
}
