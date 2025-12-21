import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { Text, Card, List, Button } from 'react-native-paper';
import { useAuthStore } from '../../src/store/authStore';
import { HomeHeader } from '../../src/components/home/HomeHeader';
import { getCustomerData, CustomerData } from '../../src/services/firestore';

export default function CustomerProfile() {
  const { user, logout } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    if (user.role !== 'customer') {
      setCustomerData(null);
      return;
    }
    try {
      const data = await getCustomerData(user.id);
      setCustomerData(data);
    } catch {
      setCustomerData(null);
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

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(val);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F2' }}>
      <HomeHeader title="Profil" />
      <ScrollView
        contentContainerStyle={{ padding: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text variant="headlineSmall" style={{ color: '#333' }}>Halo, {user?.name}</Text>

        <Card style={{ marginTop: 20 }} mode="elevated">
          <Card.Content>
            <Text variant="titleMedium">Informasi Akun</Text>
            <List.Item title="Nama" description={user?.name || '-'} left={props => <List.Icon {...props} icon="account" />} />
            <List.Item title="Role" description={user?.role || '-'} left={props => <List.Icon {...props} icon="account-badge" />} />
            <List.Item title="Username" description={user?.username || '-'} left={props => <List.Icon {...props} icon="email" />} />
          </Card.Content>
        </Card>

        {user?.role === 'customer' ? (
          <Card style={{ marginTop: 20 }} mode="elevated">
            <Card.Content>
              <Text variant="titleMedium">Kredit</Text>
              <List.Item
                title="Limit Kredit"
                description={customerData ? formatCurrency(customerData.creditLimit) : '-'}
                left={(props) => <List.Icon {...props} icon="credit-card" />}
              />
              <List.Item
                title="Total Tagihan"
                description={customerData ? formatCurrency(customerData.totalDebt) : '-'}
                left={(props) => <List.Icon {...props} icon="cash" />}
              />
            </Card.Content>
          </Card>
        ) : null}

        <Button mode="contained-tonal" style={{ marginTop: 20 }} onPress={() => logout()}>
          Keluar
        </Button>
      </ScrollView>
    </View>
  );
}
