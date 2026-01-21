import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Image, RefreshControl, ScrollView, View } from 'react-native';
import { ActivityIndicator, Appbar, Avatar, Button, Card, Dialog, Divider, FAB, IconButton, Portal, Searchbar, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { createSecondaryUser } from '../../src/services/authSdk';
import { createCustomerProfile, CustomerData, fetchCustomersPage, logCustomerAccess, logPrintActivity, searchCustomersPage, updateCustomerProfile } from '../../src/services/firestore';
import { generatePaymentReceiptPDF, generatePaymentsHistoryPDF } from '../../src/services/printService';
import { fetchCustomerTransactionsPage, PaymentTransaction } from '../../src/services/transactionService';
import { useAuthStore } from '../../src/store/authStore';

export default function EmployeeCustomersManagement() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('new'); // 'new' | 'old'
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingPage, setLoadingPage] = useState(false);
  const [customersCursor, setCustomersCursor] = useState<any>(null);
  const [customersHasMore, setCustomersHasMore] = useState(true);
  const [searchCursor, setSearchCursor] = useState<any>(null);
  const [searchHasMore, setSearchHasMore] = useState(true);

  // Add/Edit Customer Dialog State
  const [dialogVisible, setDialogVisible] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newLimit, setNewLimit] = useState('');
  
  const [loadingAction, setLoadingAction] = useState(false);

  const loadCustomersFirstPage = useCallback(async () => {
    setLoadingPage(true);
    try {
      const term = searchQuery.trim();
      if (term.length > 1) {
        const res = await searchCustomersPage({ searchTerm: term, pageSize: 20 });
        if (term !== searchQuery.trim()) return;
        setCustomers(res.items);
        setSearchCursor(res.nextCursor);
        setSearchHasMore(!!res.nextCursor && res.items.length > 0);
        setCustomersCursor(null);
        setCustomersHasMore(false);
      } else {
        const res = await fetchCustomersPage({ pageSize: 20 });
        setCustomers(res.items);
        setCustomersCursor(res.nextCursor);
        setCustomersHasMore(!!res.nextCursor && res.items.length > 0);
        setSearchCursor(null);
        setSearchHasMore(false);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Gagal memuat data nasabah.');
    } finally {
      setLoadingPage(false);
    }
  }, [searchQuery]);

  const loadCustomersNextPage = useCallback(async () => {
    const term = searchQuery.trim();
    if (loadingPage) return;
    if (term.length > 1) {
      if (!searchHasMore) return;
    } else {
      if (!customersHasMore) return;
    }
    setLoadingPage(true);
    try {
      if (term.length > 1) {
        const res = await searchCustomersPage({ searchTerm: term, pageSize: 20, cursor: searchCursor });
        if (term !== searchQuery.trim()) return;
        setCustomers((prev) => {
          const existing = new Set(prev.map((c) => c.uid));
          const merged = [...prev];
          for (const item of res.items) {
            if (!existing.has(item.uid)) merged.push(item);
          }
          return merged;
        });
        setSearchCursor(res.nextCursor);
        setSearchHasMore(!!res.nextCursor && res.items.length > 0);
      } else {
        const res = await fetchCustomersPage({ pageSize: 20, cursor: customersCursor });
        setCustomers((prev) => {
          const existing = new Set(prev.map((c) => c.uid));
          const merged = [...prev];
          for (const item of res.items) {
            if (!existing.has(item.uid)) merged.push(item);
          }
          return merged;
        });
        setCustomersCursor(res.nextCursor);
        setCustomersHasMore(!!res.nextCursor && res.items.length > 0);
      }
    } finally {
      setLoadingPage(false);
    }
  }, [customersCursor, customersHasMore, loadingPage, searchCursor, searchHasMore, searchQuery]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCustomersFirstPage();
    setRefreshing(false);
  };

  useEffect(() => {
    loadCustomersFirstPage();
  }, [loadCustomersFirstPage]);

  const openAddDialog = () => {
    setIsEditMode(false);
    setEditingId(null);
    setNewName('');
    setNewEmail('');
    setNewPassword('');
    setNewPhone('');
    setNewAddress('');
    setNewLimit('');
    setDialogVisible(true);
  };

  const openEditDialog = (cust: CustomerData) => {
    setIsEditMode(true);
    setEditingId(cust.uid);
    setNewName(cust.name);
    setNewEmail(cust.email);
    setNewPassword(''); // Password not editable directly here
    setNewPhone(cust.phone || '');
    setNewAddress(cust.address || '');
    setNewLimit(cust.creditLimit.toString());
    setDialogVisible(true);
  };

  const handleSaveCustomer = async () => {
    if (!newName || !newEmail || (!isEditMode && !newPassword) || !newPhone || !newAddress) {
      Alert.alert('Validasi Error', 'Nama, Email, Password (untuk baru), Telepon, dan Alamat wajib diisi.');
      return;
    }

    setLoadingAction(true);
    try {
      if (isEditMode && editingId) {
        // Edit Mode
        await updateCustomerProfile(editingId, {
          name: newName,
          email: newEmail,
          phone: newPhone,
          address: newAddress,
          creditLimit: parseFloat(newLimit) || 0,
        });
        Alert.alert('Sukses', 'Data nasabah berhasil diperbarui');
      } else {
        // Add Mode
        const user = await createSecondaryUser(newEmail, newPassword);
        await createCustomerProfile(user.uid, {
          uid: user.uid,
          name: newName,
          email: newEmail,
          role: 'customer',
          phone: newPhone,
          address: newAddress,
          creditLimit: parseFloat(newLimit) || 0,
          currentDebt: 0,
          totalDebt: 0
        });
        Alert.alert('Sukses', 'Nasabah baru berhasil ditambahkan');
      }

      setDialogVisible(false);
      loadCustomersFirstPage();
    } catch (error: any) {
      Alert.alert('Gagal', error.message || 'Terjadi kesalahan');
    } finally {
      setLoadingAction(false);
    }
  };

  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.email.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (filter === 'new') return (c.totalDebt || 0) === 0;
    return (c.totalDebt || 0) > 0;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount || 0);
  };

  const [detailVisible, setDetailVisible] = useState(false);
  const [detailCustomer, setDetailCustomer] = useState<CustomerData | null>(null);
  const [detailTab, setDetailTab] = useState<'credits' | 'payments'>('credits');
  const [creditFilter, setCreditFilter] = useState<'all' | 'unpaid' | 'overdue' | 'paid'>('all');

  const [creditsLoading, setCreditsLoading] = useState(false);
  const [creditsCursor, setCreditsCursor] = useState<any>(null);
  const [creditsHasMore, setCreditsHasMore] = useState(true);
  const [creditTransactions, setCreditTransactions] = useState<any[]>([]);

  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsCursor, setPaymentsCursor] = useState<any>(null);
  const [paymentsHasMore, setPaymentsHasMore] = useState(true);
  const [paymentTransactions, setPaymentTransactions] = useState<PaymentTransaction[]>([]);
  const [paymentsStartDate, setPaymentsStartDate] = useState<Date | null>(null);
  const [paymentsEndDate, setPaymentsEndDate] = useState<Date | null>(null);
  const [paymentsMinAmount, setPaymentsMinAmount] = useState('');
  const [paymentsMaxAmount, setPaymentsMaxAmount] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [proofDialogVisible, setProofDialogVisible] = useState(false);
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [printingPaymentsHistory, setPrintingPaymentsHistory] = useState(false);
  const [printingPaymentId, setPrintingPaymentId] = useState<string | null>(null);

  const openCustomerDetail = async (cust: CustomerData) => {
    if (!user || user.role !== 'employee') {
      Alert.alert('Akses Ditolak', 'Role Anda tidak memiliki akses ke modul nasabah.');
      return;
    }

    setDetailCustomer(cust);
    setDetailVisible(true);
    setDetailTab('credits');
    setCreditFilter('all');
    setCreditTransactions([]);
    setCreditsCursor(null);
    setCreditsHasMore(true);
    setPaymentTransactions([]);
    setPaymentsCursor(null);
    setPaymentsHasMore(true);
    setPaymentsStartDate(null);
    setPaymentsEndDate(null);
    setPaymentsMinAmount('');
    setPaymentsMaxAmount('');

    try {
      await logCustomerAccess({
        actorId: user.id,
        actorName: user.name,
        actorRole: 'employee',
        customerId: cust.uid,
        customerName: cust.name,
        action: 'view_customer_detail'
      });
    } catch {}

    await loadCreditsFirstPage(cust.uid);
  };

  const loadCreditsFirstPage = async (customerId: string) => {
    setCreditsLoading(true);
    try {
      const res = await fetchCustomerTransactionsPage({
        customerId,
        kind: 'credit',
        pageSize: 10
      });
      setCreditTransactions(res.items);
      setCreditsCursor(res.nextCursor);
      setCreditsHasMore(!!res.nextCursor && res.items.length > 0);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Gagal memuat data hutang.');
    } finally {
      setCreditsLoading(false);
    }
  };

  const loadCreditsNextPage = async () => {
    if (!detailCustomer || !creditsHasMore || creditsLoading) return;
    setCreditsLoading(true);
    try {
      const res = await fetchCustomerTransactionsPage({
        customerId: detailCustomer.uid,
        kind: 'credit',
        pageSize: 10,
        cursor: creditsCursor
      });
      setCreditTransactions((prev) => {
        const existing = new Set(prev.map((t: any) => t.id));
        const merged = [...prev];
        for (const item of res.items) {
          if (!existing.has(item.id)) merged.push(item);
        }
        return merged;
      });
      setCreditsCursor(res.nextCursor);
      setCreditsHasMore(!!res.nextCursor && res.items.length > 0);
    } finally {
      setCreditsLoading(false);
    }
  };

  const loadPaymentsFirstPage = async (customerId: string) => {
    setPaymentsLoading(true);
    try {
      const res = await fetchCustomerTransactionsPage({
        customerId,
        kind: 'payment',
        startDate: paymentsStartDate,
        endDate: paymentsEndDate,
        pageSize: 10
      });
      setPaymentTransactions(res.items as PaymentTransaction[]);
      setPaymentsCursor(res.nextCursor);
      setPaymentsHasMore(!!res.nextCursor && res.items.length > 0);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Gagal memuat riwayat pembayaran.');
    } finally {
      setPaymentsLoading(false);
    }
  };

  const loadPaymentsNextPage = async () => {
    if (!detailCustomer || !paymentsHasMore || paymentsLoading) return;
    setPaymentsLoading(true);
    try {
      const res = await fetchCustomerTransactionsPage({
        customerId: detailCustomer.uid,
        kind: 'payment',
        startDate: paymentsStartDate,
        endDate: paymentsEndDate,
        pageSize: 10,
        cursor: paymentsCursor
      });
      setPaymentTransactions((prev) => {
        const existing = new Set(prev.map((t) => t.id));
        const merged = [...prev];
        for (const item of res.items as PaymentTransaction[]) {
          if (!existing.has(item.id)) merged.push(item);
        }
        return merged;
      });
      setPaymentsCursor(res.nextCursor);
      setPaymentsHasMore(!!res.nextCursor && (res.items as any[]).length > 0);
    } finally {
      setPaymentsLoading(false);
    }
  };

  const formatDateTime = (value: any) => {
    const dt = value?.toDate ? value.toDate() : value instanceof Date ? value : new Date(value);
    if (!dt || isNaN(dt.getTime())) return '-';
    return dt.toLocaleString('id-ID');
  };

  const parseNumber = (raw: string) => {
    const n = parseInt(String(raw).replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(n) ? n : null;
  };

  const creditStatusOf = (tx: any) => {
    const installments = Array.isArray(tx.installments) ? tx.installments : [];
    const now = new Date();
    const unpaid = installments.filter((i: any) => i?.status !== 'paid');
    const overdue = unpaid.filter((i: any) => {
      const due = i?.dueDate?.toDate ? i.dueDate.toDate() : new Date(i?.dueDate);
      return due instanceof Date && !isNaN(due.getTime()) && due.getTime() < now.getTime();
    });
    if (unpaid.length === 0) return 'paid';
    if (overdue.length > 0) return 'overdue';
    return 'unpaid';
  };

  const filteredCredits = creditTransactions.filter((tx: any) => {
    if (creditFilter === 'all') return true;
    return creditStatusOf(tx) === creditFilter;
  });

  const filteredPayments = paymentTransactions.filter((tx) => {
    const min = parseNumber(paymentsMinAmount);
    const max = parseNumber(paymentsMaxAmount);
    if (min != null && (tx.amount || 0) < min) return false;
    if (max != null && (tx.amount || 0) > max) return false;
    return true;
  });

  const canPrint = user?.role === 'admin' || user?.role === 'employee';

  const toDate = (value: any) => {
    return value?.toDate?.() || (value instanceof Date ? value : new Date(value));
  };

  const handlePrintPaymentsHistory = async () => {
    if (!detailCustomer) return;
    if (!canPrint || !user) {
      Alert.alert('Akses Ditolak', 'Role Anda tidak memiliki akses cetak.');
      return;
    }
    if (printingPaymentsHistory) return;
    setPrintingPaymentsHistory(true);
    try {
      const scoped =
        user.role === 'employee' ? filteredPayments.filter((tx) => tx.collectorId === user.id) : filteredPayments;

      const items = scoped.map((tx) => ({
        id: tx.id,
        receiptNumber: tx.receiptNumber,
        createdAt: toDate(tx.createdAt),
        amount: tx.amount || 0,
        paymentMethod: tx.paymentMethod,
        collectorName: tx.collectorName || '',
        paymentReference: tx.paymentReference || '',
        notes: tx.notes || ''
      }));

      await generatePaymentsHistoryPDF({
        customerName: detailCustomer.name,
        customerId: detailCustomer.uid,
        items,
        startDate: paymentsStartDate,
        endDate: paymentsEndDate,
        officerName: user?.name || 'Petugas'
      });

      try {
        await logPrintActivity({
          actorId: user.id,
          actorName: user.name,
          actorRole: user.role === 'admin' ? 'admin' : 'employee',
          action: 'print_payments_history',
          targetId: detailCustomer.uid,
          targetName: detailCustomer.name,
          meta: {
            startDate: paymentsStartDate ? paymentsStartDate.toISOString() : null,
            endDate: paymentsEndDate ? paymentsEndDate.toISOString() : null,
            minAmount: parseNumber(paymentsMinAmount),
            maxAmount: parseNumber(paymentsMaxAmount),
            scope: user.role === 'employee' ? 'collector_only' : 'all',
            count: items.length
          }
        });
      } catch {}
    } catch (e: any) {
      Alert.alert('Gagal', e?.message || 'Tidak bisa mencetak riwayat pembayaran');
    } finally {
      setPrintingPaymentsHistory(false);
    }
  };

  const handlePrintPaymentReceipt = async (tx: PaymentTransaction) => {
    if (!detailCustomer) return;
    if (!canPrint || !user) {
      Alert.alert('Akses Ditolak', 'Role Anda tidak memiliki akses cetak.');
      return;
    }
    if (user.role === 'employee' && tx.collectorId !== user.id) {
      Alert.alert('Akses Ditolak', 'Anda hanya bisa mencetak bukti pembayaran yang Anda catat.');
      return;
    }
    if (printingPaymentId) return;
    setPrintingPaymentId(tx.id);
    try {
      await generatePaymentReceiptPDF({
        receiptNumber: tx.receiptNumber || `PM/${tx.id.slice(0, 8).toUpperCase()}`,
        createdAt: toDate(tx.createdAt),
        customerName: detailCustomer.name,
        customerId: detailCustomer.uid,
        amount: tx.amount || 0,
        paymentMethod: tx.paymentMethod || 'cash',
        collectorName: tx.collectorName || user?.name || 'Petugas',
        notes: tx.notes || '',
        paymentReference: tx.paymentReference || ''
      });

      try {
        await logPrintActivity({
          actorId: user.id,
          actorName: user.name,
          actorRole: user.role === 'admin' ? 'admin' : 'employee',
          action: 'print_payment_receipt',
          targetId: tx.id,
          targetName: detailCustomer.name,
          meta: {
            receiptNumber: tx.receiptNumber || '',
            amount: tx.amount || 0,
            method: tx.paymentMethod || ''
          }
        });
      } catch {}
    } catch (e: any) {
      Alert.alert('Gagal', e?.message || 'Tidak bisa mencetak bukti pembayaran');
    } finally {
      setPrintingPaymentId(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F2' }}>
      <Appbar.Header style={{ backgroundColor: '#fff', elevation: 2 }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Nasabah (Karyawan)" />
      </Appbar.Header>

      <View style={{ padding: 16, paddingBottom: 8 }}>
        <Searchbar
          placeholder="Cari Nasabah..."
          onChangeText={(text) => {
            setSearchQuery(text);
          }}
          onSubmitEditing={loadCustomersFirstPage}
          value={searchQuery}
          style={{ marginBottom: 12, backgroundColor: '#fff' }}
        />
        <SegmentedButtons
          value={filter}
          onValueChange={setFilter}
          buttons={[
            { value: 'new', label: 'Nasabah Baru' },
            { value: 'old', label: 'Nasabah Lama (Aktif)' },
          ]}
        />
      </View>

      <FlatList
        data={filteredCustomers}
        keyExtractor={(item) => item.uid}
        contentContainerStyle={{ padding: 16, paddingTop: 0, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReachedThreshold={0.2}
        onEndReached={loadCustomersNextPage}
        ListEmptyComponent={
          loadingPage ? (
            <View style={{ paddingTop: 24 }}>
              <ActivityIndicator />
            </View>
          ) : (
            <Text style={{ textAlign: 'center', color: '#757575', marginTop: 20 }}>
              Tidak ada nasabah dalam kategori ini.
            </Text>
          )
        }
        ListFooterComponent={
          loadingPage && customers.length > 0 ? (
            <View style={{ paddingVertical: 16 }}>
              <ActivityIndicator />
            </View>
          ) : null
        }
        renderItem={({ item: cust }) => (
          <Card key={cust.uid} style={{ marginBottom: 12 }} mode="elevated">
            <Card.Content style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Avatar.Icon size={48} icon="account" style={{ backgroundColor: filter === 'new' ? '#4CAF50' : '#FF9800' }} />
              <View style={{ marginLeft: 16, flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text variant="titleMedium">{cust.name}</Text>
                    <Text variant="bodySmall" style={{ color: '#757575' }}>{cust.email}</Text>
                    {cust.phone ? <Text variant="bodySmall">{cust.phone}</Text> : null}
                  </View>
                  <IconButton
                    icon="pencil"
                    size={20}
                    onPress={() => openEditDialog(cust)}
                  />
                </View>

                <Divider style={{ marginVertical: 8 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View>
                    <Text variant="labelSmall">Limit Kredit</Text>
                    <Text variant="bodyMedium" style={{ color: '#1E88E5' }}>{formatCurrency(cust.creditLimit)}</Text>
                  </View>
                  <View>
                    <Text variant="labelSmall">Utang Saat Ini</Text>
                    <Text variant="bodyMedium" style={{ color: '#F44336' }}>{formatCurrency(cust.totalDebt)}</Text>
                  </View>
                </View>
              </View>
            </Card.Content>
            <Card.Actions>
              <Button mode="contained" onPress={() => openCustomerDetail(cust)}>Detail</Button>
            </Card.Actions>
          </Card>
        )}
      />

      {/* Add/Edit Dialog */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title>{isEditMode ? 'Edit Data Nasabah' : 'Tambah Nasabah Baru'}</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView contentContainerStyle={{ paddingVertical: 10 }}>
              <TextInput label="Nama Lengkap" value={newName} onChangeText={setNewName} style={{ marginBottom: 10 }} mode="outlined" />
              <TextInput label="Email" value={newEmail} onChangeText={setNewEmail} autoCapitalize="none" keyboardType="email-address" style={{ marginBottom: 10 }} mode="outlined" disabled={isEditMode} />
              {!isEditMode && (
                <TextInput label="Password" value={newPassword} onChangeText={setNewPassword} secureTextEntry style={{ marginBottom: 10 }} mode="outlined" />
              )}
              <TextInput label="No. Telepon" value={newPhone} onChangeText={setNewPhone} keyboardType="phone-pad" style={{ marginBottom: 10 }} mode="outlined" />
              <TextInput label="Alamat" value={newAddress} onChangeText={setNewAddress} style={{ marginBottom: 10 }} mode="outlined" multiline />
              <TextInput label="Limit Kredit (Rp)" value={newLimit} onChangeText={setNewLimit} keyboardType="numeric" mode="outlined" />
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Batal</Button>
            {loadingAction ? <ActivityIndicator animating={true} style={{ padding: 10 }} /> : <Button onPress={handleSaveCustomer}>Simpan</Button>}
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog visible={detailVisible} onDismiss={() => setDetailVisible(false)} style={{ maxHeight: 700 }}>
          <Dialog.Title>{detailCustomer ? `Detail Nasabah: ${detailCustomer.name}` : 'Detail Nasabah'}</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView contentContainerStyle={{ paddingVertical: 10 }}>
              {detailCustomer ? (
                <>
                  <Card mode="outlined" style={{ marginBottom: 12 }}>
                    <Card.Content>
                      <Text variant="titleMedium">{detailCustomer.name}</Text>
                      <Text variant="bodySmall" style={{ color: '#757575' }}>{detailCustomer.email}</Text>
                      {detailCustomer.phone ? <Text variant="bodySmall">{detailCustomer.phone}</Text> : null}
                      {detailCustomer.address ? <Text variant="bodySmall">{detailCustomer.address}</Text> : null}
                      <Divider style={{ marginVertical: 10 }} />
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <View>
                          <Text variant="labelSmall">Limit</Text>
                          <Text variant="bodyMedium">{formatCurrency(detailCustomer.creditLimit)}</Text>
                        </View>
                        <View>
                          <Text variant="labelSmall">Total Hutang</Text>
                          <Text variant="bodyMedium" style={{ color: '#F44336' }}>{formatCurrency(detailCustomer.totalDebt)}</Text>
                        </View>
                      </View>
                    </Card.Content>
                  </Card>

                  <SegmentedButtons
                    value={detailTab}
                    onValueChange={(val) => {
                      const v = val as 'credits' | 'payments';
                      setDetailTab(v);
                      if (v === 'payments' && detailCustomer) {
                        loadPaymentsFirstPage(detailCustomer.uid);
                      }
                      if (v === 'credits' && detailCustomer) {
                        loadCreditsFirstPage(detailCustomer.uid);
                      }
                    }}
                    buttons={[
                      { value: 'credits', label: 'Hutang' },
                      { value: 'payments', label: 'Pembayaran' },
                    ]}
                    style={{ marginBottom: 10 }}
                  />

                  {detailTab === 'credits' ? (
                    <>
                      <SegmentedButtons
                        value={creditFilter}
                        onValueChange={(v) => setCreditFilter(v as any)}
                        buttons={[
                          { value: 'all', label: 'Semua' },
                          { value: 'unpaid', label: 'Belum Lunas' },
                          { value: 'overdue', label: 'Jatuh Tempo' },
                          { value: 'paid', label: 'Lunas' },
                        ]}
                        style={{ marginBottom: 10 }}
                      />
                      {creditsLoading && creditTransactions.length === 0 ? <ActivityIndicator style={{ marginVertical: 10 }} /> : null}
                      {filteredCredits.length === 0 && !creditsLoading ? (
                        <Text style={{ textAlign: 'center', color: '#757575', marginTop: 12 }}>Tidak ada data hutang.</Text>
                      ) : null}
                      {filteredCredits.map((tx: any) => {
                        const installments = Array.isArray(tx.installments) ? tx.installments : [];
                        const unpaid = installments.filter((i: any) => i?.status !== 'paid');
                        const nextDue = unpaid
                          .map((i: any) => i?.dueDate?.toDate ? i.dueDate.toDate() : new Date(i?.dueDate))
                          .filter((d: any) => d instanceof Date && !isNaN(d.getTime()))
                          .sort((a: Date, b: Date) => a.getTime() - b.getTime())[0];
                        const status = creditStatusOf(tx);
                        return (
                          <Card key={tx.id} mode="outlined" style={{ marginBottom: 10 }}>
                            <Card.Content>
                              <Text variant="titleSmall">{tx.productName || 'Kredit'}</Text>
                              <Text variant="bodySmall" style={{ color: '#757575' }}>Tanggal: {formatDateTime(tx.createdAt)}</Text>
                              <Text variant="bodySmall">Sisa Angsuran: {unpaid.length}</Text>
                              <Text variant="bodySmall">Jatuh Tempo Terdekat: {nextDue ? nextDue.toLocaleDateString('id-ID') : '-'}</Text>
                              <Text variant="bodySmall">Status: {status === 'paid' ? 'Lunas' : status === 'overdue' ? 'Jatuh Tempo' : 'Belum Lunas'}</Text>
                              {Array.isArray(tx.extensions) && tx.extensions.length > 0 ? (
                                <Text variant="bodySmall">Riwayat Perpanjangan: {tx.extensions.length}</Text>
                              ) : (
                                <Text variant="bodySmall">Riwayat Perpanjangan: -</Text>
                              )}
                            </Card.Content>
                          </Card>
                        );
                      })}
                      {creditsHasMore ? (
                        <Button mode="outlined" loading={creditsLoading} onPress={loadCreditsNextPage}>
                          Muat Lagi
                        </Button>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                        <Button mode="outlined" onPress={() => setShowStartPicker(true)} style={{ flex: 1 }}>
                          {paymentsStartDate ? paymentsStartDate.toLocaleDateString('id-ID') : 'Dari'}
                        </Button>
                        <Button mode="outlined" onPress={() => setShowEndPicker(true)} style={{ flex: 1 }}>
                          {paymentsEndDate ? paymentsEndDate.toLocaleDateString('id-ID') : 'Sampai'}
                        </Button>
                      </View>

                      {showStartPicker ? (
                        <DateTimePicker
                          value={paymentsStartDate || new Date()}
                          mode="date"
                          maximumDate={new Date()}
                          onChange={(_e, date) => {
                            setShowStartPicker(false);
                            if (date) {
                              const next = new Date(date);
                              next.setHours(0, 0, 0, 0);
                              setPaymentsStartDate(next);
                            }
                          }}
                        />
                      ) : null}

                      {showEndPicker ? (
                        <DateTimePicker
                          value={paymentsEndDate || new Date()}
                          mode="date"
                          maximumDate={new Date()}
                          onChange={(_e, date) => {
                            setShowEndPicker(false);
                            if (date) {
                              const next = new Date(date);
                              next.setHours(23, 59, 59, 999);
                              setPaymentsEndDate(next);
                            }
                          }}
                        />
                      ) : null}

                      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                        <TextInput
                          mode="outlined"
                          label="Min"
                          value={paymentsMinAmount}
                          onChangeText={setPaymentsMinAmount}
                          keyboardType="numeric"
                          style={{ flex: 1, backgroundColor: '#fff' }}
                        />
                        <TextInput
                          mode="outlined"
                          label="Max"
                          value={paymentsMaxAmount}
                          onChangeText={setPaymentsMaxAmount}
                          keyboardType="numeric"
                          style={{ flex: 1, backgroundColor: '#fff' }}
                        />
                      </View>

                      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                        <Button
                          mode="contained-tonal"
                          loading={paymentsLoading}
                          onPress={() => detailCustomer && loadPaymentsFirstPage(detailCustomer.uid)}
                          style={{ flex: 1 }}
                        >
                          Terapkan Filter
                        </Button>
                        <Button
                          icon="printer"
                          mode="outlined"
                          onPress={handlePrintPaymentsHistory}
                          disabled={!canPrint || printingPaymentsHistory || paymentsLoading}
                          loading={printingPaymentsHistory}
                        >
                          Cetak
                        </Button>
                      </View>

                      {paymentsLoading && paymentTransactions.length === 0 ? <ActivityIndicator style={{ marginVertical: 10 }} /> : null}
                      {filteredPayments.length === 0 && !paymentsLoading ? (
                        <Text style={{ textAlign: 'center', color: '#757575', marginTop: 12 }}>Tidak ada riwayat pembayaran.</Text>
                      ) : null}

                      {filteredPayments.map((tx) => (
                        <Card key={tx.id} mode="outlined" style={{ marginBottom: 10 }}>
                          <Card.Content>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                              <Text variant="titleSmall">{formatCurrency(tx.amount || 0)}</Text>
                              <IconButton
                                icon="printer"
                                onPress={() => handlePrintPaymentReceipt(tx)}
                                disabled={
                                  !canPrint ||
                                  printingPaymentId === tx.id ||
                                  (user?.role === 'employee' && tx.collectorId !== user.id)
                                }
                                loading={printingPaymentId === tx.id}
                              />
                            </View>
                            <Text variant="bodySmall" style={{ color: '#757575' }}>Tanggal: {formatDateTime(tx.createdAt)}</Text>
                            <Text variant="bodySmall">Metode: {tx.paymentMethod === 'transfer' ? 'Transfer' : 'Cash'}</Text>
                            {tx.paymentReference ? <Text variant="bodySmall">Ref: {tx.paymentReference}</Text> : null}
                            {tx.receiptNumber ? <Text variant="bodySmall">No: {tx.receiptNumber}</Text> : null}
                            {tx.notes ? <Text variant="bodySmall">Catatan: {tx.notes}</Text> : null}
                            {tx.paymentProofImage ? (
                              <Button
                                mode="text"
                                onPress={() => {
                                  setProofImage(tx.paymentProofImage || null);
                                  setProofDialogVisible(true);
                                }}
                                style={{ marginTop: 10, alignSelf: 'flex-start' }}
                                textColor="#1E88E5"
                              >
                                Lihat Bukti
                              </Button>
                            ) : null}
                          </Card.Content>
                        </Card>
                      ))}

                      {paymentsHasMore ? (
                        <Button mode="outlined" loading={paymentsLoading} onPress={loadPaymentsNextPage}>
                          Muat Lagi
                        </Button>
                      ) : null}
                    </>
                  )}
                </>
              ) : (
                <Text style={{ textAlign: 'center', color: '#757575', marginTop: 12 }}>Tidak ada data.</Text>
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setDetailVisible(false)}>Tutup</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog visible={proofDialogVisible} onDismiss={() => setProofDialogVisible(false)} style={{ maxHeight: 700 }}>
          <Dialog.Title>Bukti Transaksi</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView contentContainerStyle={{ paddingVertical: 10 }}>
              {proofImage ? (
                <Image source={{ uri: proofImage }} style={{ width: '100%', height: 360, resizeMode: 'contain' }} />
              ) : (
                <Text style={{ textAlign: 'center', color: '#757575' }}>Tidak ada bukti.</Text>
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setProofDialogVisible(false)}>Tutup</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <FAB
        icon="plus"
        style={{ position: 'absolute', margin: 16, right: 0, bottom: 0, backgroundColor: '#00E676' }}
        onPress={openAddDialog}
      />
    </View>
  );
}
