import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { theme } from '../src/constants/theme';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
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
      </PaperProvider>
    </SafeAreaProvider>
  );
}
