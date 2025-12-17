import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { theme } from '../src/constants/theme';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Snackbar } from 'react-native-paper';
import { initOffline, registerServiceWorker, subscribe } from '../src/services/offline';

export default function RootLayout() {
  const [snack, setSnack] = useState<{ visible: boolean; text: string }>({ visible: false, text: '' });

  useEffect(() => {
    initOffline();
    registerServiceWorker();
    const unsub = subscribe((event, payload) => {
      if (event === 'offline-saved') {
        setSnack({ visible: true, text: 'Data disimpan sementara (offline)' });
      } else if (event === 'offline-synced') {
        setSnack({ visible: true, text: 'Sinkronisasi offline berhasil' });
      } else if (event === 'offline-save-failed') {
        setSnack({ visible: true, text: 'Gagal menyimpan offline' });
      } else if (event === 'offline') {
        setSnack({ visible: true, text: 'Koneksi terputus' });
      } else if (event === 'online') {
        setSnack({ visible: true, text: 'Koneksi kembali, mulai sinkronisasi' });
      }
    });
    return () => {
      unsub();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(admin)" />
          <Stack.Screen name="(employee)" />
          <Stack.Screen name="(customer)" />
        </Stack>
        <StatusBar style="auto" />
        <Snackbar
          visible={snack.visible}
          onDismiss={() => setSnack({ visible: false, text: '' })}
          duration={2000}
        >
          {snack.text}
        </Snackbar>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
