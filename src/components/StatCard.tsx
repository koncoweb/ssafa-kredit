import React from 'react';
import { Card, Text } from 'react-native-paper';
import { View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Props {
  icon: string;
  title: string;
  value: string;
  accent?: string;
}

export function StatCard({ icon, title, value, accent = '#1976D2' }: Props) {
  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content>
        <View style={styles.row}>
          <View style={[styles.iconWrap, { backgroundColor: accent + '22' }]}> 
            <MaterialCommunityIcons name={icon as any} size={24} color={accent} />
          </View>
          <View style={styles.texts}>
            <Text variant="titleSmall" style={styles.title}>{title}</Text>
            <Text variant="titleMedium" style={styles.value}>{value}</Text>
          </View>
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    // flex: 1, // Removed to allow natural height in vertical stack
    marginBottom: 0,
    borderRadius: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
  },
  title: {
    color: '#607D8B',
  },
  value: {
    fontWeight: 'bold',
  },
});

