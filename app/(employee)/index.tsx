import React from 'react';
import { View } from 'react-native';
import { Appbar, Text, Button } from 'react-native-paper';
import { useAuthStore } from '../../src/store/authStore';
import { useRouter } from 'expo-router';

export default function EmployeeDashboard() {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F2' }}>
      <Appbar.Header style={{ backgroundColor: '#fff', elevation: 2 }}>
        <Appbar.Content title="Area Karyawan" />
        <Appbar.Action icon="logout" onPress={() => { logout(); router.replace('/(auth)/login'); }} />
      </Appbar.Header>
      <View style={{ padding: 20 }}>
        <Text variant="headlineSmall" style={{ color: '#333' }}>Halo, {user?.name}</Text>
        <Text style={{ color: '#666' }}>Target hari ini: Rp 2.000.000</Text>
        <Button mode="contained" style={{ marginTop: 20 }} icon="plus">Catat Setoran</Button>
      </View>
    </View>
  );
}
