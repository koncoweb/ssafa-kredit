import React, { useEffect, useState } from 'react';
import { ScrollView, View, Alert } from 'react-native';
import { Appbar, List, Button, Text, Divider, ActivityIndicator, Portal, Dialog, TextInput } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { getUserRole, setUserRole } from '../../src/services/firestore';
import { getCreditSettings, saveCreditSettings } from '../../src/services/productService';
import { resetDatabase } from '../../src/services/adminService';
import { syncAll, isOnline } from '../../src/services/offline';

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [roleStatus, setRoleStatus] = useState<string>('checking');
  const [fixing, setFixing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  
  // Credit Settings State
  const [creditSettings, setCreditSettings] = useState({ 
    globalMarkupPercentage: 10, 
    defaultTenor: 12,
    availableTenors: {
      weekly: [4, 8, 12, 16],
      monthly: [3, 6, 9, 12]
    }
  });
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [tempMarkup, setTempMarkup] = useState('');
  const [tempWeekly, setTempWeekly] = useState('');
  const [tempMonthly, setTempMonthly] = useState('');

  useEffect(() => {
    checkRole();
    loadCreditSettings();
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

  const loadCreditSettings = async () => {
    try {
        const settings = await getCreditSettings();
        setCreditSettings({
            globalMarkupPercentage: settings.globalMarkupPercentage ?? 10,
            defaultTenor: settings.defaultTenor ?? 12,
            availableTenors: settings.availableTenors ?? {
                weekly: [4, 8, 12, 16],
                monthly: [3, 6, 9, 12]
            }
        });
    } catch(e) { console.error(e); }
  };

  const handleSaveSettings = async () => {
    try {
        setLoadingSettings(true);
        await saveCreditSettings({
            ...creditSettings,
            globalMarkupPercentage: parseFloat(tempMarkup) || 0,
            availableTenors: {
                weekly: tempWeekly.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0),
                monthly: tempMonthly.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0)
            }
        });
        await loadCreditSettings();
        setShowSettingsDialog(false);
        Alert.alert('Sukses', 'Pengaturan kredit disimpan');
    } catch(e) {
        Alert.alert('Gagal', 'Gagal menyimpan pengaturan');
    } finally {
        setLoadingSettings(false);
    }
  };

  const fixAdminRole = async () => {
    if (!user?.id) return;
    setFixing(true);
    try {
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

  const handleManualSync = async () => {
    try {
      if (!isOnline()) {
        Alert.alert('Offline', 'Tidak ada koneksi. Sinkronisasi akan berjalan otomatis saat online.');
        return;
      }
      await syncAll();
      Alert.alert('Sukses', 'Sinkronisasi offline telah dijalankan.');
    } catch (e: any) {
      Alert.alert('Gagal', e.message || 'Sinkronisasi gagal.');
    }
  };

  const confirmResetDatabase = async () => {
    setResetting(true);
    try {
        await resetDatabase();
        setShowResetDialog(false);
        // Gunakan setTimeout agar dialog tertutup dulu baru alert sukses muncul
        setTimeout(() => {
            Alert.alert('Sukses', 'Database transaksi telah dibersihkan.');
        }, 500);
    } catch (error: any) {
        setShowResetDialog(false);
        setTimeout(() => {
            Alert.alert('Gagal', 'Gagal mereset database: ' + error.message);
        }, 500);
    } finally {
        setResetting(false);
    }
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
            description={roleStatus}
            left={props => <List.Icon {...props} icon="database-check" />}
            right={props => roleStatus !== 'admin' && roleStatus !== 'checking' ? (
              <Button mode="contained-tonal" compact onPress={fixAdminRole} loading={fixing}>
                Perbaiki
              </Button>
            ) : null}
          />
        </List.Section>

        <Divider />

        <List.Section title="Pengaturan Bisnis">
            <List.Item
                title="Global Markup Kredit"
                description={`${creditSettings.globalMarkupPercentage}%`}
                left={props => <List.Icon {...props} icon="percent" />}
                onPress={() => setShowSettingsDialog(true)}
            right={props => null}
          />
        </List.Section>

        <Portal>
            <Dialog visible={showSettingsDialog} onDismiss={() => setShowSettingsDialog(false)}>
                <Dialog.Title>Edit Pengaturan Kredit</Dialog.Title>
                <Dialog.Content>
                    <TextInput
                        label="Markup Global (%)"
                        value={tempMarkup}
                        onChangeText={setTempMarkup}
                        keyboardType="numeric"
                        mode="outlined"
                        style={{marginBottom: 16}}
                    />
                    <TextInput
                        label="Pilihan Tenor Mingguan (pisahkan koma)"
                        value={tempWeekly}
                        onChangeText={setTempWeekly}
                        mode="outlined"
                        placeholder="Contoh: 4, 8, 12, 16"
                        style={{marginBottom: 16}}
                    />
                    <TextInput
                        label="Pilihan Tenor Bulanan (pisahkan koma)"
                        value={tempMonthly}
                        onChangeText={setTempMonthly}
                        mode="outlined"
                        placeholder="Contoh: 3, 6, 9, 12"
                    />
                </Dialog.Content>
                <Dialog.Actions>
                    <Button onPress={() => setShowSettingsDialog(false)}>Batal</Button>
                    <Button onPress={handleSaveSettings} loading={loadingSettings}>Simpan</Button>
                </Dialog.Actions>
            </Dialog>

            <Dialog visible={showResetDialog} onDismiss={() => !resetting && setShowResetDialog(false)}>
                <Dialog.Title style={{ color: 'red' }}>PERINGATAN BAHAYA</Dialog.Title>
                <Dialog.Content>
                    <Text variant="bodyMedium">
                        Anda akan menghapus SEMUA data transaksi, riwayat stok, dan mereset hutang nasabah menjadi 0.
                    </Text>
                    <Text variant="bodyMedium" style={{ marginTop: 10, fontWeight: 'bold' }}>
                        Data yang dihapus TIDAK BISA DIKEMBALIKAN. Apakah Anda yakin?
                    </Text>
                </Dialog.Content>
                <Dialog.Actions>
                    <Button onPress={() => setShowResetDialog(false)} disabled={resetting}>Batal</Button>
                    <Button onPress={confirmResetDatabase} loading={resetting} textColor="red">Hapus Semua Data</Button>
                </Dialog.Actions>
            </Dialog>
        </Portal>

        <Divider />

        <List.Section title="Database & Sistem">
          <List.Item
            title="Reset Database Transaksi"
            description="Hapus semua transaksi dan reset hutang"
            titleStyle={{ color: 'red' }}
            left={props => <List.Icon {...props} icon="delete-alert" color="red" />}
            onPress={() => setShowResetDialog(true)}
            right={props => resetting ? <ActivityIndicator {...props} /> : null}
          />
          <List.Item
            title="Sinkronisasi Offline"
            description="Kirim antrian offline ke server sekarang"
            left={props => <List.Icon {...props} icon="sync" />}
            onPress={handleManualSync}
          />
        </List.Section>

        <View style={{ padding: 16 }}>
          <Button mode="outlined" icon="logout" onPress={handleLogout} textColor="red" style={{ borderColor: 'red' }}>
            Logout
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}
