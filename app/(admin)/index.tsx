import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, RefreshControl } from 'react-native';
import { Appbar, Text, Button } from 'react-native-paper';
import { useAuthStore } from '../../src/store/authStore';
import { useRouter } from 'expo-router';
// import { GradientBackground } from '../../src/components/GradientBackground';
import { StatCard } from '../../src/components/StatCard';
import { getAdminStats } from '../../src/services/firestore';

export default function AdminDashboard() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [stats, setStats] = useState({ customersCount: 0, totalDebt: 0 });
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
      const data = await getAdminStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/login');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F2' }}>
      <Appbar.Header style={{ backgroundColor: '#fff', elevation: 2 }}>
        <Appbar.Content title="Admin Dashboard" />
        <Appbar.Action icon="logout" onPress={handleLogout} />
      </Appbar.Header>

      <ScrollView 
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.welcome}>
          <Text variant="titleMedium" style={{ color: '#333' }}>Halo, {user?.name}</Text>
          <Text variant="bodySmall" style={{ color: '#666' }}>Administrator</Text>
        </View>

        <View style={styles.statsContainer}>
          <StatCard 
            icon="cash" 
            title="Total Piutang" 
            value={formatCurrency(stats.totalDebt)} 
            accent="#1E88E5" 
          />
          <StatCard 
            icon="account-group" 
            title="Pelanggan" 
            value={stats.customersCount.toString()} 
            accent="#43A047" 
          />
        </View>

        <Text variant="titleMedium" style={styles.sectionTitle}>Menu Cepat</Text>

        <View style={styles.menuGrid}>
          <Button mode="contained" icon="account-plus" style={styles.menuBtn} onPress={() => router.push('/(admin)/employees')}>Kelola Karyawan</Button>
          <Button mode="contained" icon="account-group" style={styles.menuBtn} onPress={() => router.push('/(admin)/customers')}>Kelola Nasabah</Button>
          <Button mode="contained" icon="credit-card-plus" style={styles.menuBtn} onPress={() => router.push({ pathname: '/(admin)/transaction', params: { mode: 'credit' } })}>Tambah Kredit</Button>
          <Button mode="contained" icon="cash-register" style={styles.menuBtn} onPress={() => router.push({ pathname: '/(admin)/transaction', params: { mode: 'payment' } })}>Input Pembayaran</Button>
          <Button mode="contained" icon="file-chart" style={styles.menuBtn} onPress={() => router.push('/(admin)/reports')}>Laporan</Button>
          <Button mode="contained" icon="whatsapp" style={styles.menuBtn} onPress={() => router.push('/(admin)/whatsapp')}>Template WA</Button>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  welcome: {
    marginBottom: 20,
  },
  statsContainer: {
    flexDirection: 'column',
    gap: 12,
    marginBottom: 20,
  },
  card: {
    width: '100%',
  },
  sectionTitle: {
    marginBottom: 10,
    fontWeight: 'bold',
    color: '#333',
  },
  menuGrid: {
    gap: 12,
  },
  menuBtn: {
    justifyContent: 'flex-start',
  }
});
