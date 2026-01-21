import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, useWindowDimensions, TouchableOpacity } from 'react-native';
import { Text, Button, Portal, Dialog, Card, List, Snackbar, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import { useRouter } from 'expo-router';
import { HomeHeader } from '../../src/components/home/HomeHeader';
import { ShortcutGrid } from '../../src/components/home/ShortcutGrid';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ProfitShareRecord, subscribeProfitSharesForEmployee } from '../../src/services/transactionService';
import { generateProfitSharesHistoryPDF } from '../../src/services/printService';
import { logPrintActivity } from '../../src/services/firestore';

export default function EmployeeDashboard() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [quickOpen, setQuickOpen] = useState(false);
  const [profitShares, setProfitShares] = useState<ProfitShareRecord[]>([]);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [printingProfitSharesHistory, setPrintingProfitSharesHistory] = useState(false);
  const initialSnapshotDoneRef = useRef(false);
  const lastNotifiedIdRef = useRef<string | null>(null);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const columns = isTablet ? 3 : 2;
  const actions = [
    { label: 'Setoran', icon: 'cash-plus', route: '/(employee)/payments/create' },
    { label: 'Transaksi', icon: 'cart-plus', route: '/(employee)/transactions/create' },
    { label: 'Nasabah', icon: 'account-plus', route: '/(employee)/customers' },
    { label: 'Katalog', icon: 'shopping', route: '/(employee)/catalog' },
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount || 0);
  };

  const filteredProfitShares = useMemo(() => {
    return profitShares.filter((r: any) => {
      if (!startDate && !endDate) return true;
      const dt = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt);
      if (startDate && dt < startDate) return false;
      if (endDate && dt > endDate) return false;
      return true;
    });
  }, [profitShares, startDate, endDate]);

  const monthTotal = useMemo(() => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return profitShares
      .filter((r) => r.monthKey === monthKey)
      .reduce((acc, r) => acc + (r.profitShareAmount || 0), 0);
  }, [profitShares]);

  useEffect(() => {
    if (!user?.id) return;
    const unsub = subscribeProfitSharesForEmployee({
      collectorId: user.id,
      limitCount: 100,
      onChange: (items) => {
        setProfitShares(items);

        const newest = items[0];
        if (!newest) return;
        if (!initialSnapshotDoneRef.current) {
          initialSnapshotDoneRef.current = true;
          lastNotifiedIdRef.current = newest.id;
          return;
        }
        if (lastNotifiedIdRef.current === newest.id) return;
        lastNotifiedIdRef.current = newest.id;
        setSnackbarMessage(`Bagi hasil baru: ${formatCurrency(newest.profitShareAmount || 0)}`);
        setSnackbarVisible(true);
      },
      onError: () => {}
    });
    return () => {
      try {
        unsub();
      } catch {}
    };
  }, [user?.id]);

  const toDate = (value: any) => {
    return value?.toDate?.() || (value instanceof Date ? value : new Date(value));
  };

  const handlePrintProfitSharesHistory = async () => {
    if (!user || user.role !== 'employee') return;
    if (printingProfitSharesHistory) return;
    setPrintingProfitSharesHistory(true);
    try {
      const items = filteredProfitShares.map((r) => ({
        id: r.id,
        customerName: r.customerName || r.customerId,
        createdAt: toDate(r.createdAt),
        paymentAmount: r.paymentAmount || 0,
        profitShareAmount: r.profitShareAmount || 0,
        percentage: typeof r.percentage === 'number' ? r.percentage : 0,
        status: r.status || 'earned',
        collectorName: r.collectorName || user.name,
        notes: r.notes || ''
      }));

      await generateProfitSharesHistoryPDF({
        title: 'RIWAYAT BAGI HASIL',
        employeeName: user.name,
        items,
        startDate,
        endDate,
        officerName: user.name
      });

      try {
        await logPrintActivity({
          actorId: user.id,
          actorName: user.name,
          actorRole: 'employee',
          action: 'print_profit_shares_history',
          targetId: user.id,
          targetName: user.name,
          meta: {
            startDate: startDate ? startDate.toISOString() : null,
            endDate: endDate ? endDate.toISOString() : null,
            count: items.length
          }
        });
      } catch {}
    } finally {
      setPrintingProfitSharesHistory(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F2' }}>
      <HomeHeader title="Area Karyawan" />
      <View style={{ padding: 20 }}>
        <Text variant="headlineSmall" style={{ color: '#333' }}>Halo, {user?.name}</Text>
        <Text style={{ color: '#666' }}>Target hari ini: Rp 2.000.000</Text>
        <Button 
          mode="contained" 
          style={{ marginTop: 20 }} 
          icon="plus"
          onPress={() => router.push('/(employee)/payments/create')}
        >
          Catat Setoran
        </Button>
        <Button 
          mode="contained" 
          style={{ marginTop: 10, backgroundColor: '#4CAF50' }} 
          icon="cart-plus"
          onPress={() => router.push('/(employee)/transactions/create')}
        >
          Transaksi Baru
        </Button>
        <ShortcutGrid items={[
          { label: 'Setoran', icon: 'cash-plus', route: '/(employee)/payments/create' },
          { label: 'Transaksi', icon: 'cart-plus', route: '/(employee)/transactions/create' },
          { label: 'Nasabah', icon: 'account-plus', route: '/(employee)/customers' },
          { label: 'Katalog', icon: 'shopping', route: '/(employee)/catalog' },
        ]} />

        <Card style={{ marginTop: 16, backgroundColor: '#fff' }}>
          <Card.Title title="Riwayat Bagi Hasil" subtitle={`Total bulan ini: ${formatCurrency(monthTotal)}`} />
          <Card.Content>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Button mode="outlined" onPress={() => setShowStartPicker(true)} style={{ flex: 1, marginRight: 8 }}>
                {startDate ? startDate.toLocaleDateString('id-ID') : 'Mulai'}
              </Button>
              <Button mode="outlined" onPress={() => setShowEndPicker(true)} style={{ flex: 1 }}>
                {endDate ? endDate.toLocaleDateString('id-ID') : 'Sampai'}
              </Button>
              <IconButton
                icon="printer"
                onPress={handlePrintProfitSharesHistory}
                disabled={printingProfitSharesHistory || filteredProfitShares.length === 0}
                loading={printingProfitSharesHistory}
              />
              <IconButton
                icon="close"
                onPress={() => {
                  setStartDate(null);
                  setEndDate(null);
                }}
              />
            </View>

            {showStartPicker ? (
              <DateTimePicker
                value={startDate || new Date()}
                mode="date"
                onChange={(_e, d) => {
                  setShowStartPicker(false);
                  if (d) {
                    const next = new Date(d);
                    next.setHours(0, 0, 0, 0);
                    setStartDate(next);
                  }
                }}
              />
            ) : null}

            {showEndPicker ? (
              <DateTimePicker
                value={endDate || new Date()}
                mode="date"
                onChange={(_e, d) => {
                  setShowEndPicker(false);
                  if (d) {
                    const next = new Date(d);
                    next.setHours(23, 59, 59, 999);
                    setEndDate(next);
                  }
                }}
              />
            ) : null}

            {filteredProfitShares.length === 0 ? (
              <Text style={{ color: '#666' }}>Belum ada riwayat bagi hasil.</Text>
            ) : (
              filteredProfitShares.slice(0, 10).map((r) => {
                const dateStr =
                  r.createdAt?.toDate?.()?.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) ||
                  new Date().toLocaleDateString('id-ID');
                return (
                  <List.Item
                    key={r.id}
                    title={`${formatCurrency(r.profitShareAmount || 0)} • ${r.percentage || 0}%`}
                    description={`Tanggal: ${dateStr} • Bayar: ${formatCurrency(r.paymentAmount || 0)} • Status: ${r.status || '-'}`}
                    left={(props) => <List.Icon {...props} icon="cash" />}
                  />
                );
              })
            )}
          </Card.Content>
        </Card>
      </View>
      <Portal>
        <Dialog visible={quickOpen} onDismiss={() => setQuickOpen(false)}>
          <Dialog.Title>Aksi Cepat</Dialog.Title>
          <Dialog.Content>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {actions.map((a) => (
                <TouchableOpacity
                  key={a.label}
                  style={{ width: `${100 / columns}%`, padding: 8 }}
                  onPress={() => { setQuickOpen(false); router.push(a.route as any); }}
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
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setQuickOpen(false)}>Tutup</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3500}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
}
