import React, { useEffect, useState } from 'react';
import { ScrollView, View, StyleSheet, Alert, RefreshControl } from 'react-native';
import { Appbar, Text, Card, List, Button, Menu, Divider, ActivityIndicator, Chip, Avatar } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
// import { GradientBackground } from '../../src/components/GradientBackground';
import { getTransactionsReport, getEmployees, EmployeeData, Transaction } from '../../src/services/firestore';

export default function ReportsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const customerIdParam = params.customerId as string;
  const customerNameParam = params.customerName as string;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  
  // Filters
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>('today');
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null); // uid or null for all
  
  // UI State
  const [menuVisible, setMenuVisible] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Calculate Date Range
      let startDate: Date | undefined;
      const now = new Date();
      const endDate = new Date(); // now

      if (period === 'today') {
        startDate = new Date(now.setHours(0, 0, 0, 0));
      } else if (period === 'week') {
        const firstDay = now.getDate() - now.getDay(); // Sunday
        startDate = new Date(now.setDate(firstDay));
        startDate.setHours(0, 0, 0, 0);
      } else if (period === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }
      // 'all' -> startDate undefined

      // 2. Fetch Data
      const [txData, empData] = await Promise.all([
        getTransactionsReport({
          employeeId: selectedEmployee,
          customerId: customerIdParam || undefined,
          startDate,
          endDate
        }),
        getEmployees() // Fetch employees for filter dropdown
      ]);

      setTransactions(txData);
      setEmployees(empData);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Gagal memuat laporan');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, [period, selectedEmployee]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount);
  };

  const formatDate = (date: any) => {
    if (!date) return '-';
    // If it's a Firestore timestamp (seconds), convert it. 
    // But getTransactionsReport already converts to Date.
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  // Calculate Summary
  const summary = transactions.reduce((acc, curr) => {
    if (curr.type === 'credit') {
      acc.totalCredit += curr.amount;
    } else {
      acc.totalPayment += curr.amount;
    }
    return acc;
  }, { totalCredit: 0, totalPayment: 0 });

  const getEmployeeName = (id?: string) => {
    if (!id) return 'Admin/System';
    const emp = employees.find(e => e.uid === id);
    return emp ? emp.name : 'Unknown';
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F2' }}>
      <Appbar.Header style={{ backgroundColor: '#fff', elevation: 2 }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={customerNameParam ? `Riwayat: ${customerNameParam}` : "Laporan Piutang"} />
      </Appbar.Header>

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodScroll}>
          <Chip 
            selected={period === 'today'} 
            onPress={() => setPeriod('today')} 
            style={styles.chip}
          >Hari Ini</Chip>
          <Chip 
            selected={period === 'week'} 
            onPress={() => setPeriod('week')} 
            style={styles.chip}
          >Minggu Ini</Chip>
          <Chip 
            selected={period === 'month'} 
            onPress={() => setPeriod('month')} 
            style={styles.chip}
          >Bulan Ini</Chip>
          <Chip 
            selected={period === 'all'} 
            onPress={() => setPeriod('all')} 
            style={styles.chip}
          >Semua</Chip>
        </ScrollView>

        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <Button mode="outlined" onPress={() => setMenuVisible(true)} style={styles.filterBtn}>
              {selectedEmployee ? getEmployeeName(selectedEmployee) : 'Semua Karyawan'}
            </Button>
          }
        >
          <Menu.Item onPress={() => { setSelectedEmployee(null); setMenuVisible(false); }} title="Semua Karyawan" />
          <Divider />
          {employees.map(emp => (
            <Menu.Item 
              key={emp.uid} 
              onPress={() => { setSelectedEmployee(emp.uid); setMenuVisible(false); }} 
              title={emp.name} 
            />
          ))}
        </Menu>
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.summaryContainer}>
          <Card style={[styles.card, { borderLeftColor: '#f44336', borderLeftWidth: 4 }]}>
            <Card.Content>
              <Text variant="labelMedium">Total Kredit Keluar</Text>
              <Text variant="titleLarge" style={{ color: '#f44336' }}>{formatCurrency(summary.totalCredit)}</Text>
            </Card.Content>
          </Card>
          <Card style={[styles.card, { borderLeftColor: '#4caf50', borderLeftWidth: 4 }]}>
            <Card.Content>
              <Text variant="labelMedium">Total Pembayaran Masuk</Text>
              <Text variant="titleLarge" style={{ color: '#4caf50' }}>{formatCurrency(summary.totalPayment)}</Text>
            </Card.Content>
          </Card>
        </View>

        <Text variant="titleMedium" style={styles.sectionTitle}>Riwayat Transaksi ({transactions.length})</Text>

        {loading && <ActivityIndicator animating={true} style={{ marginTop: 20 }} />}

        {!loading && transactions.length === 0 && (
          <Text style={{ textAlign: 'center', marginTop: 20, color: '#666' }}>Belum ada data transaksi pada periode ini.</Text>
        )}

        {transactions.map((tx) => (
          <Card key={tx.id} style={styles.txCard}>
            <List.Item
              title={tx.type === 'credit' ? 'Pemberian Kredit' : 'Pembayaran Utang'}
              description={`${formatDate(tx.createdAt)}\nOleh: ${getEmployeeName(tx.employeeId)}`}
              descriptionNumberOfLines={2}
              left={props => <Avatar.Icon {...props} icon={tx.type === 'credit' ? 'arrow-up-bold' : 'arrow-down-bold'} style={{ backgroundColor: tx.type === 'credit' ? '#ffebee' : '#e8f5e9' }} color={tx.type === 'credit' ? '#d32f2f' : '#388e3c'} size={40} />}
              right={props => <Text {...props} variant="titleMedium" style={{ alignSelf: 'center', color: tx.type === 'credit' ? '#d32f2f' : '#388e3c' }}>{tx.type === 'credit' ? '+' : '-'}{formatCurrency(tx.amount)}</Text>}
            />
          </Card>
        ))}
        
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  filterContainer: {
    backgroundColor: 'white',
    padding: 10,
    elevation: 2,
  },
  periodScroll: {
    marginBottom: 10,
  },
  chip: {
    marginRight: 8,
  },
  filterBtn: {
    marginTop: 5,
  },
  content: {
    padding: 16,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  card: {
    width: '48%',
    backgroundColor: 'white',
  },
  sectionTitle: {
    marginBottom: 10,
    fontWeight: 'bold',
  },
  txCard: {
    marginBottom: 10,
    backgroundColor: 'white',
  }
});
