import { Tabs } from 'expo-router';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function CustomerLayout() {
  const theme = useTheme();
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: theme.colors.primary }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({color}) => <MaterialCommunityIcons name="home" size={24} color={color} /> }} />
      <Tabs.Screen name="history" options={{ title: 'Riwayat', tabBarIcon: ({color}) => <MaterialCommunityIcons name="history" size={24} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: ({color}) => <MaterialCommunityIcons name="account" size={24} color={color} /> }} />
      <Tabs.Screen name="products/index" options={{ href: null }} />
      <Tabs.Screen name="products/[id]" options={{ href: null }} />
    </Tabs>
  );
}
