import React from 'react';
import { View, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export interface ShortcutItem {
  label: string;
  icon: string;
  route: string;
}

export function ShortcutGrid({ items }: { items: ShortcutItem[] }) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const columns = isTablet ? 3 : 2;
  const router = useRouter();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 }}>
      {items.map((a) => (
        <TouchableOpacity
          key={a.label}
          style={{ width: `${100 / columns}%`, padding: 8 }}
          onPress={() => router.push(a.route as any)}
        >
          <Card>
            <View style={{ alignItems: 'center', padding: 16 }}>
              <MaterialCommunityIcons name={a.icon as any} size={28} color="#1E88E5" />
              <Text style={{ marginTop: 8 }}>{a.label}</Text>
            </View>
          </Card>
        </TouchableOpacity>
      ))}
    </View>
  );
}
