import { useRouter } from 'expo-router';
import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Appbar, Avatar, Text, useTheme } from 'react-native-paper';
import { useAuthStore } from '../../store/authStore';

interface Props {
  title?: string;
  showLoginShortcut?: boolean;
  greetingText?: string;
}

export function HomeHeader({ title, showLoginShortcut, greetingText }: Props) {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const theme = useTheme();

  const name = (user?.name || '').trim();
  const defaultGreeting = isAuthenticated
    ? `Selamat datang ${name || 'pengguna'}`
    : 'Selamat datang pengguna';

  return (
    <View>
      <Appbar.Header style={{ backgroundColor: '#fff', elevation: 2 }}>
        {showLoginShortcut && !isAuthenticated ? (
          <Appbar.Action icon="login" onPress={() => router.push('/(auth)/login')} />
        ) : (
          <Appbar.Action icon="account-circle" onPress={() => router.push('/(customer)')} />
        )}
        {title ? <Appbar.Content title={title} /> : <Appbar.Content title="" />}
        <Appbar.Action icon="bell-outline" onPress={() => {}} />
      </Appbar.Header>
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center' }}>
        <Avatar.Text size={40} label={(user?.name || 'U').substring(0,1).toUpperCase()} />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>
            {greetingText || defaultGreeting}
          </Text>
        </View>
        {!isAuthenticated && (
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text style={{ color: theme.colors.primary }}>Login</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
