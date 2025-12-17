import React, { useState } from 'react';
import { View, useWindowDimensions, TouchableOpacity } from 'react-native';
import { Appbar, Text, Button, Portal, Dialog, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import { useRouter } from 'expo-router';
import { HomeHeader } from '../../src/components/home/HomeHeader';
import { ShortcutGrid } from '../../src/components/home/ShortcutGrid';

export default function EmployeeDashboard() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [quickOpen, setQuickOpen] = useState(false);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const columns = isTablet ? 3 : 2;
  const actions = [
    { label: 'Setoran', icon: 'cash-plus', route: '/(employee)/payments/create' },
    { label: 'Transaksi', icon: 'cart-plus', route: '/(employee)/transactions/create' },
    { label: 'Nasabah', icon: 'account-plus', route: '/(employee)/customers' },
    { label: 'Katalog', icon: 'shopping', route: '/(employee)/catalog' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F2' }}>
      <HomeHeader title="Area Karyawan" />
      <View style={{ padding: 20 }}>
        <Text variant="headlineSmall" style={{ color: '#333' }}>Halo, {user?.name}</Text>
        <Text style={{ color: '#666' }}>Target hari ini: Rp 2.000.000</Text>
        <Button 
          mode="contained" 
          style={{ marginTop: 20 }} 
          icon="plus"
          onPress={() => router.push('/(employee)/payments/create')}
        >
          Catat Setoran
        </Button>
        <Button 
          mode="contained" 
          style={{ marginTop: 10, backgroundColor: '#4CAF50' }} 
          icon="cart-plus"
          onPress={() => router.push('/(employee)/transactions/create')}
        >
          Transaksi Baru
        </Button>
        <ShortcutGrid items={[
          { label: 'Setoran', icon: 'cash-plus', route: '/(employee)/payments/create' },
          { label: 'Transaksi', icon: 'cart-plus', route: '/(employee)/transactions/create' },
          { label: 'Nasabah', icon: 'account-plus', route: '/(employee)/customers' },
          { label: 'Katalog', icon: 'shopping', route: '/(employee)/catalog' },
        ]} />
      </View>
      <Portal>
        <Dialog visible={quickOpen} onDismiss={() => setQuickOpen(false)}>
          <Dialog.Title>Aksi Cepat</Dialog.Title>
          <Dialog.Content>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {actions.map((a) => (
                <TouchableOpacity
                  key={a.label}
                  style={{ width: `${100 / columns}%`, padding: 8 }}
                  onPress={() => { setQuickOpen(false); router.push(a.route as any); }}
                >
                  <Card>
                    <View style={{ alignItems: 'center', padding: 16 }}>
                      <MaterialCommunityIcons name={a.icon as any} size={28} color="#1E88E5" />
                      <Text style={{ marginTop: 8 }}>{a.label}</Text>
                    </View>
                  </Card>
                </TouchableOpacity>
              ))}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setQuickOpen(false)}>Tutup</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}
