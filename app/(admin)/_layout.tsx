import { Tabs } from 'expo-router';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function AdminLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopWidth: 1,
          borderTopColor: '#e0e0e0',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="view-dashboard" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="employees"
        options={{
          title: 'Karyawan',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="account-tie" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Pengaturan',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="cog" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: 'Users',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="account-cog" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          href: null,
          title: 'Data Nasabah',
        }}
      />
      <Tabs.Screen
        name="transaction"
        options={{
          href: null,
          title: 'Transaksi',
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          href: null,
          title: 'Laporan',
        }}
      />
      <Tabs.Screen
        name="whatsapp"
        options={{
          href: null,
          title: 'Template WA',
        }}
      />
    </Tabs>
  );
}
