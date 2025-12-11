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
  const [creditSettings, setCreditSettings] = useState({ globalMarkupPercentage: 10, defaultTenor: 12 });
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [tempMarkup, setTempMarkup] = useState('');

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
            defaultTenor: settings.defaultTenor ?? 12
        });
    } catch(e) { console.error(e); }
  };

  const handleSaveSettings = async () => {
    try {
        setLoadingSettings(true);
        await saveCreditSettings({
            ...creditSettings,
            globalMarkupPercentage: parseFloat(tempMarkup) || 0
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
                title="Keuntungan Kredit (Global)"
                description={`Markup saat ini: ${creditSettings.globalMarkupPercentage}%`}
                left={props => <List.Icon {...props} icon="percent" />}
                right={props => <Button onPress={() => { setTempMarkup(creditSettings.globalMarkupPercentage.toString()); setShowSettingsDialog(true); }}>Ubah</Button>}
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

      <Portal>
        <Dialog visible={showSettingsDialog} onDismiss={() => setShowSettingsDialog(false)}>
            <Dialog.Title>Atur Keuntungan Global</Dialog.Title>
            <Dialog.Content>
                <TextInput
                    label="Persentase Markup (%)"
                    value={tempMarkup}
                    onChangeText={setTempMarkup}
                    keyboardType="numeric"
                    mode="outlined"
                />
                <Text variant="bodySmall" style={{marginTop: 5, color: '#757575'}}>
                    Contoh: 10 berarti harga kredit = harga cash + 10%
                </Text>
            </Dialog.Content>
            <Dialog.Actions>
                <Button onPress={() => setShowSettingsDialog(false)}>Batal</Button>
                <Button onPress={handleSaveSettings} loading={loadingSettings}>Simpan</Button>
            </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}
