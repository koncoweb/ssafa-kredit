import React, { useEffect, useState } from 'react';
import { ScrollView, View, Alert } from 'react-native';
import { Appbar, List, Button, Text, Divider, ActivityIndicator, Portal, Dialog, TextInput } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { getUserRole, setUserRole } from '../../src/services/firestore';
import { getCreditSettings, saveCreditSettings } from '../../src/services/productService';

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [roleStatus, setRoleStatus] = useState<string>('checking');
  const [fixing, setFixing] = useState(false);
  
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
                onPress={() => {
                    setTempMarkup(creditSettings.globalMarkupPercentage.toString());
                    setTempWeekly(creditSettings.availableTenors?.weekly?.join(', ') || '4, 8, 12, 16');
                    setTempMonthly(creditSettings.availableTenors?.monthly?.join(', ') || '3, 6, 9, 12');
                    setShowSettingsDialog(true);
                }}
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
        </Portal>

        <List.Section title="Sesi">
          <List.Item
            title="Keluar"
            left={props => <List.Icon {...props} icon="logout" />}
            onPress={handleLogout}
            titleStyle={{ color: 'red' }}
          />
        </List.Section>
      </ScrollView>
    </View>
  );
}
