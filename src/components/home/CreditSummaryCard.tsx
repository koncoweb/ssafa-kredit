import React from 'react';
import { View } from 'react-native';
import { Card, Text, Chip } from 'react-native-paper';
import { useAuthStore } from '../../store/authStore';

export function CreditSummaryCard({ totalDebt, creditLimit }: { totalDebt?: number; creditLimit?: number }) {
  const { isAuthenticated } = useAuthStore();
  return (
    <Card style={{ margin: 16 }} mode="elevated" accessibilityLabel="Ringkasan kredit">
      <Card.Content>
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
          <Text variant="titleMedium">Limit Kredit Barang</Text>
          <Chip>{isAuthenticated ? 'Aktif' : 'Login diperlukan'}</Chip>
        </View>
        {isAuthenticated ? (
          <>
            <Text variant="displaySmall" style={{ color: '#1565C0', fontWeight:'bold', marginTop: 8 }}>
              Rp {(creditLimit || 0).toLocaleString('id-ID')}
            </Text>
            <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop: 12 }}>
              <Text variant="bodyMedium">Tagihan Bulan Ini</Text>
              <Text variant="bodyMedium" style={{ fontWeight:'bold' }}>
                Rp {(totalDebt || 0).toLocaleString('id-ID')}
              </Text>
            </View>
          </>
        ) : (
          <>
            <View style={{ height: 28, backgroundColor: '#E3F2FD', borderRadius: 6, marginTop: 10 }} />
            <View style={{ height: 18, backgroundColor: '#F5F5F5', borderRadius: 4, marginTop: 12 }} />
            <Text variant="bodySmall" style={{ color: '#777', marginTop: 8 }}>
              Silakan login untuk melihat detail kredit dan tagihan.
            </Text>
          </>
        )}
      </Card.Content>
    </Card>
  );
}
