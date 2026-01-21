import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Avatar, Button, Card, HelperText, SegmentedButtons, Text, TextInput, useTheme } from 'react-native-paper';
import { getCustomers, searchCustomers } from '../../../src/services/customerService';
import { enqueue, isOnline } from '../../../src/services/offline';
import { generatePaymentReceiptPDF } from '../../../src/services/printService';
import { logImageUploadActivity, processPayment } from '../../../src/services/transactionService';
import { useAuthStore } from '../../../src/store/authStore';
import { Customer } from '../../../src/types';

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
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentProofImage, setPaymentProofImage] = useState<string | null>(null);
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

    if (numericAmount > (selectedCustomer.totalDebt || 0)) {
      Alert.alert('Error', 'Nominal setoran melebihi total hutang nasabah.');
      return;
    }

    const today = new Date();
    const maxDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    if (paymentDate.getTime() > maxDate.getTime()) {
      Alert.alert('Error', 'Tanggal setoran tidak boleh melebihi hari ini.');
      return;
    }

    if (paymentMethod === 'transfer' && !paymentReference.trim() && !paymentProofImage) {
      // Optional: Ask for confirmation if both reference and image are missing for transfer
      // Alert.alert('Error', 'Untuk transfer, isi referensi atau upload bukti transaksi.');
      // return;
      // Change to soft warning if needed, but for now lets make it optional or keep as is.
      // User request: "jadikan pengambilan gambar opsional"
      // Let's assume this validation is too strict. 
      // We will allow saving transfer without proof if user really wants to, but maybe warn them?
      // Or simply remove the blocker.
    }

    if (!user) {
      Alert.alert('Error', 'Sesi anda telah berakhir. Silakan login ulang.');
      return;
    }

    setLoading(true);
    try {
      if (isOnline()) {
        const result = await processPayment({
          customerId: selectedCustomer.id,
          customerName: selectedCustomer.name,
          amount: numericAmount,
          notes: notes,
          collectorId: user.id,
          collectorName: user.name,
          paidAt: paymentDate,
          paymentMethod,
          paymentProofImage: paymentProofImage || null,
          paymentReference: paymentReference.trim() || null,
        });
        try {
          await generatePaymentReceiptPDF({
            receiptNumber: result.receiptNumber,
            createdAt: result.createdAt,
            customerName: result.customerName,
            customerId: result.customerId,
            amount: result.amount,
            paymentMethod,
            collectorName: user.name,
            remainingDebt: result.newDebt,
            notes: notes || ''
          });
        } catch (e: any) {
          Alert.alert('Info', e?.message || 'Pembayaran tersimpan, namun bukti tidak bisa dibuat.');
        }
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
            collectorName: user.name,
            paidAt: paymentDate.getTime(),
            paymentMethod,
            paymentProofImage: paymentProofImage || null,
            paymentReference: paymentReference.trim() || null,
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

  const pickProofImage = async (useCamera: boolean) => {
    if (useCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Izin Ditolak', 'Akses kamera dibutuhkan untuk mengambil bukti transaksi.');
        await logImageUploadActivity({
            uploaderId: user?.id || 'unknown',
            uploaderName: user?.name || 'unknown',
            action: 'error',
            details: 'Camera permission denied'
        });
        return;
      }
      
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0]?.base64) {
        processImageSelection(result.assets[0].base64, 'camera');
      }
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Izin Ditolak', 'Akses galeri dibutuhkan untuk upload bukti transaksi.');
        await logImageUploadActivity({
            uploaderId: user?.id || 'unknown',
            uploaderName: user?.name || 'unknown',
            action: 'error',
            details: 'Gallery permission denied'
        });
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0]?.base64) {
        processImageSelection(result.assets[0].base64, 'gallery');
      }
    }
  };

  const processImageSelection = async (base64: string, source: 'camera' | 'gallery') => {
    const sizeInBytes = base64.length * 0.75;
    const sizeInKB = sizeInBytes / 1024;
    
    if (sizeInKB > 800) {
        Alert.alert(
            'Ukuran Gambar Terlalu Besar', 
            `Ukuran gambar sekitar ${Math.round(sizeInKB)}KB. Batas maksimum adalah 800KB. Silakan ambil ulang dengan pencahayaan lebih baik atau crop lebih kecil.`
        );
        await logImageUploadActivity({
            uploaderId: user?.id || 'unknown',
            uploaderName: user?.name || 'unknown',
            action: 'error',
            details: `Image too large: ${Math.round(sizeInKB)}KB`
        });
        return;
    }

    setPaymentProofImage(`data:image/jpeg;base64,${base64}`);
    await logImageUploadActivity({
        uploaderId: user?.id || 'unknown',
        uploaderName: user?.name || 'unknown',
        action: 'upload',
        details: `Image uploaded via ${source}, size: ${Math.round(sizeInKB)}KB`
    });
  };

  const showImageOptions = () => {
    Alert.alert(
        'Upload Bukti Transaksi',
        'Pilih sumber gambar',
        [
            { text: 'Kamera', onPress: () => pickProofImage(true) },
            { text: 'Galeri', onPress: () => pickProofImage(false) },
            { text: 'Batal', style: 'cancel' }
        ]
    );
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

             <Button
               mode="outlined"
               onPress={() => setShowDatePicker(true)}
               style={styles.input}
               icon="calendar"
               contentStyle={{ height: 48, justifyContent: 'flex-start' }}
             >
               {paymentDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
             </Button>

             {showDatePicker && (
               <DateTimePicker
                 value={paymentDate}
                 mode="date"
                 display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                 maximumDate={new Date()}
                 onChange={(_e, date) => {
                   setShowDatePicker(false);
                   if (date) setPaymentDate(date);
                 }}
               />
             )}

             <SegmentedButtons
               value={paymentMethod}
               onValueChange={(val) => setPaymentMethod(val as any)}
               buttons={[
                 { value: 'cash', label: 'Cash' },
                 { value: 'transfer', label: 'Transfer' },
               ]}
               style={{ marginBottom: 10 }}
             />

             {paymentMethod === 'transfer' && (
               <View style={{ marginBottom: 10 }}>
                 <TextInput
                   mode="outlined"
                   label="Referensi Transfer (Opsional)"
                   value={paymentReference}
                   onChangeText={setPaymentReference}
                   style={styles.input}
                 />
                 <TouchableOpacity onPress={showImageOptions} style={styles.proofBox}>
                   {paymentProofImage ? (
                     <Image source={{ uri: paymentProofImage }} style={styles.proofImage} />
                   ) : (
                     <View style={{alignItems:'center'}}>
                        <Text style={{ color: '#666', marginBottom: 4 }}>+ Upload Bukti Transfer</Text>
                        <Text variant="labelSmall" style={{color:'#999'}}>Maks 800KB (JPG/PNG)</Text>
                     </View>
                   )}
                 </TouchableOpacity>
                 {paymentProofImage ? (
                   <Button mode="text" onPress={() => setPaymentProofImage(null)}>
                     Hapus Bukti
                   </Button>
                 ) : null}
               </View>
             )}

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
  },
  proofBox: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  proofImage: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    resizeMode: 'contain',
  },
});
