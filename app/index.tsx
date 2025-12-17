import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';
import { useEffect, useState } from 'react';
import React from 'react';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { HomeHeader } from '../src/components/home/HomeHeader';
import { ShortcutGrid } from '../src/components/home/ShortcutGrid';
import { FullWidthProductSlider } from '../src/components/home/FullWidthProductSlider';
import { LimitCard } from '../src/components/home/LimitCard';

export default function Index() {
  const { isAuthenticated, user } = useAuthStore();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  if (!isAuthenticated) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
        <HomeHeader title="" showLoginShortcut greetingText="Selamat Datang Pengguna" />
        <View style={{ paddingHorizontal: 0 }}>
          <FullWidthProductSlider />
          <LimitCard />
          <View style={{ padding: 16 }}>
            <ShortcutGrid items={[
              { label: 'Login', icon: 'login', route: '/(auth)/login' },
              { label: 'Katalog', icon: 'shopping', route: '/(customer)/products' }
            ]} />
          </View>
        </View>
      </View>
    );
  }

  // Redirect based on role
  switch (user?.role) {
    case 'admin':
      return <Redirect href="/(admin)" />;
    case 'employee':
      return <Redirect href="/(employee)" />;
    case 'customer':
      return <Redirect href="/(customer)" />;
    default:
      return <Redirect href="/(auth)/login" />;
  }
}
