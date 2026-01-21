import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { ActivityIndicator, Appbar, Button, Dialog, Divider, List, Portal, Text, TextInput } from 'react-native-paper';
import { resetDatabase } from '../../src/services/adminService';
import { getUserRole, setUserRole } from '../../src/services/firestore';
import { getLogs, getQueue, isOnline, OfflineItem, OfflineLogEntry, syncAll } from '../../src/services/offline';
import { getCreditSettings, saveCreditSettings } from '../../src/services/productService';
import { useAuthStore } from '../../src/store/authStore';

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

  const [offlineDialogVisible, setOfflineDialogVisible] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState<OfflineItem[]>([]);
  const [offlineLogs, setOfflineLogs] = useState<OfflineLogEntry[]>([]);
  const [loadingOffline, setLoadingOffline] = useState(false);

  const loadOfflineViewer = React.useCallback(async () => {
    setLoadingOffline(true);
    try {
      const [q, l] = await Promise.all([getQueue(), getLogs()]);
      setOfflineQueue(q);
      setOfflineLogs(l);
    } finally {
      setLoadingOffline(false);
    }
  }, []);

  const checkRole = React.useCallback(async () => {
    if (!user?.id) return;
    try {
      const role = await getUserRole(user.id);
      setRoleStatus(role || 'not_found');
    } catch (error) {
      console.error(error);
      setRoleStatus('error');
    }
  }, [user]);

  const loadCreditSettings = React.useCallback(async () => {
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
  }, []);

  useEffect(() => {
    checkRole();
    loadCreditSettings();
    loadOfflineViewer();
  }, [checkRole, loadCreditSettings, loadOfflineViewer]);

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
        console.error(e);
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

  const offlineSummary = (() => {
    const queued = offlineQueue.filter(i => i.metadata.syncStatus === 'queued').length;
    const failed = offlineQueue.filter(i => i.metadata.syncStatus === 'failed').length;
    const conflict = offlineQueue.filter(i => i.metadata.syncStatus === 'conflict').length;
    const retrying = offlineQueue.filter(i => (i.metadata.attempts || 0) > 0 && i.metadata.syncStatus === 'queued').length;
    return { queued, failed, conflict, retrying, total: offlineQueue.length };
  })();

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
          <List.Item
            title="Viewer Log Offline"
            description={`Total: ${offlineSummary.total} | Queued: ${offlineSummary.queued} | Retry: ${offlineSummary.retrying} | Konflik: ${offlineSummary.conflict} | Gagal: ${offlineSummary.failed}`}
            left={props => <List.Icon {...props} icon="clipboard-list" />}
            onPress={async () => {
              setOfflineDialogVisible(true);
              await loadOfflineViewer();
            }}
          />
        </List.Section>

        <Portal>
          <Dialog visible={offlineDialogVisible} onDismiss={() => setOfflineDialogVisible(false)}>
            <Dialog.Title>Viewer Log Offline</Dialog.Title>
            <Dialog.ScrollArea>
              <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 12 }}>
                {loadingOffline ? (
                  <ActivityIndicator />
                ) : (
                  <>
                    <Text variant="bodySmall" style={{ color: '#757575', marginBottom: 12 }}>
                      Total: {offlineSummary.total} | Queued: {offlineSummary.queued} | Retry: {offlineSummary.retrying} | Konflik: {offlineSummary.conflict} | Gagal: {offlineSummary.failed}
                    </Text>

                    <List.Section title="Antrian">
                      {offlineQueue.length === 0 ? (
                        <List.Item title="Tidak ada item dalam antrian" />
                      ) : (
                        offlineQueue
                          .slice()
                          .sort((a, b) => (a.metadata.timestamp || 0) - (b.metadata.timestamp || 0))
                          .map((i) => (
                            <List.Item
                              key={i.id}
                              title={i.type}
                              description={`Status: ${i.metadata.syncStatus} | Retry: ${i.metadata.attempts || 0}`}
                              left={(props) => <List.Icon {...props} icon="sync" />}
                              right={() => (
                                <Text style={{ alignSelf: 'center', color: '#757575' }}>
                                  {new Date(i.metadata.timestamp).toLocaleString('id-ID')}
                                </Text>
                              )}
                            />
                          ))
                      )}
                    </List.Section>

                    <Divider />

                    <List.Section title="Log">
                      {offlineLogs.length === 0 ? (
                        <List.Item title="Belum ada log" />
                      ) : (
                        offlineLogs
                          .slice(-50)
                          .reverse()
                          .map((l) => (
                            <List.Item
                              key={l.id}
                              title={`${l.type}${l.itemType ? ` • ${l.itemType}` : ''}`}
                              description={
                                `${l.itemId || '-'}${typeof l.at === 'number' ? ` • ${new Date(l.at).toLocaleString('id-ID')}` : ''}${l.attempts != null ? ` • Retry ${l.attempts}` : ''}${l.code ? ` • ${l.code}` : ''}`
                              }
                              left={(props) => <List.Icon {...props} icon="history" />}
                            />
                          ))
                      )}
                    </List.Section>
                  </>
                )}
              </ScrollView>
            </Dialog.ScrollArea>
            <Dialog.Actions>
              <Button
                onPress={async () => {
                  if (!isOnline()) {
                    Alert.alert('Offline', 'Tidak ada koneksi.');
                    return;
                  }
                  await syncAll();
                  await loadOfflineViewer();
                }}
              >
                Sinkronkan
              </Button>
              <Button onPress={loadOfflineViewer}>Refresh</Button>
              <Button onPress={() => setOfflineDialogVisible(false)}>Tutup</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        <View style={{ padding: 16 }}>
          <Button mode="outlined" icon="logout" onPress={handleLogout} textColor="red" style={{ borderColor: 'red' }}>
            Logout
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}
