import { Tabs } from 'expo-router';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function EmployeeLayout() {
  const theme = useTheme();
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: theme.colors.primary }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({color}) => <MaterialCommunityIcons name="home" size={24} color={color} /> }} />
      <Tabs.Screen name="customers" options={{ title: 'Nasabah', tabBarIcon: ({color}) => <MaterialCommunityIcons name="account-group" size={24} color={color} /> }} />
    </Tabs>
  );
}
