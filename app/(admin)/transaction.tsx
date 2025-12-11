import React, { useEffect, useState } from 'react';
import { ScrollView, View, Alert, TouchableOpacity } from 'react-native';
import { Appbar, Text, TextInput, Button, Card, Divider, Portal, Dialog, Searchbar, SegmentedButtons, ActivityIndicator } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getAllCustomers, processTransaction, getCustomerTransactions, CustomerData, Transaction } from '../../src/services/firestore';
import { useAuthStore } from '../../src/store/authStore';

// Helper function
const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
};

// --- Sub-components ---

interface TransactionHistoryListProps {
  transactions: Transaction[];
  loading: boolean;
}

const TransactionHistoryList: React.FC<TransactionHistoryListProps> = ({ transactions, loading }) => {
  if (loading) {
    return (
      <View>
        <Text variant="titleSmall" style={{ marginBottom: 8, color: '#666' }}>Riwayat Terakhir:</Text>
        <ActivityIndicator size="small" />
      </View>
    );
  }

  return (
    <View>
      <Text variant="titleSmall" style={{ marginBottom: 8, color: '#666' }}>Riwayat Terakhir:</Text>
      {transactions.length > 0 ? (
        transactions.slice(0, 3).map((tx, idx) => (
          <View key={tx.id || idx} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text variant="bodySmall" style={{ color: '#888' }}>
              {tx.createdAt?.toDate ? tx.createdAt.toDate().toLocaleDateString('id-ID') : 'Baru saja'}
            </Text>
            <Text variant="bodySmall" style={{ color: tx.type === 'credit' ? '#D32F2F' : '#388E3C', fontWeight: 'bold' }}>
              {tx.type === 'credit' ? '+' : '-'}{formatCurrency(tx.amount)}
            </Text>
          </View>
        ))
      ) : (
        <Text variant="bodySmall" style={{ fontStyle: 'italic', color: '#999' }}>Belum ada riwayat transaksi</Text>
      )}
    </View>
  );
};

interface CustomerDetailViewProps {
  customer: CustomerData;
  onChange: () => void;
  loadingHistory: boolean;
  lastTransactions: Transaction[];
}

const CustomerDetailView: React.FC<CustomerDetailViewProps> = ({ 
  customer, 
  onChange, 
  loadingHistory, 
  lastTransactions 
}) => {
  return (
    <View>
      <View>
        <Text variant="headlineSmall" style={{ color: '#1E88E5', fontWeight: 'bold' }}>{customer.name}</Text>
        <Text variant="bodyMedium">Email: {customer.email}</Text>
        <Text variant="bodyMedium">Limit Kredit: {formatCurrency(customer.creditLimit)}</Text>
        <Text variant="bodyMedium" style={{ color: customer.currentDebt > 0 ? '#F44336' : '#4CAF50' }}>
          Utang Saat Ini: {formatCurrency(customer.currentDebt)}
        </Text>
      </View>

      <Button mode="text" onPress={onChange} style={{ marginTop: 10 }}>
        Ganti Nasabah
      </Button>

      <Divider style={{ marginVertical: 15 }} />

      <TransactionHistoryList transactions={lastTransactions} loading={loadingHistory} />
    </View>
  );
};

interface EstimationViewProps {
  customer: CustomerData;
  amount: string;
  mode: string;
}

const EstimationView: React.FC<EstimationViewProps> = ({ customer, amount, mode }) => {
  const parsedAmount = parseInt(amount);
  if (!customer || !amount || isNaN(parsedAmount) || parsedAmount <= 0) {
    return null;
  }

  const isCredit = mode === 'credit';
  const newDebt = isCredit 
    ? (customer.currentDebt || 0) + parsedAmount
    : (customer.currentDebt || 0) - parsedAmount;
  
  const isLimitExceeded = isCredit && (customer.creditLimit || 0) > 0 && newDebt > (customer.creditLimit || 0);
  const remainingLimit = (customer.creditLimit || 0) - newDebt;

  return (
    <View style={{ marginBottom: 20, paddingHorizontal: 5 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
        <Text variant="bodySmall" style={{ color: '#666' }}>
          {isCredit ? 'Estimasi Total Utang Baru: ' : 'Estimasi Sisa Utang: '}
        </Text>
        <Text variant="bodySmall" style={{ fontWeight: 'bold', color: isCredit ? '#D32F2F' : '#388E3C' }}>
          {formatCurrency(newDebt)}
        </Text>
      </View>
      {isCredit && (customer.creditLimit || 0) > 0 && (
        <View style={{ marginTop: 4 }}>
          <Text variant="bodySmall" style={{ color: isLimitExceeded ? '#D32F2F' : '#666' }}>
            Sisa Limit: {formatCurrency(remainingLimit)}
          </Text>
        </View>
      )}
    </View>
  );
};

// --- Main Component ---

export default function TransactionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuthStore();
  
  const [mode, setMode] = useState<string>((params.mode as string) || 'credit'); // 'credit' | 'payment'
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);
  const [lastTransactions, setLastTransactions] = useState<Transaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Form State
  const [amount, setAmount] = useState('');
  const [displayAmount, setDisplayAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Customer Selector Dialog
  const [dialogVisible, setDialogVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog States
  const [successVisible, setSuccessVisible] = useState(false);
  const [errorVisible, setErrorVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorTitle, setErrorTitle] = useState('Gagal');
  const [errorIcon, setErrorIcon] = useState('alert-circle');
  const [errorColor, setErrorColor] = useState('#D32F2F');

  useEffect(() => {
    console.log('TransactionScreen mounted/rendered');
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const data = await getAllCustomers();
      setCustomers(data);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Gagal memuat data nasabah');
    }
  };

  const handleAmountChange = (text: string) => {
    const clean = text.replace(/[^0-9]/g, '');
    setAmount(clean);
    
    if (clean) {
      const parsed = parseInt(clean);
      setDisplayAmount(new Intl.NumberFormat('id-ID').format(parsed));
    } else {
      setDisplayAmount('');
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectCustomer = async (customer: CustomerData) => {
    setSelectedCustomer(customer);
    setDialogVisible(false);
    
    // Reset history state
    setLastTransactions([]);
    setLoadingHistory(true);
    
    try {
      const history = await getCustomerTransactions(customer.uid);
      setLastTransactions(history);
    } catch (error) {
      console.warn('Failed to load history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const showError = (title: string, message: string, icon: string = 'alert-circle', color: string = '#D32F2F') => {
    setErrorTitle(title);
    setErrorMessage(message);
    setErrorIcon(icon);
    setErrorColor(color);
    setErrorVisible(true);
  };

  const handleSubmit = async () => {
    console.log('handleSubmit triggered');
    
    if (!selectedCustomer) {
      showError('Pilih Nasabah', 'Silakan pilih nasabah terlebih dahulu sebelum menyimpan transaksi.', 'account-alert');
      return;
    }
    
    const parsedAmount = parseInt(amount);
    
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      showError('Jumlah Tidak Valid', 'Masukkan jumlah uang yang valid (hanya angka dan lebih dari 0).', 'numeric-off');
      return;
    }

    // Client-side validation for credit limit
    if (mode === 'credit') {
      const currentDebt = selectedCustomer.currentDebt || 0;
      const creditLimit = selectedCustomer.creditLimit || 0;
      
      if (creditLimit > 0 && (currentDebt + parsedAmount) > creditLimit) {
        showError(
          'Limit Kredit Terlampaui', 
          `Transaksi ditolak karena total utang akan melebihi limit yang ditentukan.\n\n` +
          `• Limit Kredit: ${formatCurrency(creditLimit)}\n` +
          `• Utang Saat Ini: ${formatCurrency(currentDebt)}\n` +
          `• Sisa Limit: ${formatCurrency(creditLimit - currentDebt)}\n` +
          `• Pengajuan: ${formatCurrency(parsedAmount)}`,
          'hand-coin',
          '#C62828'
        );
        return;
      }
    }

    if (!user?.id) {
      showError('Sesi Berakhir', 'Sesi login Anda tidak valid. Silakan logout dan login kembali.', 'account-key');
      return;
    }

    setLoading(true);
    try {
      const txId = await processTransaction({
        customerId: selectedCustomer.uid,
        amount: parsedAmount,
        type: mode as 'credit' | 'payment',
        description: description || (mode === 'credit' ? 'Tambah Kredit' : 'Pembayaran Utang'),
        employeeId: user.id
      });

      // Update local state
      if (selectedCustomer) {
        const newDebt = mode === 'credit' 
          ? (selectedCustomer.currentDebt || 0) + parsedAmount
          : (selectedCustomer.currentDebt || 0) - parsedAmount;
          
        setSelectedCustomer({
          ...selectedCustomer,
          currentDebt: newDebt
        });

        setCustomers(prev => prev.map(c => 
          c.uid === selectedCustomer.uid 
            ? { ...c, currentDebt: newDebt }
            : c
        ));

        const newTx: Transaction = {
          id: txId,
          customerId: selectedCustomer.uid,
          amount: parsedAmount,
          type: mode as 'credit' | 'payment',
          description: description || (mode === 'credit' ? 'Tambah Kredit' : 'Pembayaran Utang'),
          createdAt: { toDate: () => new Date() },
          employeeId: user.id
        };
        setLastTransactions(prev => [newTx, ...prev]);
      }

      setAmount('');
      setDisplayAmount('');
      setDescription('');
      
      setLoading(false);
      setSuccessVisible(true);

    } catch (error: any) {
      setLoading(false);
      if (error.message?.includes('Melebihi limit kredit')) {
        showError('Limit Kredit Terlampaui', error.message, 'hand-coin', '#C62828');
      } else {
        showError('Transaksi Gagal', `Terjadi kesalahan: ${error.message}`, 'wifi-off');
      }
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F2' }}>
      <Appbar.Header style={{ backgroundColor: '#fff', elevation: 2 }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={mode === 'credit' ? 'Tambah Kredit' : 'Input Pembayaran'} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <SegmentedButtons
          value={mode}
          onValueChange={setMode}
          buttons={[
            { value: 'credit', label: 'Tambah Utang', icon: 'plus-circle' },
            { value: 'payment', label: 'Bayar Utang', icon: 'cash-check' },
          ]}
          style={{ marginBottom: 20 }}
        />

        <Card style={{ marginBottom: 20, backgroundColor: 'white' }} mode="outlined">
          <Card.Content>
            <Text variant="titleMedium" style={{ marginBottom: 10 }}>Pilih Nasabah</Text>
            <View>
              {selectedCustomer ? (
                <CustomerDetailView 
                  customer={selectedCustomer} 
                  onChange={() => setDialogVisible(true)}
                  loadingHistory={loadingHistory}
                  lastTransactions={lastTransactions}
                />
              ) : (
                <Button mode="outlined" onPress={() => setDialogVisible(true)} icon="magnify">
                  Cari Nasabah
                </Button>
              )}
            </View>
          </Card.Content>
        </Card>

        <TextInput
          label="Jumlah (Rp)"
          value={displayAmount}
          onChangeText={handleAmountChange}
          keyboardType="number-pad"
          style={{ marginBottom: 5, backgroundColor: 'white' }}
          mode="outlined"
          left={<TextInput.Icon icon="cash" />}
        />
        
        {selectedCustomer && (
          <EstimationView customer={selectedCustomer} amount={amount} mode={mode} />
        )}

        <TextInput
          label="Keterangan (Opsional)"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          style={{ marginBottom: 20, backgroundColor: 'white' }}
          mode="outlined"
        />

        <Button 
          mode="contained" 
          onPress={handleSubmit} 
          loading={loading}
          disabled={loading}
          style={{ paddingVertical: 5, borderRadius: 8, backgroundColor: mode === 'credit' ? '#D32F2F' : '#388E3C' }}
        >
          {mode === 'credit' ? 'Simpan Kredit Baru' : 'Simpan Pembayaran'}
        </Button>
      </ScrollView>

      {/* Customer Selection Dialog */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)} style={{ maxHeight: '80%' }}>
          <Dialog.Title>Cari Nasabah</Dialog.Title>
          <Dialog.Content>
            <Searchbar
              placeholder="Cari nama atau email..."
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={{ marginBottom: 10, backgroundColor: '#f5f5f5' }}
            />
            <ScrollView style={{ maxHeight: 300 }}>
              {filteredCustomers.map((c) => (
                <TouchableOpacity key={c.uid} onPress={() => handleSelectCustomer(c)}>
                  <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
                    <Text variant="titleMedium">{c.name}</Text>
                    <Text variant="bodySmall" style={{ color: '#757575' }}>{c.email}</Text>
                    <Text variant="bodySmall" style={{ color: c.currentDebt > 0 ? '#F44336' : '#4CAF50' }}>
                      Utang: {formatCurrency(c.currentDebt)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
              {filteredCustomers.length === 0 && (
                <Text style={{ textAlign: 'center', padding: 20, color: '#999' }}>Tidak ditemukan</Text>
              )}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Batal</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Success Dialog */}
      <Portal>
        <Dialog visible={successVisible} onDismiss={() => setSuccessVisible(false)} dismissable={false}>
          <Dialog.Icon icon="check-circle" size={50} color="#4CAF50" />
          <Dialog.Title style={{ textAlign: 'center' }}>Transaksi Berhasil</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ textAlign: 'center' }}>
              Data transaksi telah berhasil disimpan ke database. Saldo nasabah telah diperbarui.
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={{ justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 20 }}>
            <Button onPress={() => router.back()} mode="outlined" textColor="#757575">
              Kembali
            </Button>
            <Button onPress={() => setSuccessVisible(false)} mode="contained" buttonColor="#4CAF50">
              Transaksi Baru
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Error/Warning Dialog */}
      <Portal>
        <Dialog visible={errorVisible} onDismiss={() => setErrorVisible(false)}>
          <Dialog.Icon icon={errorIcon} size={50} color={errorColor} />
          <Dialog.Title style={{ textAlign: 'center', color: errorColor }}>{errorTitle}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ textAlign: 'center' }}>{errorMessage}</Text>
          </Dialog.Content>
          <Dialog.Actions style={{ justifyContent: 'center', paddingBottom: 20 }}>
            <Button onPress={() => setErrorVisible(false)} mode="contained" buttonColor={errorColor} style={{ minWidth: 100 }}>
              Mengerti
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}
