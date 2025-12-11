import React, { useEffect, useState } from 'react';
import { ScrollView, View, Alert } from 'react-native';
import { Appbar, List, Button, Text, Divider, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
// import { GradientBackground } from '../../src/components/GradientBackground';
import { getUserRole, setUserRole } from '../../src/services/firestore';

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [roleStatus, setRoleStatus] = useState<string>('checking');
  const [fixing, setFixing] = useState(false);

  useEffect(() => {
    checkRole();
  }, []);

  const checkRole = async () => {
    if (!user?.id) return;
    try {
      const role = await getUserRole(user.id);
      setRoleStatus(role || 'not_found');
    } catch (error) {
      setRoleStatus('error');
    }
  };

  const fixAdminRole = async () => {
    if (!user?.id) return;
    setFixing(true);
    try {
      // Force set role to admin for the current user (Self-repair)
      // This works because rules allow users to write to their own doc
      await setUserRole(user.id, 'admin');
      Alert.alert('Sukses', 'Akun Anda sekarang terdaftar sebagai Admin di database.');
      checkRole();
    } catch (error: any) {
      Alert.alert('Gagal', 'Tidak bisa memperbaiki akun: ' + error.message);
    } finally {
      setFixing(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/login');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F2' }}>
      <Appbar.Header style={{ backgroundColor: '#fff', elevation: 2 }}>
        <Appbar.Content title="Pengaturan" />
      </Appbar.Header>
      
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <List.Section title="Akun Saya">
          <List.Item
            title={user?.name || 'User'}
            description={user?.username || user?.id}
            left={props => <List.Icon {...props} icon="account" />}
          />
          <List.Item
            title="Status Database"
            description={
              roleStatus === 'checking' ? 'Memeriksa...' :
              roleStatus === 'admin' ? 'Terverifikasi (Admin)' :
              roleStatus === 'not_found' ? 'Data Hilang (Perlu Perbaikan)' :
              `Role: ${roleStatus}`
            }
            left={props => <List.Icon {...props} icon="database-check" />}
            right={props => roleStatus !== 'admin' && roleStatus !== 'checking' ? (
              <Button mode="contained-tonal" compact onPress={fixAdminRole} loading={fixing}>
                Perbaiki
              </Button>
            ) : null}
          />
        </List.Section>

        <Divider />

        <List.Section title="Aplikasi">
          <List.Item
            title="Versi Aplikasi"
            description="1.0.0 (Beta)"
            left={props => <List.Icon {...props} icon="information" />}
          />
        </List.Section>

        <View style={{ marginTop: 20 }}>
          <Button mode="contained" buttonColor="#FF5252" icon="logout" onPress={handleLogout}>
            Keluar Aplikasi
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}
