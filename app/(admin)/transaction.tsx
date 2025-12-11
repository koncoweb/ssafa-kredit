import React, { useEffect, useState } from 'react';
import { ScrollView, View, Alert, TouchableOpacity } from 'react-native';
import { Appbar, Text, TextInput, Button, Card, Divider, Portal, Dialog, Searchbar, RadioButton, SegmentedButtons, ActivityIndicator } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
// import { GradientBackground } from '../../src/components/GradientBackground'; // Removed dark background
import { getAllCustomers, processTransaction, getCustomerTransactions, CustomerData, Transaction } from '../../src/services/firestore';
import { useAuthStore } from '../../src/store/authStore';

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

  console.log('Render TransactionScreen. Loading:', loading, 'DialogVisible:', dialogVisible);

  const loadCustomers = async () => {
    try {
      const data = await getAllCustomers();
      setCustomers(data);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Gagal memuat data nasabah');
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
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
    console.log('Amount:', amount, 'Parsed:', parsedAmount);

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
      console.log('User session missing');
      showError('Sesi Berakhir', 'Sesi login Anda tidak valid. Silakan logout dan login kembali.', 'account-key');
      return;
    }

    setLoading(true);
    try {
      console.log('Calling processTransaction...');
      const txId = await processTransaction({
        customerId: selectedCustomer.uid,
        amount: parsedAmount,
        type: mode as 'credit' | 'payment',
        description: description || (mode === 'credit' ? 'Tambah Kredit' : 'Pembayaran Utang'),
        employeeId: user.id
      });
      console.log('processTransaction finished, ID:', txId);

      // Update local state to reflect changes immediately
      if (selectedCustomer) {
        const newDebt = mode === 'credit' 
          ? (selectedCustomer.currentDebt || 0) + parsedAmount
          : (selectedCustomer.currentDebt || 0) - parsedAmount;
          
        setSelectedCustomer({
          ...selectedCustomer,
          currentDebt: newDebt
        });

        // Update in the customers list as well so if they search again it's updated
        setCustomers(prev => prev.map(c => 
          c.uid === selectedCustomer.uid 
            ? { ...c, currentDebt: newDebt }
            : c
        ));

        // Update Last Transactions History locally
        const newTx: Transaction = {
          id: txId,
          customerId: selectedCustomer.uid,
          amount: parsedAmount,
          type: mode as 'credit' | 'payment',
          description: description || (mode === 'credit' ? 'Tambah Kredit' : 'Pembayaran Utang'),
          createdAt: { toDate: () => new Date() }, // Mock timestamp for immediate display
          employeeId: user.id
        };
        setLastTransactions(prev => [newTx, ...prev]);
      }

      // Reset form
      setAmount('');
      setDisplayAmount('');
      setDescription('');

      console.log('Transaction completed successfully in Firestore. ID:', txId);
      
      // Stop loading immediately
      setLoading(false);

      // Show Success Dialog
      setSuccessVisible(true);

    } catch (error: any) {
      console.error('Transaction failed with error:', error);
      setLoading(false); // Stop loading on error
      
      if (error.message?.includes('Melebihi limit kredit')) {
        showError(
          'Limit Kredit Terlampaui',
          error.message,
          'hand-coin',
          '#C62828'
        );
      } else {
        showError(
          'Transaksi Gagal', 
          `Terjadi kesalahan saat menyimpan data:\n${error.message}\n\nPastikan koneksi internet lancar dan Anda memiliki izin akses.`,
          'wifi-off'
        );
      }
    }
    // Remove finally block to avoid redundant state updates if handled above, 
    // or keep it just for safety but ensure logic flow is correct.
    // In this case, we handled setLoading(false) in both try and catch blocks explicitly.
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
                <View>
                  <View>
                    <Text variant="headlineSmall" style={{ color: '#1E88E5', fontWeight: 'bold' }}>
                      {selectedCustomer.name}
                    </Text>
                    <Text variant="bodyMedium">
                      Email: {selectedCustomer.email}
                    </Text>
                    <Text variant="bodyMedium">
                      Limit Kredit: {formatCurrency(selectedCustomer.creditLimit)}
                    </Text>
                    <Text variant="bodyMedium" style={{ color: selectedCustomer.currentDebt > 0 ? '#F44336' : '#4CAF50' }}>
                      Utang Saat Ini: {formatCurrency(selectedCustomer.currentDebt)}
                    </Text>
                  </View>

                  <Button mode="text" onPress={() => setDialogVisible(true)} style={{ marginTop: 10 }}>
                    Ganti Nasabah
                  </Button>

                  <View style={{ height: 1, backgroundColor: '#e0e0e0', marginVertical: 15 }} />

                  <View>
                    <Text variant="titleSmall" style={{ marginBottom: 8, color: '#666' }}>
                      Riwayat Terakhir:
                    </Text>
                    {loadingHistory ? (
                      <ActivityIndicator size="small" />
                    ) : (
                      <View>
                        {lastTransactions.length > 0 ? (
                          lastTransactions.slice(0, 3).map((tx, idx) => (
                            <View key={tx.id || idx} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                              <Text variant="bodySmall" style={{ color: '#888' }}>
                                {tx.createdAt?.toDate ? tx.createdAt.toDate().toLocaleDateString('id-ID') : 'Baru saja'}
                              </Text>
                              <Text variant="bodySmall" style={{ color: tx.type === 'credit' ? '#D32F2F' : '#388E3C', fontWeight: 'bold' }}>
                                {tx.type === 'credit' ? '+' : ''}{tx.type === 'payment' ? '-' : ''}{formatCurrency(tx.amount)}
                              </Text>
                            </View>
                          ))
                        ) : (
                          <Text variant="bodySmall" style={{ fontStyle: 'italic', color: '#999' }}>
                            Belum ada riwayat transaksi
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                </View>
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
        
        <View>
          {selectedCustomer && amount && parseInt(amount) > 0 && (
            <View style={{ marginBottom: 20, paddingHorizontal: 5 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
                <Text variant="bodySmall" style={{ color: '#666' }}>
                  {mode === 'credit' ? 'Estimasi Total Utang Baru: ' : 'Estimasi Sisa Utang: '}
                </Text>
                <Text variant="bodySmall" style={{ fontWeight: 'bold', color: mode === 'credit' ? '#D32F2F' : '#388E3C' }}>
                  {formatCurrency(
                    mode === 'credit' 
                      ? (selectedCustomer.currentDebt || 0) + parseInt(amount)
                      : (selectedCustomer.currentDebt || 0) - parseInt(amount)
                  )}
                </Text>
              </View>
              {mode === 'credit' && (selectedCustomer.creditLimit || 0) > 0 && (
                <View style={{ marginTop: 4 }}>
                  <Text variant="bodySmall" style={{ color: ((selectedCustomer.currentDebt || 0) + parseInt(amount)) > (selectedCustomer.creditLimit || 0) ? '#D32F2F' : '#666' }}>
                    Sisa Limit: {formatCurrency((selectedCustomer.creditLimit || 0) - ((selectedCustomer.currentDebt || 0) + parseInt(amount)))}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

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
          onPress={() => {
            console.log('Button Pressed! Calling handleSubmit...');
            handleSubmit();
          }} 
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
            <Button 
              onPress={() => router.back()} 
              mode="outlined"
              textColor="#757575"
            >
              Kembali
            </Button>
            <Button 
              onPress={() => setSuccessVisible(false)} 
              mode="contained"
              buttonColor="#4CAF50"
            >
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
            <Text variant="bodyMedium" style={{ textAlign: 'center' }}>
              {errorMessage}
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={{ justifyContent: 'center', paddingBottom: 20 }}>
            <Button 
              onPress={() => setErrorVisible(false)} 
              mode="contained"
              buttonColor={errorColor}
              style={{ minWidth: 100 }}
            >
              Mengerti
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}
