import React, { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { ActivityIndicator, Card, List, Text } from 'react-native-paper';
import { HomeHeader } from '../../src/components/home/HomeHeader';
import { useAuthStore } from '../../src/store/authStore';
import { getCustomerTransactions } from '../../src/services/firestore';

export default function CustomerPaymentHistory() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val || 0);
  };

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const txs = await getCustomerTransactions(user.id);
      const pays = (txs || []).filter((t: any) => t.type === 'payment');
      setPayments(pays);
    } catch {
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F2' }}>
      <HomeHeader title="Riwayat Pembayaran" />
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {payments.length === 0 ? (
            <Card>
              <Card.Content>
                <Text style={{ color: '#666' }}>Belum ada riwayat pembayaran.</Text>
              </Card.Content>
            </Card>
          ) : (
            <Card>
              <Card.Content>
                {payments.map((p) => {
                  const dateStr =
                    p.createdAt?.toDate?.()?.toLocaleString('id-ID') ||
                    new Date().toLocaleString('id-ID');
                  return (
                    <List.Item
                      key={p.id}
                      title={formatCurrency(p.amount)}
                      description={`Tanggal: ${dateStr}${p.collectorName ? ` • Petugas: ${p.collectorName}` : ''}${p.notes ? ` • Catatan: ${p.notes}` : ''}`}
                      left={(props) => <List.Icon {...props} icon="cash" />}
                    />
                  );
                })}
              </Card.Content>
            </Card>
          )}
        </ScrollView>
      )}
    </View>
  );
}
