import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View, StyleSheet, Alert, RefreshControl } from 'react-native';
import { Appbar, Text, Card, Button, Menu, Divider, ActivityIndicator, Chip, ProgressBar, Badge } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
// import { GradientBackground } from '../../src/components/GradientBackground';
import { getCreditTransactionsReport, getReceivablesMutationReport, getProfitSharesReport, ProfitShareRecord } from '../../src/services/transactionService';
import { getAllCustomers, CustomerData, getEmployees, EmployeeData } from '../../src/services/firestore';
import { CreditTransaction } from '../../src/types';

export default function ReportsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const customerIdParam = params.customerId as string;
  const customerNameParam = params.customerName as string;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [mutations, setMutations] = useState<any[]>([]);
  const [profitShares, setProfitShares] = useState<ProfitShareRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  
  // Filters
  const [viewMode, setViewMode] = useState<'credits' | 'mutations' | 'profitShare'>('credits');
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>('month');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(customerIdParam || null);
  
  // UI State
  const [menuVisible, setMenuVisible] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Calculate Date Range
      let startDate: Date | undefined;
      const now = new Date();
      const endDate = new Date(); // now
      endDate.setHours(23, 59, 59, 999);

      if (period === 'today') {
        startDate = new Date(now.setHours(0, 0, 0, 0));
      } else if (period === 'week') {
        const firstDay = now.getDate() - now.getDay(); // Sunday
        startDate = new Date(now.setDate(firstDay));
        startDate.setHours(0, 0, 0, 0);
      } else if (period === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);
      }
      // 'all' -> startDate undefined

      // 2. Fetch Data
      if (viewMode === 'credits') {
        const [txData, custData] = await Promise.all([
          getCreditTransactionsReport({
            customerId: selectedCustomer,
            startDate,
            endDate
          }),
          getAllCustomers()
        ]);
        setTransactions(txData);
        setCustomers(custData);
      } else if (viewMode === 'mutations') {
        const [mutData, custData] = await Promise.all([
            getReceivablesMutationReport({
                customerId: selectedCustomer,
                startDate,
                endDate
            }),
            getAllCustomers()
        ]);
        setMutations(mutData);
        setCustomers(custData);
      } else {
        const [shareData, empData] = await Promise.all([
          getProfitSharesReport({ startDate, endDate, limitCount: 2000 }),
          getEmployees()
        ]);
        setProfitShares(shareData);
        setEmployees(empData);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Gagal memuat laporan');
    } finally {
      setLoading(false);
    }
  }, [period, selectedCustomer, viewMode]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount || 0);
  };

  const formatDate = (date: any) => {
    if (!date) return '-';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Calculate Summary
  const summary = transactions.reduce((acc, curr) => {
    acc.totalCredit += curr.creditPriceTotal;
    acc.totalPrincipal += curr.principalAmount;
    acc.count += 1;
    return acc;
  }, { totalCredit: 0, totalPrincipal: 0, count: 0 });

  const getCustomerName = (id?: string) => {
    if (!id) return 'Unknown';
    const cust = customers.find(c => c.uid === id);
    return cust ? cust.name : 'Unknown';
  };

  const getEmployeeName = (id?: string) => {
    if (!id) return 'Unknown';
    const emp = employees.find(e => e.uid === id);
    return emp ? (emp.name || emp.email || emp.uid) : 'Unknown';
  };

  const profitShareSummary = useMemo(() => {
    return profitShares.reduce((acc, r) => {
      acc.totalProfitShare += r.profitShareAmount || 0;
      acc.totalPayment += r.paymentAmount || 0;
      acc.count += 1;
      return acc;
    }, { totalProfitShare: 0, totalPayment: 0, count: 0 });
  }, [profitShares]);

  const profitShareGroups = useMemo(() => {
    const map: Record<string, { collectorId: string; collectorName: string; count: number; totalPayment: number; totalProfitShare: number; avgPctSum: number; avgPctCount: number; }> = {};
    profitShares.forEach((r) => {
      const key = r.collectorId || 'unknown';
      if (!map[key]) {
        map[key] = {
          collectorId: key,
          collectorName: getEmployeeName(key),
          count: 0,
          totalPayment: 0,
          totalProfitShare: 0,
          avgPctSum: 0,
          avgPctCount: 0
        };
      }
      map[key].count += 1;
      map[key].totalPayment += r.paymentAmount || 0;
      map[key].totalProfitShare += r.profitShareAmount || 0;
      if (typeof r.percentage === 'number') {
        map[key].avgPctSum += r.percentage;
        map[key].avgPctCount += 1;
      }
    });
    return Object.values(map).sort((a, b) => b.totalProfitShare - a.totalProfitShare);
  }, [profitShares, employees]);

  const getInstallmentProgress = (tx: CreditTransaction) => {
    const installments = tx.installments || [];
    const paidCount = installments.filter(i => i.status === 'paid').length;
    const totalCount = tx.tenorCount || 1;
    const nextUnpaid = installments.find(i => i.status !== 'paid');
    return {
      paid: paidCount,
      total: totalCount,
      progress: paidCount / totalCount,
      nextUnpaid
    };
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F2' }}>
      <Appbar.Header style={{ backgroundColor: '#fff', elevation: 2 }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={customerNameParam ? `Riwayat: ${customerNameParam}` : "Laporan"} />
      </Appbar.Header>

      <View style={{flexDirection: 'row', padding: 10, backgroundColor: 'white'}}>
        <Button 
            mode={viewMode === 'credits' ? 'contained' : 'outlined'} 
            onPress={() => setViewMode('credits')} 
            style={{flex:1, marginRight:5}}
        >
            Kredit Barang
        </Button>
        <Button 
            mode={viewMode === 'mutations' ? 'contained' : 'outlined'} 
            onPress={() => setViewMode('mutations')} 
            style={{flex:1, marginLeft:5}}
        >
            Mutasi Piutang
        </Button>
        <Button
            mode={viewMode === 'profitShare' ? 'contained' : 'outlined'}
            onPress={() => setViewMode('profitShare')}
            style={{flex:1, marginLeft:5}}
        >
            Bagi Hasil
        </Button>
      </View>

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodScroll}>
          <Chip 
            selected={period === 'today'} 
            onPress={() => setPeriod('today')} 
            style={styles.chip}
            showSelectedOverlay
          >Hari Ini</Chip>
          <Chip 
            selected={period === 'week'} 
            onPress={() => setPeriod('week')} 
            style={styles.chip}
            showSelectedOverlay
          >Minggu Ini</Chip>
          <Chip 
            selected={period === 'month'} 
            onPress={() => setPeriod('month')} 
            style={styles.chip}
            showSelectedOverlay
          >Bulan Ini</Chip>
          <Chip 
            selected={period === 'all'} 
            onPress={() => setPeriod('all')} 
            style={styles.chip}
            showSelectedOverlay
          >Semua</Chip>
        </ScrollView>

        {viewMode !== 'profitShare' ? (
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <Button mode="outlined" onPress={() => setMenuVisible(true)} style={styles.filterBtn}>
                {selectedCustomer ? getCustomerName(selectedCustomer) : 'Semua Nasabah'}
              </Button>
            }
          >
            <Menu.Item onPress={() => { setSelectedCustomer(null); setMenuVisible(false); }} title="Semua Nasabah" />
            <Divider />
            {customers.map(c => (
              <Menu.Item 
                key={c.uid} 
                onPress={() => { setSelectedCustomer(c.uid); setMenuVisible(false); }} 
                title={c.name} 
              />
            ))}
          </Menu>
        ) : (
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
            {employees.map(e => (
              <Menu.Item
                key={e.uid}
                onPress={() => { setSelectedEmployee(e.uid); setMenuVisible(false); }}
                title={e.name || e.email || e.uid}
              />
            ))}
          </Menu>
        )}
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {viewMode === 'credits' ? (
            <>
                <View style={styles.summaryContainer}>
                <Card style={[styles.card, { borderLeftColor: '#1E88E5', borderLeftWidth: 4 }]}>
                    <Card.Content>
                    <Text variant="labelMedium">Total Transaksi</Text>
                    <Text variant="titleLarge" style={{ color: '#1E88E5' }}>{summary.count}</Text>
                    </Card.Content>
                </Card>
                <Card style={[styles.card, { borderLeftColor: '#f44336', borderLeftWidth: 4 }]}>
                    <Card.Content>
                    <Text variant="labelMedium">Nilai Kredit</Text>
                    <Text variant="titleLarge" style={{ color: '#f44336' }}>{formatCurrency(summary.totalCredit)}</Text>
                    </Card.Content>
                </Card>
                </View>

                <Text variant="titleMedium" style={styles.sectionTitle}>Daftar Kredit Barang</Text>

                {loading && <ActivityIndicator animating={true} style={{ marginTop: 20 }} />}

                {!loading && transactions.length === 0 && (
                <Text style={{ textAlign: 'center', marginTop: 20, color: '#666' }}>Belum ada transaksi kredit pada periode ini.</Text>
                )}

                {transactions.map((tx) => {
                const { paid, total, progress, nextUnpaid } = getInstallmentProgress(tx);
                return (
                  <Card key={tx.id} style={styles.txCard} mode="elevated">
                  <Card.Content>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <View style={{ flex: 1 }}>
                            <Text variant="labelSmall" style={{ color: '#999', marginBottom: 2 }}>ID: {tx.id}</Text>
                            <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{tx.productName}</Text>
                            <Text variant="bodyMedium">{tx.customerName}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Badge 
                                style={{ 
                                backgroundColor: tx.status === 'active' ? '#2196F3' : tx.status === 'completed' ? '#4CAF50' : '#F44336',
                                marginBottom: 4
                                }}
                            >
                            {tx.status === 'active' ? 'Aktif' : tx.status === 'completed' ? 'Lunas' : 'Macet'}
                            </Badge>
                            <Text variant="bodySmall" style={{color: '#666'}}>{formatDate(tx.createdAt)}</Text>
                        </View>
                        </View>

                        <Divider style={{ marginVertical: 8 }} />

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text variant="bodyMedium">Total Kredit:</Text>
                        <Text variant="bodyMedium" style={{ fontWeight: 'bold' }}>{formatCurrency(tx.creditPriceTotal)}</Text>
                        </View>
                        
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text variant="bodyMedium">Cicilan:</Text>
                        <Text variant="bodyMedium">{formatCurrency(tx.installmentAmount)} x {tx.tenorCount} ({tx.tenorType === 'weekly' ? 'Mingguan' : 'Bulanan'})</Text>
                        </View>

                        <View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                          <Text variant="bodySmall">Progress Pembayaran ({paid}/{total})</Text>
                          <Text variant="bodySmall">{Math.round(progress * 100)}%</Text>
                        </View>
                        <ProgressBar progress={progress} color={progress === 1 ? '#4CAF50' : '#2196F3'} style={{ height: 6, borderRadius: 3 }} />
                        {nextUnpaid ? (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                            <Text variant="bodySmall">Jatuh Tempo Berikutnya</Text>
                            <Text variant="bodySmall" style={{ fontWeight: 'bold', color: '#D32F2F' }}>
                              {formatCurrency(nextUnpaid.amount)} • {formatDate(nextUnpaid.dueDate?.toDate?.() || nextUnpaid.dueDate)}
                            </Text>
                          </View>
                        ) : (
                          <Text variant="bodySmall" style={{ marginTop: 6, color: '#4CAF50' }}>Semua cicilan sudah lunas</Text>
                        )}
                        </View>
                  </Card.Content>
                  </Card>
                );
                })}
            </>
        ) : viewMode === 'mutations' ? (
            <>
                <Text variant="titleMedium" style={styles.sectionTitle}>Riwayat Mutasi Piutang</Text>
                
                {loading && <ActivityIndicator animating={true} style={{ marginTop: 20 }} />}

                {!loading && mutations.length === 0 && (
                    <Text style={{ textAlign: 'center', marginTop: 20, color: '#666' }}>Belum ada mutasi piutang pada periode ini.</Text>
                )}

                {mutations.map((item) => {
                    const isPayment = item.type === 'payment';
                    // For credit, principalAmount is the debt increase. If not available (old data), fallback to creditPriceTotal
                    const amount = isPayment ? item.amount : (item.principalAmount || item.creditPriceTotal);
                    const color = isPayment ? '#4CAF50' : '#f44336';
                    
                    return (
                        <Card key={item.id} style={styles.txCard}>
                            <Card.Content>
                                <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
                                    <View style={{flex: 1}}>
                                        <Text variant="labelSmall">{formatDate(item.createdAt)}</Text>
                                        <Text variant="titleMedium">{isPayment ? 'Pembayaran' : (item.productName || 'Kredit Barang')}</Text>
                                        <Text variant="bodyMedium">{getCustomerName(item.customerId)}</Text>
                                    </View>
                                    <View style={{alignItems:'flex-end'}}>
                                        <Text variant="titleMedium" style={{color, fontWeight:'bold'}}>
                                            {isPayment ? '-' : '+'} {formatCurrency(amount || 0)}
                                        </Text>
                                        <Chip style={{backgroundColor: color + '20', height:24, marginTop:4}} textStyle={{color, fontSize:10, lineHeight:14}}>
                                            {isPayment ? 'Pelunasan' : 'Hutang Baru'}
                                        </Chip>
                                    </View>
                                </View>
                                {item.notes ? <Text variant="bodySmall" style={{marginTop:8, fontStyle:'italic'}}>Catatan: {item.notes}</Text> : null}
                            </Card.Content>
                        </Card>
                    )
                 })}
            </>
        ) : (
            <>
              <View style={styles.summaryContainer}>
                <Card style={[styles.card, { borderLeftColor: '#7B1FA2', borderLeftWidth: 4 }]}>
                  <Card.Content>
                    <Text variant="labelMedium">Total Bagi Hasil</Text>
                    <Text variant="titleLarge" style={{ color: '#7B1FA2' }}>{formatCurrency(profitShareSummary.totalProfitShare)}</Text>
                  </Card.Content>
                </Card>
                <Card style={[styles.card, { borderLeftColor: '#4CAF50', borderLeftWidth: 4 }]}>
                  <Card.Content>
                    <Text variant="labelMedium">Total Pembayaran</Text>
                    <Text variant="titleLarge" style={{ color: '#4CAF50' }}>{formatCurrency(profitShareSummary.totalPayment)}</Text>
                  </Card.Content>
                </Card>
              </View>

              <Text variant="titleMedium" style={styles.sectionTitle}>Laporan Bagi Hasil</Text>

              {loading && <ActivityIndicator animating={true} style={{ marginTop: 20 }} />}

              {!loading && profitShares.length === 0 && (
                <Text style={{ textAlign: 'center', marginTop: 20, color: '#666' }}>Belum ada data bagi hasil pada periode ini.</Text>
              )}

              {!loading && (
                <>
                  {profitShareGroups
                    .filter((g) => !selectedEmployee || g.collectorId === selectedEmployee)
                    .map((g) => {
                      const avgPct = g.avgPctCount ? (g.avgPctSum / g.avgPctCount) : 0;
                      return (
                        <Card key={g.collectorId} style={styles.txCard}>
                          <Card.Content>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <View style={{ flex: 1 }}>
                                <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{g.collectorName}</Text>
                                <Text variant="bodySmall" style={{ color: '#666' }}>
                                  Transaksi: {g.count} • Rata-rata %: {Math.round(avgPct * 100) / 100}%
                                </Text>
                              </View>
                              <View style={{ alignItems: 'flex-end' }}>
                                <Text variant="titleMedium" style={{ color: '#7B1FA2', fontWeight: 'bold' }}>
                                  {formatCurrency(g.totalProfitShare)}
                                </Text>
                                <Text variant="bodySmall" style={{ color: '#666' }}>
                                  Dari {formatCurrency(g.totalPayment)}
                                </Text>
                              </View>
                            </View>
                          </Card.Content>
                        </Card>
                      );
                    })}
                </>
              )}
            </>
        )}
        
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
    marginBottom: 12,
    backgroundColor: 'white',
  }
});
