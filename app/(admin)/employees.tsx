import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, RefreshControl, ScrollView, View } from 'react-native';
import { ActivityIndicator, Appbar, Avatar, Button, Card, Chip, Dialog, Divider, FAB, IconButton, Menu, Portal, SegmentedButtons, Text, TextInput } from 'react-native-paper';
// import { GradientBackground } from '../../src/components/GradientBackground';
import DateTimePicker from '@react-native-community/datetimepicker';
import { createSecondaryUser } from '../../src/services/authSdk';
import { createEmployeeProfile, createEmployeeWithdrawal, EmployeeData, EmployeeWithdrawalRecord, fetchEmployeeWithdrawalsPage, getEmployees, logPrintActivity, updateEmployee, updateEmployeeProfitSharePercentage } from '../../src/services/firestore';
import { generateEmployeeWithdrawalReceiptPDF, generateEmployeeWithdrawalsHistoryPDF, generateProfitSharesHistoryPDF, shareCsv } from '../../src/services/printService';
import { fetchProfitSharesPage, ProfitShareRecord } from '../../src/services/transactionService';
import { useAuthStore } from '../../src/store/authStore';

export default function EmployeesManagement() {
  const router = useRouter();
  const currentUser = useAuthStore(state => state.user);
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'employees' | 'withdrawals' | 'profitShare'>('employees');
  
  // Edit Dialog State
  const [visible, setVisible] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeData | null>(null);
  const [target, setTarget] = useState('');
  const [bonus, setBonus] = useState('');
  const [internalDebt, setInternalDebt] = useState('');
  const [profitSharePercentage, setProfitSharePercentage] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawNotes, setWithdrawNotes] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  // Add Employee Dialog State
  const [addVisible, setAddVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loadingAdd, setLoadingAdd] = useState(false);

  const loadEmployees = useCallback(async () => {
    try {
      const data = await getEmployees();
      setEmployees(data);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Gagal memuat data karyawan. Pastikan permission/index sudah benar.');
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const openEditDialog = (emp: EmployeeData) => {
    setSelectedEmployee(emp);
    setTarget(emp.target?.toString() || '0');
    setBonus(emp.bonus?.toString() || '0');
    setInternalDebt(emp.internalDebt?.toString() || '0');
    const currentPct = typeof emp.profitSharePercentage === 'number' ? emp.profitSharePercentage : 0;
    setProfitSharePercentage(String(currentPct));
    setWithdrawAmount('');
    setWithdrawNotes('');
    setVisible(true);
  };

  const handleSave = async () => {
    if (!selectedEmployee) return;
    try {
      const parsedPct = parseFloat(profitSharePercentage.replace(',', '.'));
      if (!Number.isFinite(parsedPct) || parsedPct < 0 || parsedPct > 100) {
        Alert.alert('Validasi', 'Presentase bagi hasil harus berupa angka 0-100');
        return;
      }
      setSavingEdit(true);

      const storedPct =
        typeof selectedEmployee.profitSharePercentage === 'number' ? selectedEmployee.profitSharePercentage : 0;
      if (Math.round((storedPct + Number.EPSILON) * 100) / 100 !== Math.round((parsedPct + Number.EPSILON) * 100) / 100) {
        await updateEmployeeProfitSharePercentage(
          selectedEmployee.uid,
          parsedPct,
          currentUser?.id || 'admin',
          currentUser?.name || 'Admin'
        );
      }

      await updateEmployee(selectedEmployee.uid, {
        target: parseFloat(target) || 0,
        bonus: parseFloat(bonus) || 0,
        internalDebt: parseFloat(internalDebt) || 0,
      });
      setVisible(false);
      loadEmployees();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Gagal menyimpan perubahan');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleWithdraw = async () => {
    if (!selectedEmployee) return;
    const amount = parseFloat(withdrawAmount.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Validasi', 'Nominal penarikan harus berupa angka lebih dari 0');
      return;
    }
    setWithdrawing(true);
    try {
      await createEmployeeWithdrawal({
        employeeId: selectedEmployee.uid,
        amount,
        actorId: currentUser?.id || 'admin',
        actorName: currentUser?.name || 'Admin',
        notes: withdrawNotes
      });
      setWithdrawAmount('');
      setWithdrawNotes('');
      await loadEmployees();
      if (viewMode === 'withdrawals') {
        await loadWithdrawals({ reset: true });
      }
      Alert.alert('Sukses', 'Penarikan berhasil dicatat');
    } catch (e: any) {
      Alert.alert('Gagal', e?.message || 'Tidak bisa memproses penarikan');
    } finally {
      setWithdrawing(false);
    }
  };

  const handleAddEmployee = async () => {
    if (!newName || !newEmail || !newPassword) {
      Alert.alert('Error', 'Semua kolom wajib diisi');
      return;
    }
    setLoadingAdd(true);
    try {
      // 1. Create User in Auth (Secondary App)
      const user = await createSecondaryUser(newEmail, newPassword);
      
      // 2. Create Profile in Firestore
      await createEmployeeProfile(user.uid, newName, newEmail);

      Alert.alert('Sukses', 'Karyawan berhasil ditambahkan');
      setAddVisible(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      loadEmployees();
    } catch (error: any) {
      console.error(error);
      Alert.alert('Gagal', error.message || 'Terjadi kesalahan saat membuat akun');
    } finally {
      setLoadingAdd(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount || 0);
  };

  const [withdrawals, setWithdrawals] = useState<EmployeeWithdrawalRecord[]>([]);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false);
  const [withdrawalsCursor, setWithdrawalsCursor] = useState<any>(null);
  const [withdrawalsHasMore, setWithdrawalsHasMore] = useState(true);
  const [withdrawalsEmployeeFilter, setWithdrawalsEmployeeFilter] = useState<string | null>(null);
  const [employeeMenuOpen, setEmployeeMenuOpen] = useState(false);
  const [withdrawalsStartDate, setWithdrawalsStartDate] = useState<Date | null>(null);
  const [withdrawalsEndDate, setWithdrawalsEndDate] = useState<Date | null>(null);
  const [showWithdrawalsStartPicker, setShowWithdrawalsStartPicker] = useState(false);
  const [showWithdrawalsEndPicker, setShowWithdrawalsEndPicker] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [withdrawalsStatusFilter, setWithdrawalsStatusFilter] = useState<'all' | 'completed' | 'void'>('all');
  const [printingWithdrawalsHistory, setPrintingWithdrawalsHistory] = useState(false);

  const [profitShares, setProfitShares] = useState<ProfitShareRecord[]>([]);
  const [profitSharesLoading, setProfitSharesLoading] = useState(false);
  const [profitSharesCursor, setProfitSharesCursor] = useState<any>(null);
  const [profitSharesHasMore, setProfitSharesHasMore] = useState(true);
  const [profitSharesEmployeeFilter, setProfitSharesEmployeeFilter] = useState<string | null>(null);
  const [profitSharesEmployeeMenuOpen, setProfitSharesEmployeeMenuOpen] = useState(false);
  const [profitSharesStartDate, setProfitSharesStartDate] = useState<Date | null>(null);
  const [profitSharesEndDate, setProfitSharesEndDate] = useState<Date | null>(null);
  const [showProfitSharesStartPicker, setShowProfitSharesStartPicker] = useState(false);
  const [showProfitSharesEndPicker, setShowProfitSharesEndPicker] = useState(false);
  const [profitSharesStatusFilter, setProfitSharesStatusFilter] = useState<'all' | 'earned' | 'paid' | 'void'>('all');
  const [printingProfitSharesHistory, setPrintingProfitSharesHistory] = useState(false);

  type WebDateTarget = 'withdrawalsStart' | 'withdrawalsEnd' | 'profitSharesStart' | 'profitSharesEnd';
  const [webDateDialog, setWebDateDialog] = useState<{ visible: boolean; target: WebDateTarget | null; value: string }>(
    { visible: false, target: null, value: '' }
  );

  const pad2 = (n: number) => String(n).padStart(2, '0');

  const toIsoDateInput = (date: Date) => {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  };

  const parseIsoDateInput = (value: string): Date | null => {
    const v = value.trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (!m) return null;
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;
    const dt = new Date(year, month - 1, day);
    if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) return null;
    return dt;
  };

  const openWebDateDialog = (target: WebDateTarget, current: Date | null) => {
    const base = current || new Date();
    setWebDateDialog({ visible: true, target, value: toIsoDateInput(base) });
  };

  const closeWebDateDialog = () => setWebDateDialog({ visible: false, target: null, value: '' });

  const confirmWebDateDialog = () => {
    if (!webDateDialog.target) return;
    const dt = parseIsoDateInput(webDateDialog.value);
    if (!dt) {
      Alert.alert('Validasi', 'Format tanggal harus YYYY-MM-DD');
      return;
    }
    if (webDateDialog.target === 'withdrawalsStart') {
      const next = new Date(dt);
      next.setHours(0, 0, 0, 0);
      setWithdrawalsStartDate(next);
    } else if (webDateDialog.target === 'withdrawalsEnd') {
      const next = new Date(dt);
      next.setHours(23, 59, 59, 999);
      setWithdrawalsEndDate(next);
    } else if (webDateDialog.target === 'profitSharesStart') {
      const next = new Date(dt);
      next.setHours(0, 0, 0, 0);
      setProfitSharesStartDate(next);
    } else if (webDateDialog.target === 'profitSharesEnd') {
      const next = new Date(dt);
      next.setHours(23, 59, 59, 999);
      setProfitSharesEndDate(next);
    }
    closeWebDateDialog();
  };

  const getEmployeeName = (employeeId?: string | null) => {
    if (!employeeId) return 'Semua Karyawan';
    const found = employees.find((e) => e.uid === employeeId);
    return found?.name || found?.email || employeeId;
  };

  const loadWithdrawals = useCallback(async (opts: { reset: boolean }) => {
    if (withdrawalsLoading) return;
    setWithdrawalsLoading(true);
    try {
      const cursor = opts.reset ? null : withdrawalsCursor;
      const { items, nextCursor } = await fetchEmployeeWithdrawalsPage({
        employeeId: withdrawalsEmployeeFilter,
        startDate: withdrawalsStartDate,
        endDate: withdrawalsEndDate,
        pageSize: 20,
        cursor
      });
      setWithdrawals((prev) => (opts.reset ? items : [...prev, ...items]));
      setWithdrawalsCursor(nextCursor);
      setWithdrawalsHasMore(Boolean(nextCursor) && items.length > 0);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Gagal memuat history penarikan (cek index Firestore)');
      if (opts.reset) {
        setWithdrawals([]);
        setWithdrawalsCursor(null);
        setWithdrawalsHasMore(false);
      }
    } finally {
      setWithdrawalsLoading(false);
    }
  }, [withdrawalsLoading, withdrawalsCursor, withdrawalsEmployeeFilter, withdrawalsStartDate, withdrawalsEndDate]);

  const handleExportCsv = async () => {
    if (exportingCsv) return;
    setExportingCsv(true);
    try {
      const rows: EmployeeWithdrawalRecord[] = [];
      let cursor: any = null;
      let page = 0;
      while (page < 30) {
        const res = await fetchEmployeeWithdrawalsPage({
          employeeId: withdrawalsEmployeeFilter,
          startDate: withdrawalsStartDate,
          endDate: withdrawalsEndDate,
          pageSize: 200,
          cursor
        });
        rows.push(...res.items);
        cursor = res.nextCursor;
        if (!cursor || res.items.length === 0) break;
        page += 1;
      }

      const fileNameParts: string[] = ['penarikan'];
      if (withdrawalsEmployeeFilter) fileNameParts.push(withdrawalsEmployeeFilter);
      fileNameParts.push(new Date().toISOString().slice(0, 10));

      const filteredRows =
        withdrawalsStatusFilter === 'all' ? rows : rows.filter((w) => (w.status || 'completed') === withdrawalsStatusFilter);

      await shareCsv({
        fileName: `${fileNameParts.join('_')}.csv`,
        headers: ['id', 'karyawan', 'tanggal', 'nominal', 'status', 'petugas', 'catatan'],
        rows: filteredRows.map((w) => {
          const dt = w.createdAt?.toDate?.() || (w.createdAt instanceof Date ? w.createdAt : new Date());
          return [
            w.id,
            w.employeeName || w.employeeId,
            dt.toLocaleString('id-ID'),
            w.amount,
            w.status,
            w.actorName || '',
            w.notes || ''
          ];
        })
      });
    } catch (e: any) {
      Alert.alert('Gagal', e?.message || 'Tidak bisa export CSV');
    } finally {
      setExportingCsv(false);
    }
  };

  const handlePrintReceipt = async (w: EmployeeWithdrawalRecord) => {
    if (printingId) return;
    setPrintingId(w.id);
    try {
      if (currentUser?.role !== 'admin') {
        Alert.alert('Akses Ditolak', 'Hanya admin yang bisa mencetak.');
        return;
      }
      const dt = w.createdAt?.toDate?.() || (w.createdAt instanceof Date ? w.createdAt : new Date());
      await generateEmployeeWithdrawalReceiptPDF({
        employeeName: w.employeeName || w.employeeId,
        amount: w.amount || 0,
        createdAt: dt,
        actorName: w.actorName || 'Admin',
        notes: w.notes || '',
        receiptNumber: `WD/${w.id.slice(0, 8).toUpperCase()}`
      });
      try {
        await logPrintActivity({
          actorId: currentUser?.id || 'admin',
          actorName: currentUser?.name || 'Admin',
          actorRole: 'admin',
          action: 'print_withdrawal_receipt',
          targetId: w.id,
          targetName: w.employeeName || w.employeeId,
          meta: {
            amount: w.amount || 0,
            status: w.status || 'completed'
          }
        });
      } catch {}
    } catch (e: any) {
      Alert.alert('Gagal', e?.message || 'Tidak bisa mencetak struk');
    } finally {
      setPrintingId(null);
    }
  };

  const handlePrintWithdrawalsHistory = async () => {
    if (printingWithdrawalsHistory) return;
    if (currentUser?.role !== 'admin') {
      Alert.alert('Akses Ditolak', 'Hanya admin yang bisa mencetak.');
      return;
    }
    setPrintingWithdrawalsHistory(true);
    try {
      const rows: EmployeeWithdrawalRecord[] = [];
      let cursor: any = null;
      let page = 0;
      while (page < 30) {
        const res = await fetchEmployeeWithdrawalsPage({
          employeeId: withdrawalsEmployeeFilter,
          startDate: withdrawalsStartDate,
          endDate: withdrawalsEndDate,
          pageSize: 200,
          cursor
        });
        rows.push(...res.items);
        cursor = res.nextCursor;
        if (!cursor || res.items.length === 0) break;
        page += 1;
      }

      const filteredRows =
        withdrawalsStatusFilter === 'all' ? rows : rows.filter((w) => (w.status || 'completed') === withdrawalsStatusFilter);

      await generateEmployeeWithdrawalsHistoryPDF({
        title: 'RIWAYAT PENARIKAN',
        employeeName: getEmployeeName(withdrawalsEmployeeFilter),
        items: filteredRows.map((w) => {
          const dt = w.createdAt?.toDate?.() || (w.createdAt instanceof Date ? w.createdAt : new Date());
          return {
            id: w.id,
            employeeName: w.employeeName || w.employeeId,
            createdAt: dt,
            amount: w.amount || 0,
            status: w.status || 'completed',
            actorName: w.actorName || '',
            notes: w.notes || ''
          };
        }),
        startDate: withdrawalsStartDate,
        endDate: withdrawalsEndDate,
        officerName: currentUser?.name || 'Admin'
      });

      try {
        await logPrintActivity({
          actorId: currentUser?.id || 'admin',
          actorName: currentUser?.name || 'Admin',
          actorRole: 'admin',
          action: 'print_withdrawals_history',
          targetId: withdrawalsEmployeeFilter || '',
          targetName: getEmployeeName(withdrawalsEmployeeFilter),
          meta: {
            startDate: withdrawalsStartDate ? withdrawalsStartDate.toISOString() : null,
            endDate: withdrawalsEndDate ? withdrawalsEndDate.toISOString() : null,
            status: withdrawalsStatusFilter,
            count: filteredRows.length
          }
        });
      } catch {}
    } catch (e: any) {
      Alert.alert('Gagal', e?.message || 'Tidak bisa mencetak riwayat penarikan');
    } finally {
      setPrintingWithdrawalsHistory(false);
    }
  };

  const handlePrintProfitSharesHistory = async () => {
    if (printingProfitSharesHistory) return;
    if (currentUser?.role !== 'admin') {
      Alert.alert('Akses Ditolak', 'Hanya admin yang bisa mencetak.');
      return;
    }
    setPrintingProfitSharesHistory(true);
    try {
      const rows: ProfitShareRecord[] = [];
      let cursor: any = null;
      let page = 0;
      while (page < 30) {
        const res = await fetchProfitSharesPage({
          collectorId: profitSharesEmployeeFilter,
          startDate: profitSharesStartDate,
          endDate: profitSharesEndDate,
          pageSize: 200,
          cursor
        });
        rows.push(...res.items);
        cursor = res.nextCursor;
        if (!cursor || res.items.length === 0) break;
        page += 1;
      }

      const filteredRows =
        profitSharesStatusFilter === 'all' ? rows : rows.filter((r) => (r.status || 'earned') === profitSharesStatusFilter);

      await generateProfitSharesHistoryPDF({
        title: 'RIWAYAT SETORAN',
        employeeName: getEmployeeName(profitSharesEmployeeFilter),
        items: filteredRows.map((r) => {
          const dt = r.createdAt?.toDate?.() || (r.createdAt instanceof Date ? r.createdAt : new Date());
          return {
            id: r.id,
            customerName: r.customerName || r.customerId,
            createdAt: dt,
            paymentAmount: r.paymentAmount || 0,
            profitShareAmount: r.profitShareAmount || 0,
            percentage: typeof r.percentage === 'number' ? r.percentage : 0,
            status: r.status || 'earned',
            collectorName: r.collectorName || '',
            notes: r.notes || ''
          };
        }),
        startDate: profitSharesStartDate,
        endDate: profitSharesEndDate,
        officerName: currentUser?.name || 'Admin'
      });

      try {
        await logPrintActivity({
          actorId: currentUser?.id || 'admin',
          actorName: currentUser?.name || 'Admin',
          actorRole: 'admin',
          action: 'print_profit_shares_history',
          targetId: profitSharesEmployeeFilter || '',
          targetName: getEmployeeName(profitSharesEmployeeFilter),
          meta: {
            startDate: profitSharesStartDate ? profitSharesStartDate.toISOString() : null,
            endDate: profitSharesEndDate ? profitSharesEndDate.toISOString() : null,
            status: profitSharesStatusFilter,
            count: filteredRows.length
          }
        });
      } catch {}
    } catch (e: any) {
      Alert.alert('Gagal', e?.message || 'Tidak bisa mencetak riwayat setoran');
    } finally {
      setPrintingProfitSharesHistory(false);
    }
  };

  const loadProfitShares = useCallback(async (opts: { reset: boolean }) => {
    if (profitSharesLoading) return;
    setProfitSharesLoading(true);
    try {
      const cursor = opts.reset ? null : profitSharesCursor;
      const { items, nextCursor } = await fetchProfitSharesPage({
        collectorId: profitSharesEmployeeFilter,
        startDate: profitSharesStartDate,
        endDate: profitSharesEndDate,
        pageSize: 20,
        cursor
      });
      setProfitShares((prev) => (opts.reset ? items : [...prev, ...items]));
      setProfitSharesCursor(nextCursor);
      setProfitSharesHasMore(Boolean(nextCursor) && items.length > 0);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Gagal memuat riwayat setoran (cek index Firestore)');
      if (opts.reset) {
        setProfitShares([]);
        setProfitSharesCursor(null);
        setProfitSharesHasMore(false);
      }
    } finally {
      setProfitSharesLoading(false);
    }
  }, [profitSharesLoading, profitSharesCursor, profitSharesEmployeeFilter, profitSharesStartDate, profitSharesEndDate]);

  useEffect(() => {
    if (viewMode !== 'withdrawals') return;
    setWithdrawalsCursor(null);
    setWithdrawalsHasMore(true);
    loadWithdrawals({ reset: true });
  }, [viewMode, withdrawalsEmployeeFilter, withdrawalsStartDate, withdrawalsEndDate, loadWithdrawals]);

  useEffect(() => {
    if (viewMode !== 'profitShare') return;
    setProfitSharesCursor(null);
    setProfitSharesHasMore(true);
    loadProfitShares({ reset: true });
  }, [viewMode, profitSharesEmployeeFilter, profitSharesStartDate, profitSharesEndDate, loadProfitShares]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadEmployees();
    if (viewMode === 'withdrawals') {
      await loadWithdrawals({ reset: true });
    }
    if (viewMode === 'profitShare') {
      await loadProfitShares({ reset: true });
    }
    setRefreshing(false);
  }, [viewMode, loadEmployees, loadWithdrawals, loadProfitShares]);

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F2' }}>
      <Appbar.Header style={{ backgroundColor: '#fff', elevation: 2 }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Data Karyawan" />
      </Appbar.Header>

      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <SegmentedButtons
          value={viewMode}
          onValueChange={(v) => setViewMode(v as any)}
          buttons={[
            { value: 'employees', label: 'Karyawan', icon: 'account-group' },
            { value: 'withdrawals', label: 'History Penarikan', icon: 'history' },
            { value: 'profitShare', label: 'Riwayat Setoran', icon: 'cash' }
          ]}
        />
      </View>

      <ScrollView 
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {viewMode === 'employees' ? (
          employees.length === 0 ? (
            <Text style={{ textAlign: 'center', color: '#B0BEC5', marginTop: 20 }}>
              Belum ada karyawan terdaftar.
            </Text>
          ) : (
            employees.map((emp) => (
              <Card key={emp.uid} style={{ marginBottom: 12 }} mode="elevated" onPress={() => openEditDialog(emp)}>
                <Card.Content style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Avatar.Icon size={48} icon="account" style={{ backgroundColor: '#1E88E5' }} />
                  <View style={{ marginLeft: 16, flex: 1 }}>
                    <Text variant="titleMedium">{emp.name || 'Tanpa Nama'}</Text>
                    <Text variant="bodySmall" style={{ color: '#757575' }}>{emp.email}</Text>
                    <Divider style={{ marginVertical: 8 }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <View>
                        <Text variant="labelSmall">Target</Text>
                        <Text variant="bodyMedium" style={{ color: '#1E88E5' }}>{formatCurrency(emp.target)}</Text>
                      </View>
                      <View>
                        <Text variant="labelSmall">Capaian</Text>
                        <Text variant="bodyMedium" style={{ color: '#43A047' }}>{formatCurrency(emp.collected)}</Text>
                      </View>
                      <View>
                        <Text variant="labelSmall">Bonus</Text>
                        <Text variant="bodyMedium" style={{ color: '#FB8C00' }}>{formatCurrency(emp.bonus)}</Text>
                      </View>
                    </View>
                    <View style={{ marginTop: 10, flexDirection: 'row' }}>
                      <Chip icon="percent" style={{ backgroundColor: '#F3E5F5' }}>
                        {typeof emp.profitSharePercentage === 'number' ? emp.profitSharePercentage : 0}%
                      </Chip>
                    </View>
                  </View>
                </Card.Content>
              </Card>
            ))
          )
        ) : viewMode === 'withdrawals' ? (
          <>
            <Card style={{ marginBottom: 12 }} mode="elevated">
              <Card.Content>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Menu
                    visible={employeeMenuOpen}
                    onDismiss={() => setEmployeeMenuOpen(false)}
                    anchor={
                      <Button mode="outlined" onPress={() => setEmployeeMenuOpen(true)} style={{ flex: 1, marginRight: 8 }}>
                        {getEmployeeName(withdrawalsEmployeeFilter)}
                      </Button>
                    }
                  >
                    <Menu.Item
                      onPress={() => {
                        setWithdrawalsEmployeeFilter(null);
                        setEmployeeMenuOpen(false);
                      }}
                      title="Semua Karyawan"
                    />
                    <Divider />
                    {employees.map((e) => (
                      <Menu.Item
                        key={e.uid}
                        onPress={() => {
                          setWithdrawalsEmployeeFilter(e.uid);
                          setEmployeeMenuOpen(false);
                        }}
                        title={e.name || e.email || e.uid}
                      />
                    ))}
                  </Menu>

                  <IconButton
                    icon="refresh"
                    onPress={() => loadWithdrawals({ reset: true })}
                    disabled={withdrawalsLoading}
                  />
                  <IconButton
                    icon="download"
                    onPress={handleExportCsv}
                    disabled={withdrawalsLoading || exportingCsv}
                  />
                  <IconButton
                    icon="printer"
                    onPress={handlePrintWithdrawalsHistory}
                    disabled={withdrawalsLoading || printingWithdrawalsHistory}
                    loading={printingWithdrawalsHistory}
                  />
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Button
                    mode="outlined"
                    onPress={() => {
                      if (Platform.OS === 'web') {
                        openWebDateDialog('withdrawalsStart', withdrawalsStartDate);
                      } else {
                        setShowWithdrawalsStartPicker(true);
                      }
                    }}
                    style={{ flex: 1, marginRight: 8 }}
                  >
                    {withdrawalsStartDate ? withdrawalsStartDate.toLocaleDateString('id-ID') : 'Mulai'}
                  </Button>
                  <Button
                    mode="outlined"
                    onPress={() => {
                      if (Platform.OS === 'web') {
                        openWebDateDialog('withdrawalsEnd', withdrawalsEndDate);
                      } else {
                        setShowWithdrawalsEndPicker(true);
                      }
                    }}
                    style={{ flex: 1 }}
                  >
                    {withdrawalsEndDate ? withdrawalsEndDate.toLocaleDateString('id-ID') : 'Sampai'}
                  </Button>
                  <IconButton
                    icon="close"
                    onPress={() => {
                      setWithdrawalsStartDate(null);
                      setWithdrawalsEndDate(null);
                    }}
                  />
                </View>

                <SegmentedButtons
                  value={withdrawalsStatusFilter}
                  onValueChange={(v) => setWithdrawalsStatusFilter(v as any)}
                  buttons={[
                    { value: 'all', label: 'Semua' },
                    { value: 'completed', label: 'Selesai' },
                    { value: 'void', label: 'Void' }
                  ]}
                  style={{ marginTop: 10 }}
                />

                {showWithdrawalsStartPicker ? (
                  <DateTimePicker
                    value={withdrawalsStartDate || new Date()}
                    mode="date"
                    onChange={(_e, d) => {
                      setShowWithdrawalsStartPicker(false);
                      if (d) {
                        const next = new Date(d);
                        next.setHours(0, 0, 0, 0);
                        setWithdrawalsStartDate(next);
                      }
                    }}
                  />
                ) : null}

                {showWithdrawalsEndPicker ? (
                  <DateTimePicker
                    value={withdrawalsEndDate || new Date()}
                    mode="date"
                    onChange={(_e, d) => {
                      setShowWithdrawalsEndPicker(false);
                      if (d) {
                        const next = new Date(d);
                        next.setHours(23, 59, 59, 999);
                        setWithdrawalsEndDate(next);
                      }
                    }}
                  />
                ) : null}
              </Card.Content>
            </Card>

            {withdrawalsLoading && withdrawals.length === 0 ? (
              <ActivityIndicator animating={true} style={{ marginTop: 20 }} />
            ) : (withdrawalsStatusFilter === 'all'
                ? withdrawals
                : withdrawals.filter((w) => (w.status || 'completed') === withdrawalsStatusFilter)
              ).length === 0 ? (
              <Text style={{ textAlign: 'center', color: '#B0BEC5', marginTop: 20 }}>
                Belum ada history penarikan.
              </Text>
            ) : (
              (withdrawalsStatusFilter === 'all'
                ? withdrawals
                : withdrawals.filter((w) => (w.status || 'completed') === withdrawalsStatusFilter)
              ).map((w) => {
                const dateStr =
                  w.createdAt?.toDate?.()?.toLocaleString('id-ID') ||
                  new Date().toLocaleString('id-ID');
                return (
                  <Card key={w.id} style={{ marginBottom: 12 }} mode="elevated">
                    <Card.Content>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <View style={{ flex: 1, paddingRight: 12 }}>
                          <Text variant="titleMedium">{w.employeeName || w.employeeId}</Text>
                          <Text variant="bodySmall" style={{ color: '#757575' }}>{dateStr}</Text>
                          {!!w.notes && <Text variant="bodySmall" style={{ color: '#757575' }}>{w.notes}</Text>}
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text variant="titleMedium" style={{ color: '#E53935', fontWeight: 'bold' }}>
                            - {formatCurrency(w.amount || 0)}
                          </Text>
                          <Chip style={{ marginTop: 6, backgroundColor: '#E5393520' }} textStyle={{ color: '#E53935' }}>
                            {w.status || 'completed'}
                          </Chip>
                          <IconButton
                            icon="printer"
                            onPress={() => handlePrintReceipt(w)}
                            disabled={printingId === w.id}
                            loading={printingId === w.id}
                            style={{ marginTop: 4 }}
                          />
                        </View>
                      </View>
                    </Card.Content>
                  </Card>
                );
              })
            )}

            {viewMode === 'withdrawals' && withdrawalsHasMore ? (
              <Button
                mode="outlined"
                onPress={() => loadWithdrawals({ reset: false })}
                loading={withdrawalsLoading}
                disabled={withdrawalsLoading}
                style={{ marginTop: 4 }}
              >
                Muat Lagi
              </Button>
            ) : null}
          </>
        ) : (
          <>
            <Card style={{ marginBottom: 12 }} mode="elevated">
              <Card.Content>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Menu
                    visible={profitSharesEmployeeMenuOpen}
                    onDismiss={() => setProfitSharesEmployeeMenuOpen(false)}
                    anchor={
                      <Button
                        mode="outlined"
                        onPress={() => setProfitSharesEmployeeMenuOpen(true)}
                        style={{ flex: 1, marginRight: 8 }}
                      >
                        {getEmployeeName(profitSharesEmployeeFilter)}
                      </Button>
                    }
                  >
                    <Menu.Item
                      onPress={() => {
                        setProfitSharesEmployeeFilter(null);
                        setProfitSharesEmployeeMenuOpen(false);
                      }}
                      title="Semua Karyawan"
                    />
                    <Divider />
                    {employees.map((e) => (
                      <Menu.Item
                        key={e.uid}
                        onPress={() => {
                          setProfitSharesEmployeeFilter(e.uid);
                          setProfitSharesEmployeeMenuOpen(false);
                        }}
                        title={e.name || e.email || e.uid}
                      />
                    ))}
                  </Menu>

                  <IconButton
                    icon="refresh"
                    onPress={() => loadProfitShares({ reset: true })}
                    disabled={profitSharesLoading}
                  />
                  <IconButton
                    icon="printer"
                    onPress={handlePrintProfitSharesHistory}
                    disabled={profitSharesLoading || printingProfitSharesHistory}
                    loading={printingProfitSharesHistory}
                  />
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Button
                    mode="outlined"
                    onPress={() => {
                      if (Platform.OS === 'web') {
                        openWebDateDialog('profitSharesStart', profitSharesStartDate);
                      } else {
                        setShowProfitSharesStartPicker(true);
                      }
                    }}
                    style={{ flex: 1, marginRight: 8 }}
                  >
                    {profitSharesStartDate ? profitSharesStartDate.toLocaleDateString('id-ID') : 'Mulai'}
                  </Button>
                  <Button
                    mode="outlined"
                    onPress={() => {
                      if (Platform.OS === 'web') {
                        openWebDateDialog('profitSharesEnd', profitSharesEndDate);
                      } else {
                        setShowProfitSharesEndPicker(true);
                      }
                    }}
                    style={{ flex: 1 }}
                  >
                    {profitSharesEndDate ? profitSharesEndDate.toLocaleDateString('id-ID') : 'Sampai'}
                  </Button>
                  <IconButton
                    icon="close"
                    onPress={() => {
                      setProfitSharesStartDate(null);
                      setProfitSharesEndDate(null);
                    }}
                  />
                </View>

                <SegmentedButtons
                  value={profitSharesStatusFilter}
                  onValueChange={(v) => setProfitSharesStatusFilter(v as any)}
                  buttons={[
                    { value: 'all', label: 'Semua' },
                    { value: 'earned', label: 'Earned' },
                    { value: 'paid', label: 'Paid' },
                    { value: 'void', label: 'Void' }
                  ]}
                  style={{ marginTop: 10 }}
                />

                {showProfitSharesStartPicker ? (
                  <DateTimePicker
                    value={profitSharesStartDate || new Date()}
                    mode="date"
                    onChange={(_e, d) => {
                      setShowProfitSharesStartPicker(false);
                      if (d) {
                        const next = new Date(d);
                        next.setHours(0, 0, 0, 0);
                        setProfitSharesStartDate(next);
                      }
                    }}
                  />
                ) : null}

                {showProfitSharesEndPicker ? (
                  <DateTimePicker
                    value={profitSharesEndDate || new Date()}
                    mode="date"
                    onChange={(_e, d) => {
                      setShowProfitSharesEndPicker(false);
                      if (d) {
                        const next = new Date(d);
                        next.setHours(23, 59, 59, 999);
                        setProfitSharesEndDate(next);
                      }
                    }}
                  />
                ) : null}
              </Card.Content>
            </Card>

            {profitSharesLoading && profitShares.length === 0 ? (
              <ActivityIndicator animating={true} style={{ marginTop: 20 }} />
            ) : (profitSharesStatusFilter === 'all'
                ? profitShares
                : profitShares.filter((r) => (r.status || 'earned') === profitSharesStatusFilter)
              ).length === 0 ? (
              <Text style={{ textAlign: 'center', color: '#B0BEC5', marginTop: 20 }}>
                Belum ada riwayat setoran.
              </Text>
            ) : (
              (profitSharesStatusFilter === 'all'
                ? profitShares
                : profitShares.filter((r) => (r.status || 'earned') === profitSharesStatusFilter)
              ).map((r) => {
                const dt = r.createdAt?.toDate?.() || (r.createdAt instanceof Date ? r.createdAt : new Date());
                const dateStr = dt.toLocaleString('id-ID');
                const employeeName = r.collectorName || getEmployeeName(r.collectorId);
                return (
                  <Card key={r.id} style={{ marginBottom: 12 }} mode="elevated">
                    <Card.Content>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <View style={{ flex: 1, paddingRight: 12 }}>
                          <Text variant="titleMedium">{r.customerName || r.customerId}</Text>
                          <Text variant="bodySmall" style={{ color: '#757575' }}>
                            {employeeName} • {dateStr}
                          </Text>
                          {!!r.notes && <Text variant="bodySmall" style={{ color: '#757575' }}>{r.notes}</Text>}
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                            <Chip style={{ marginRight: 8, marginBottom: 8, backgroundColor: '#E3F2FD' }}>
                              Setoran: {formatCurrency(r.paymentAmount || 0)}
                            </Chip>
                            <Chip style={{ marginRight: 8, marginBottom: 8, backgroundColor: '#E8F5E9' }}>
                              Komisi: {formatCurrency(r.profitShareAmount || 0)}
                            </Chip>
                            <Chip style={{ marginRight: 8, marginBottom: 8, backgroundColor: '#F3E5F5' }}>
                              {typeof r.percentage === 'number' ? r.percentage : 0}%
                            </Chip>
                          </View>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Chip style={{ marginTop: 2, backgroundColor: '#EEEEEE' }}>
                            {r.status || 'earned'}
                          </Chip>
                        </View>
                      </View>
                    </Card.Content>
                  </Card>
                );
              })
            )}

            {viewMode === 'profitShare' && profitSharesHasMore ? (
              <Button
                mode="outlined"
                onPress={() => loadProfitShares({ reset: false })}
                loading={profitSharesLoading}
                disabled={profitSharesLoading}
                style={{ marginTop: 4 }}
              >
                Muat Lagi
              </Button>
            ) : null}
          </>
        )}
      </ScrollView>

      {/* Dialog Edit Karyawan */}
      <Portal>
        <Dialog visible={visible} onDismiss={() => setVisible(false)}>
          <Dialog.Title>Edit Karyawan: {selectedEmployee?.name}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Presentase Bagi Hasil (0-100)"
              value={profitSharePercentage}
              onChangeText={setProfitSharePercentage}
              keyboardType="numeric"
              style={{ marginBottom: 10 }}
              right={<TextInput.Affix text="%" />}
            />
            <TextInput
              label="Target Penagihan"
              value={target}
              onChangeText={setTarget}
              keyboardType="numeric"
              style={{ marginBottom: 10 }}
            />
            <TextInput
              label="Bonus Terkumpul"
              value={bonus}
              onChangeText={setBonus}
              keyboardType="numeric"
              style={{ marginBottom: 10 }}
            />
            <TextInput
              label="Piutang Internal (Kasbon)"
              value={internalDebt}
              onChangeText={setInternalDebt}
              keyboardType="numeric"
            />
            <Divider style={{ marginVertical: 12 }} />
            <TextInput
              label="Nominal Penarikan Bonus"
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
              keyboardType="numeric"
              style={{ marginBottom: 10 }}
            />
            <TextInput
              label="Catatan Penarikan (Opsional)"
              value={withdrawNotes}
              onChangeText={setWithdrawNotes}
              style={{ marginBottom: 10 }}
            />
            <Button mode="contained-tonal" onPress={handleWithdraw} loading={withdrawing} disabled={withdrawing}>
              Proses Penarikan
            </Button>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setVisible(false)} disabled={savingEdit}>Batal</Button>
            <Button onPress={handleSave} loading={savingEdit}>Simpan</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog visible={webDateDialog.visible} onDismiss={closeWebDateDialog}>
          <Dialog.Title>Pilih Tanggal</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Tanggal"
              value={webDateDialog.value}
              onChangeText={(v) => setWebDateDialog((prev) => ({ ...prev, value: v }))}
              autoCapitalize="none"
              placeholder="YYYY-MM-DD"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeWebDateDialog}>Batal</Button>
            <Button onPress={confirmWebDateDialog}>OK</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Dialog Tambah Karyawan */}
      <Portal>
        <Dialog visible={addVisible} onDismiss={() => setAddVisible(false)}>
          <Dialog.Title>Tambah Karyawan Baru</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Nama Lengkap"
              value={newName}
              onChangeText={setNewName}
              style={{ marginBottom: 10 }}
            />
            <TextInput
              label="Email"
              value={newEmail}
              onChangeText={setNewEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={{ marginBottom: 10 }}
            />
            <TextInput
              label="Password"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAddVisible(false)}>Batal</Button>
            {loadingAdd ? (
              <ActivityIndicator animating={true} style={{ padding: 10 }} />
            ) : (
              <Button onPress={handleAddEmployee}>Buat Akun</Button>
            )}
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <FAB
        icon="plus"
        style={{
          position: 'absolute',
          margin: 16,
          right: 0,
          bottom: 0,
          backgroundColor: '#00E676'
        }}
        onPress={() => setAddVisible(true)}
      />
    </View>
  );
}
