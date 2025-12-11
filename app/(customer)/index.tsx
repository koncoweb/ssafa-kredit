import React, { useEffect, useState } from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { Appbar, Text, Card, List } from 'react-native-paper';
import { useAuthStore } from '../../src/store/authStore';
import { useRouter } from 'expo-router';
import { getCustomerData, getCustomerTransactions, CustomerData, Transaction } from '../../src/services/firestore';

export default function CustomerDashboard() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    if (user?.id) {
      const data = await getCustomerData(user.id);
      setCustomerData(data);
      const txs = await getCustomerTransactions(user.id);
      setTransactions(txs);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F2' }}>
      <Appbar.Header style={{ backgroundColor: '#fff', elevation: 2 }}>
        <Appbar.Content title="Info Tagihan" />
        <Appbar.Action icon="logout" onPress={() => { logout(); router.replace('/(auth)/login'); }} />
      </Appbar.Header>
      <ScrollView 
        contentContainerStyle={{ padding: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text variant="headlineSmall" style={{ color: '#333' }}>Halo, {user?.name}</Text>
        
        <Card style={{ marginTop: 20 }} mode="elevated">
          <Card.Content>
             <Text variant="titleMedium">Sisa Tagihan Anda</Text>
             <Text variant="displaySmall" style={{ color: '#d32f2f', fontWeight: 'bold' }}>
               {customerData ? formatCurrency(customerData.currentDebt) : 'Rp 0'}
             </Text>
             <Text variant="bodySmall">Limit Kredit: {customerData ? formatCurrency(customerData.creditLimit) : '-'}</Text>
          </Card.Content>
        </Card>

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
