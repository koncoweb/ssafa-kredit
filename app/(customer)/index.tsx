import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Card, List, Text } from 'react-native-paper';
import { HomeHeader } from '../../src/components/home/HomeHeader';
import { ShortcutGrid } from '../../src/components/home/ShortcutGrid';
import { CustomerData, getCustomerData, getCustomerTransactions, Transaction } from '../../src/services/firestore';
import { useAuthStore } from '../../src/store/authStore';

export default function CustomerDashboard() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = React.useCallback(async () => {
    if (user?.id) {
      const data = await getCustomerData(user.id);
      setCustomerData(data);
      const txs = await getCustomerTransactions(user.id);
      setTransactions(txs);
    }
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F2' }}>
      <HomeHeader title="Beranda Nasabah" />
      <ScrollView 
        contentContainerStyle={{ padding: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text variant="headlineSmall" style={{ color: '#333' }}>Halo, {user?.name}</Text>
        
        <Card style={{ marginTop: 20 }} mode="elevated">
          <Card.Content>
             <Text variant="titleMedium">Sisa Tagihan Anda</Text>
             <Text variant="displaySmall" style={{ color: '#d32f2f', fontWeight: 'bold' }}>
               {customerData ? formatCurrency(customerData.totalDebt) : 'Rp 0'}
             </Text>
             <Text variant="bodySmall">Limit Kredit: {customerData ? formatCurrency(customerData.creditLimit) : '-'}</Text>
          </Card.Content>
        </Card>

        <Card style={{ marginTop: 20 }} mode="outlined" onPress={() => router.push('/(customer)/products' as any)}>
          <Card.Title title="Katalog Produk" subtitle="Lihat produk dan simulasi kredit" left={props => <List.Icon {...props} icon="shopping" />} />
        </Card>
        <ShortcutGrid items={[
          { label: 'Katalog', icon: 'shopping', route: '/(customer)/products' },
          { label: 'Riwayat', icon: 'history', route: '/(customer)/history' }
        ]} />

        <Text variant="titleMedium" style={{ marginTop: 20, marginBottom: 10, color: '#333' }}>Riwayat Transaksi</Text>
        <Card>
          {transactions.length > 0 ? (
            transactions.map((tx) => (
              <List.Item
                key={tx.id}
                title={tx.type === 'credit' ? 'Pinjaman' : 'Pembayaran'}
                description={tx.description || tx.createdAt?.toDate().toLocaleDateString()}
                right={() => <Text style={{ alignSelf: 'center', color: tx.type === 'credit' ? 'red' : 'green' }}>{formatCurrency(tx.amount)}</Text>}
              />
            ))
          ) : (
            <List.Item title="Belum ada transaksi" />
          )}
        </Card>
      </ScrollView>
    </View>
  );
}
