import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, Button, Card, Avatar, ActivityIndicator, HelperText, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../../src/store/authStore';
import { processPayment } from '../../../src/services/transactionService';
import { searchCustomers, getCustomers } from '../../../src/services/customerService';
import { Customer } from '../../../src/types';
import { isOnline, enqueue } from '../../../src/services/offline';

export default function CreatePaymentScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuthStore();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  // Initial load
  useEffect(() => {
    loadInitialCustomers();
  }, []);

  const loadInitialCustomers = async () => {
    try {
      const data = await getCustomers(5);
      setCustomers(data);
    } catch (error) {
      console.error(error);
    }
  };

  // Search Logic
  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (text.length > 1) {
      setSearching(true);
      try {
        const results = await searchCustomers(text);
        setCustomers(results);
      } catch (error) {
        console.error(error);
      } finally {
        setSearching(false);
      }
    } else if (text.length === 0) {
      loadInitialCustomers();
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setSearchQuery(''); // Clear search visual clutter
    setCustomers([]); // Hide list
  };

  const handleSubmit = async () => {
    if (!selectedCustomer) {
      Alert.alert('Error', 'Silakan pilih nasabah terlebih dahulu.');
      return;
    }

    const numericAmount = parseInt(amount.replace(/[^0-9]/g, ''), 10);
    if (!numericAmount || numericAmount <= 0) {
      Alert.alert('Error', 'Masukkan jumlah setoran yang valid.');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'Sesi anda telah berakhir. Silakan login ulang.');
      return;
    }

    setLoading(true);
    try {
      if (isOnline()) {
        await processPayment({
          customerId: selectedCustomer.id,
          customerName: selectedCustomer.name,
          amount: numericAmount,
          notes: notes,
          collectorId: user.id,
          collectorName: user.name
        });
        Alert.alert('Sukses', 'Setoran berhasil dicatat!', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        await enqueue({
          type: 'payment',
          priority: 'critical',
          maxSize: 20000,
          format: 'json',
          data: {
            customerId: selectedCustomer.id,
            customerName: selectedCustomer.name,
            amount: numericAmount,
            notes: notes,
            collectorId: user.id,
            collectorName: user.name
          },
          metadata: { userId: user.id, sensitive: true }
        });
        Alert.alert('Offline', 'Tidak ada koneksi. Data setoran disimpan sementara dan akan disinkronkan otomatis.');
        router.back();
      }
    } catch (error: any) {
      Alert.alert('Gagal', error.message || 'Terjadi kesalahan saat menyimpan data.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: string) => {
    const number = parseInt(value.replace(/[^0-9]/g, ''), 10);
    if (isNaN(number)) return '';
    return 'Rp ' + number.toLocaleString('id-ID');
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text variant="headlineMedium" style={styles.title}>Catat Setoran</Text>

        {/* Step 1: Select Customer */}
        {!selectedCustomer ? (
          <View style={styles.section}>
            <TextInput
              mode="outlined"
              label="Cari Nasabah"
              placeholder="Ketik nama nasabah..."
              value={searchQuery}
              onChangeText={handleSearch}
              left={<TextInput.Icon icon="magnify" />}
              style={styles.input}
            />
            {searching && <ActivityIndicator style={{ marginTop: 10 }} />}
            
            <View style={styles.listContainer}>
              {customers.map((customer) => (
                <Card 
                  key={customer.id} 
                  style={styles.customerCard} 
                  onPress={() => handleSelectCustomer(customer)}
                >
                  <Card.Title
                    title={customer.name}
                    subtitle={customer.address}
                    left={(props) => <Avatar.Icon {...props} icon="account" size={40} />}
                    right={(props) => (
                      <View style={{ paddingRight: 16 }}>
                         <Text variant="labelSmall">Hutang:</Text>
                         <Text variant="bodyMedium" style={{ color: theme.colors.error }}>
                           Rp {(customer.totalDebt || 0).toLocaleString('id-ID')}
                         </Text>
                      </View>
                    )}
                  />
                </Card>
              ))}
              {customers.length === 0 && searchQuery.length > 1 && !searching && (
                <Text style={{ textAlign: 'center', marginTop: 20, color: '#666' }}>
                  Tidak ditemukan nasabah dengan nama tersebut.
                </Text>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.section}>
             <Card style={styles.selectedCard}>
                <Card.Content>
                  <View style={styles.rowBetween}>
                    <Text variant="titleMedium">Nasabah Terpilih</Text>
                    <Button compact onPress={() => setSelectedCustomer(null)}>Ganti</Button>
                  </View>
                  <Text variant="headlineSmall" style={{ marginTop: 8 }}>{selectedCustomer.name}</Text>
                  <Text variant="bodyMedium" style={{ color: '#666' }}>{selectedCustomer.address}</Text>
                  
                  <View style={styles.debtInfo}>
                    <Text variant="labelMedium">Total Hutang Saat Ini</Text>
                    <Text variant="headlineMedium" style={{ color: theme.colors.error, fontWeight: 'bold' }}>
                      Rp {(selectedCustomer.totalDebt || 0).toLocaleString('id-ID')}
                    </Text>
                  </View>
                </Card.Content>
             </Card>

             {/* Step 2: Input Amount */}
             <TextInput
                mode="outlined"
                label="Jumlah Setoran (Rp)"
                value={amount}
                onChangeText={(text) => {
                  // Allow only numbers
                  const clean = text.replace(/[^0-9]/g, '');
                  if (clean) {
                    setAmount(parseInt(clean).toLocaleString('id-ID'));
                  } else {
                    setAmount('');
                  }
                }}
                keyboardType="numeric"
                style={styles.input}
                left={<TextInput.Affix text="Rp " />}
             />
             <HelperText type="info">
               Masukkan nominal uang yang diterima.
             </HelperText>

             <TextInput
                mode="outlined"
                label="Catatan (Opsional)"
                placeholder="Contoh: Angsuran ke-3, Titipan tetangga, dll"
                value={notes}
                onChangeText={setNotes}
                style={styles.input}
                multiline
             />

             <Button 
                mode="contained" 
                onPress={handleSubmit} 
                loading={loading}
                disabled={loading || !amount}
                style={styles.submitButton}
                contentStyle={{ height: 48 }}
             >
                Simpan Setoran
             </Button>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: '#F5F5F5',
    flexGrow: 1,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  section: {
    marginBottom: 20,
  },
  input: {
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  listContainer: {
    marginTop: 10,
  },
  customerCard: {
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  selectedCard: {
    marginBottom: 20,
    backgroundColor: '#fff',
    borderLeftWidth: 4,
    borderLeftColor: '#6200ee', // Primary color
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  debtInfo: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButton: {
    marginTop: 20,
  }
});
