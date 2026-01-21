import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../src/store/authStore';

import { View } from 'react-native';
import { FullWidthProductSlider } from '../src/components/home/FullWidthProductSlider';
import { HomeHeader } from '../src/components/home/HomeHeader';
import { LimitCard } from '../src/components/home/LimitCard';
import { ShortcutGrid } from '../src/components/home/ShortcutGrid';

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
