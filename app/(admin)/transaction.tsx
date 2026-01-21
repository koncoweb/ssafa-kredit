import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Appbar, Button, Card, Checkbox, Chip, Dialog, Divider, Portal, Searchbar, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { CustomerData, getAllCustomers } from '../../src/services/firestore';
import { generateAgreementPDF } from '../../src/services/printService';
import { calculateCreditPrice, calculateInstallment, getCreditSettings, getProducts } from '../../src/services/productService';
import { createCreditTransaction, getCreditTransactionsReport, processPayment } from '../../src/services/transactionService';
import { useAuthStore } from '../../src/store/authStore';
import { CreditSettings, Product } from '../../src/types';

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
};

export default function CreditTransactionScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams();
  const isPaymentMode = mode === 'payment';

  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Select Customer, 2: Select Product, 3: Details & Confirm

  // Data
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [creditSettings, setCreditSettings] = useState<CreditSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Selection State
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Transaction Details State
  const [tenorType, setTenorType] = useState<'weekly' | 'monthly' | 'daily'>('weekly');
  const [selectedTenor, setSelectedTenor] = useState<number | null>(null);
  const [downPayment, setDownPayment] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  
  // Payment State
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [nextDueAmount, setNextDueAmount] = useState<number | null>(null);
  const [nextDueLabel, setNextDueLabel] = useState<string>('');

  // Search State
  const [customerSearch, setCustomerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');

  // Processing State
  const [processing, setProcessing] = useState(false);
  const user = useAuthStore(state => state.user);
  
  // Custom Tenor State (Cicilan Bebas)
  const [customTenor, setCustomTenor] = useState<string>('');
  
  // Modal State
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorDetails, setErrorDetails] = useState('');
  const [lastTransactionId, setLastTransactionId] = useState('');

  useEffect(() => {
    loadInitialData();
  }, []);

  const generatePDF = async () => {
    if (!selectedCustomer || !selectedProduct || !creditCalculation || !selectedTenor) return;

    try {
      const schedule = getFullSchedule(tenorType, selectedTenor);
      
      await generateAgreementPDF({
        customer: {
          name: selectedCustomer.name,
          id: selectedCustomer.uid, // Using UID as ID placeholder if KTP not available
          address: selectedCustomer.address || '-',
          phone: selectedCustomer.phone || '-'
        },
        product: {
          name: selectedProduct.name,
          priceCash: selectedProduct.priceCash
        },
        transaction: {
          priceCredit: creditCalculation.creditPriceTotal,
          downPayment: parseInt(downPayment) || 0,
          principal: creditCalculation.principal,
          tenorType: tenorType,
          tenorCount: selectedTenor,
          installmentAmount: creditCalculation.installment,
          markupPercentage: creditCalculation.markupUsed
        },
        schedule: schedule.map(s => ({
          installment: s.installment,
          date: s.date
        })),
        officerName: user?.name || 'Petugas'
      });
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Gagal mencetak dokumen");
    }
  };

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [custData, prodData, settingsData] = await Promise.all([
        getAllCustomers(),
        getProducts(true), // Only active products
        getCreditSettings()
      ]);
      setCustomers(custData);
      setProducts(prodData);
      setCreditSettings(settingsData);
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadNextDue = async () => {
      if (!isPaymentMode || step !== 2 || !selectedCustomer) {
        setNextDueAmount(null);
        setNextDueLabel('');
        return;
      }
      try {
        const txs = await getCreditTransactionsReport({ customerId: selectedCustomer.uid });
        let minAmount: number | null = null;
        let label = '';
        txs.forEach((tx: any) => {
          const next = (tx.installments || []).find((i: any) => i.status !== 'paid');
          if (next) {
            if (minAmount === null || next.amount < minAmount) {
              minAmount = next.amount;
              label = `Cicilan berikutnya: ${formatCurrency(next.amount)} pada ${next.dueDate?.toDate?.()?.toLocaleDateString('id-ID') || '-'}`;
            }
          }
        });
        setNextDueAmount(minAmount);
        setNextDueLabel(label);
      } catch (e) {
        console.error(e);
        setNextDueAmount(null);
        setNextDueLabel('');
      }
    };
    loadNextDue();
  }, [isPaymentMode, step, selectedCustomer]);

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()));
  }, [customers, customerSearch]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));
  }, [products, productSearch]);

  // Calculations
  const creditCalculation = useMemo(() => {
    if (!selectedProduct || !creditSettings) return null;
    
    const creditPriceTotal = calculateCreditPrice(
      selectedProduct.priceCash, 
      selectedProduct.markupPercentage, 
      creditSettings.globalMarkupPercentage
    );

    const dpAmount = parseInt(downPayment) || 0;
    const principal = creditPriceTotal - dpAmount;
    
    let installment = 0;
    if (selectedTenor) {
      installment = calculateInstallment(creditPriceTotal, dpAmount, selectedTenor);
    }

    return {
      creditPriceTotal,
      principal,
      installment,
      markupUsed: selectedProduct.markupPercentage ?? creditSettings.globalMarkupPercentage
    };
  }, [selectedProduct, creditSettings, downPayment, selectedTenor]);

  const getNextDueDate = (type: 'weekly' | 'monthly' | 'daily') => {
    const today = new Date();
    const nextDate = new Date(today);
    if (type === 'weekly') {
      nextDate.setDate(today.getDate() + 7);
    } else if (type === 'daily') {
      nextDate.setDate(today.getDate() + 1);
    } else {
      nextDate.setMonth(today.getMonth() + 1);
    }
    return nextDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const [scheduleDialogVisible, setScheduleDialogVisible] = useState(false);
  const getFullSchedule = (type: 'weekly' | 'monthly' | 'daily', count: number) => {
    const today = new Date();
    const principal = creditCalculation?.principal || 0;
    const base = creditCalculation?.installment || 0;
    const remainder = count ? (principal - (base * count)) : 0;
    const items: { installment: number; date: string; amount: number }[] = [];
    for (let i = 1; i <= count; i++) {
        const d = new Date(today);
        if (type === 'weekly') {
            d.setDate(today.getDate() + (i * 7));
        } else if (type === 'daily') {
            d.setDate(today.getDate() + i);
        } else {
            d.setMonth(today.getMonth() + i);
        }
        const amount = base + (i === count ? remainder : 0);
        items.push({
            installment: i,
            date: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
            amount
        });
    }
    return items;
  };

  const handlePaymentSubmit = async () => {
    if (!selectedCustomer || !paymentAmount) return;

    const pay = parseInt(paymentAmount);
    if (!pay || pay <= 0) {
      Alert.alert("Validasi", "Jumlah pembayaran harus lebih dari 0.");
      return;
    }
    if ((selectedCustomer.totalDebt || 0) < pay) {
      Alert.alert("Validasi", "Jumlah pembayaran melebihi total utang pelanggan.");
      return;
    }

    setProcessing(true);
    try {
        await processPayment({
            customerId: selectedCustomer.uid,
            customerName: selectedCustomer.name,
            amount: pay,
            notes: paymentNotes,
            collectorId: user?.id || 'unknown',
            collectorName: user?.name || 'Unknown'
        });
        setSuccessModalVisible(true);
    } catch (e: any) {
        setErrorDetails(e.message || "Gagal mencatat pembayaran");
        setErrorModalVisible(true);
    } finally {
        setProcessing(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedCustomer || !selectedProduct || !selectedTenor || !creditCalculation) return;
    
    // Validations
    if (selectedProduct.stock < 1) {
      Alert.alert("Error", "Stok produk habis!");
      return;
    }

    if (creditCalculation.principal <= 0) {
      Alert.alert("Error", "Total pinjaman tidak valid (DP terlalu besar)");
      return;
    }

    if (!agreedToTerms) {
        Alert.alert("Persetujuan Diperlukan", "Harap setujui syarat dan ketentuan kredit.");
        return;
    }

    setProcessing(true);
    try {
        const newTransactionId = await createCreditTransaction({
            customer: {
                id: selectedCustomer.uid, // Use uid from CustomerData
                name: selectedCustomer.name,
                address: selectedCustomer.address || '',
                phone: selectedCustomer.phone || '',
                totalDebt: selectedCustomer.totalDebt
            },
            product: selectedProduct,
            creditPriceTotal: creditCalculation.creditPriceTotal,
            markupUsed: creditCalculation.markupUsed,
            downPayment: parseInt(downPayment) || 0,
            tenorType: tenorType,
            tenorCount: selectedTenor,
            notes: notes,
            approvedBy: {
              id: user?.id || 'unknown',
              name: user?.name || 'Unknown User',
              role: user?.role || 'admin'
            }
        });

        setLastTransactionId(newTransactionId);
        setSuccessModalVisible(true);
    } catch (e: any) {
        setErrorDetails(e.message || "Terjadi kesalahan saat menyimpan transaksi");
        setErrorModalVisible(true);
    } finally {
        setProcessing(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <Appbar.Header style={{ backgroundColor: '#fff', elevation: 2 }}>
        {step > 1 && <Appbar.BackAction onPress={() => setStep(prev => (prev - 1) as 1|2|3)} />}
        <Appbar.Content title="Transaksi Kredit Baru" />
      </Appbar.Header>

      <View style={{flex: 1}}>
        {/* Step 1: Select Customer */}
        {step === 1 && (
          <View style={styles.stepContainer}>
            <Text variant="titleMedium" style={styles.stepTitle}>Langkah 1: Pilih Pelanggan</Text>
            <Searchbar
                placeholder="Cari nama pelanggan..."
                onChangeText={setCustomerSearch}
                value={customerSearch}
                style={styles.searchBar}
            />
            <FlatList
                data={filteredCustomers}
                keyExtractor={item => item.uid}
                contentContainerStyle={{paddingBottom: 20}}
                renderItem={({item}) => (
                    <TouchableOpacity onPress={() => { setSelectedCustomer(item); setStep(2); }}>
                        <Card style={styles.cardItem}>
                            <Card.Content>
                                <Text variant="titleMedium">{item.name}</Text>
                                <Text variant="bodySmall" style={{color:'#666'}}>{item.email} - {item.phone}</Text>
                                <Text variant="bodySmall" style={{marginTop: 4, color: (item.totalDebt || 0) > 0 ? '#D32F2F' : '#388E3C'}}>
                                    Utang: {formatCurrency(item.totalDebt || 0)}
                                </Text>
                            </Card.Content>
                        </Card>
                    </TouchableOpacity>
                )}
            />
          </View>
        )}

        {/* Step 2: Select Product OR Input Payment */}
        {step === 2 && (
          <View style={styles.stepContainer}>
            <Text variant="titleMedium" style={styles.stepTitle}>
                {isPaymentMode ? 'Langkah 2: Input Pembayaran' : 'Langkah 2: Pilih Produk'}
            </Text>
            
            {isPaymentMode ? (
                <ScrollView>
                    <Card style={{marginBottom: 16}}>
                        <Card.Title title="Info Pelanggan" />
                        <Card.Content>
                            <Text variant="titleMedium">{selectedCustomer?.name}</Text>
                            <Text variant="bodyMedium" style={{color: (selectedCustomer?.totalDebt || 0) > 0 ? '#D32F2F' : '#388E3C', fontWeight:'bold'}}>
                                Total Utang: {formatCurrency(selectedCustomer?.totalDebt || 0)}
                            </Text>
                        </Card.Content>
                    </Card>

                    <TextInput
                        label="Jumlah Pembayaran"
                        value={paymentAmount}
                        onChangeText={setPaymentAmount}
                        keyboardType="numeric"
                        mode="outlined"
                        style={{marginBottom: 16, backgroundColor:'#fff'}}
                        left={<TextInput.Affix text="Rp" />}
                    />
                    {nextDueLabel ? (
                      <Text variant="bodySmall" style={{ color: '#666', marginBottom: 8 }}>
                        {nextDueLabel}
                      </Text>
                    ) : null}
                    {nextDueAmount && parseInt(paymentAmount || '0') > 0 && parseInt(paymentAmount || '0') < nextDueAmount ? (
                      <Text variant="bodySmall" style={{ color: '#D32F2F', marginBottom: 8 }}>
                        Pembayaran parsial: cicilan belum dianggap lunas. Sistem harian tetap diperbolehkan.
                      </Text>
                    ) : null}

                    <TextInput
                        label="Catatan (Opsional)"
                        value={paymentNotes}
                        onChangeText={setPaymentNotes}
                        mode="outlined"
                        style={{marginBottom: 24, backgroundColor:'#fff'}}
                        multiline
                    />

                    <Button 
                        mode="contained" 
                        onPress={handlePaymentSubmit}
                        loading={processing}
                        disabled={!paymentAmount || processing}
                        style={{paddingVertical: 6}}
                    >
                        Simpan Pembayaran
                    </Button>
                </ScrollView>
            ) : (
                <>
                    <Searchbar
                        placeholder="Cari produk..."
                        onChangeText={setProductSearch}
                        value={productSearch}
                        style={styles.searchBar}
                    />
                    <FlatList
                        data={filteredProducts}
                        keyExtractor={item => item.id}
                        contentContainerStyle={{paddingBottom: 20}}
                        renderItem={({item}) => (
                            <TouchableOpacity 
                                onPress={() => { 
                                    if(item.stock > 0) {
                                        setSelectedProduct(item); 
                                        setStep(3); 
                                    } else {
                                        Alert.alert("Stok Habis", "Produk ini tidak tersedia.");
                                    }
                                }}
                                disabled={item.stock < 1}
                            >
                                <Card style={[styles.cardItem, item.stock < 1 && {opacity: 0.6}]}>
                                    <Card.Content style={{flexDirection:'row', alignItems:'center'}}>
                                        {item.imageUrl && (
                                            <Image source={{uri: item.imageUrl}} style={{width: 50, height: 50, borderRadius: 4, marginRight: 12}} />
                                        )}
                                        <View style={{flex:1}}>
                                            <Text variant="titleMedium">{item.name}</Text>
                                            <Text variant="bodySmall" style={{color: item.stock < 5 ? '#D32F2F' : '#666', fontWeight: item.stock < 5 ? 'bold' : 'normal'}}>
                                                Stok: {item.stock} {item.stock < 5 ? '(Menipis!)' : ''}
                                            </Text>
                                            <Text variant="titleSmall" style={{color:'#1976D2'}}>{formatCurrency(item.priceCash)} (Cash)</Text>
                                        </View>
                                    </Card.Content>
                                </Card>
                            </TouchableOpacity>
                        )}
                    />
                </>
            )}
          </View>
        )}

        {/* Step 3: Calculation & Confirmation */}
        {step === 3 && !isPaymentMode && selectedProduct && selectedCustomer && creditSettings && (
          <ScrollView contentContainerStyle={{padding: 16, paddingBottom: 40}}>
            <Card style={{marginBottom: 16}}>
                <Card.Title title="Rincian Transaksi" subtitle={`Pelanggan: ${selectedCustomer.name}`} />
                <Card.Content>
                    <View style={styles.row}>
                        <Text>Produk:</Text>
                        <Text style={{fontWeight:'bold'}}>{selectedProduct.name}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text>Harga Cash:</Text>
                        <Text>{formatCurrency(selectedProduct.priceCash)}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text>Harga Kredit (+{(creditCalculation?.markupUsed || 0)}%):</Text>
                        <Text style={{fontWeight:'bold', color:'#1976D2'}}>{formatCurrency(creditCalculation?.creditPriceTotal || 0)}</Text>
                    </View>
                </Card.Content>
            </Card>

            <Text variant="titleMedium" style={{marginBottom: 8}}>Opsi Cicilan</Text>
            <SegmentedButtons
                value={tenorType}
                onValueChange={val => {
                    setTenorType(val as 'weekly' | 'monthly' | 'daily');
                    setSelectedTenor(null);
                    setCustomTenor('');
                }}
                buttons={[
                    { value: 'weekly', label: 'Mingguan' },
                    { value: 'monthly', label: 'Bulanan' },
                    { value: 'daily', label: 'Harian' },
                ]}
                style={{marginBottom: 16}}
            />

            {tenorType === 'daily' ? (
                <View style={{marginBottom: 16}}>
                     <TextInput
                        label="Jumlah Hari (Cicilan Bebas)"
                        value={customTenor}
                        onChangeText={(text) => {
                            setCustomTenor(text);
                            const val = parseInt(text);
                            if (val > 0) setSelectedTenor(val);
                            else setSelectedTenor(null);
                        }}
                        keyboardType="number-pad"
                        mode="outlined"
                        style={{backgroundColor: '#fff'}}
                        right={<TextInput.Affix text="Hari" />}
                    />
                    <Text variant="bodySmall" style={{color: '#666', marginTop: 4}}>
                        Masukkan jumlah hari untuk cicilan harian bebas.
                    </Text>
                </View>
            ) : (
                <View style={{flexDirection:'row', flexWrap:'wrap', gap: 8, marginBottom: 16}}>
                    {(tenorType === 'weekly' ? creditSettings.availableTenors.weekly : creditSettings.availableTenors.monthly).map((t) => (
                        <Chip 
                            key={t} 
                            selected={selectedTenor === t} 
                            onPress={() => setSelectedTenor(t)}
                            mode="outlined"
                            showSelectedOverlay
                        >
                            {t}x ({tenorType === 'weekly' ? 'Minggu' : 'Bulan'})
                        </Chip>
                    ))}
                </View>
            )}

            <TextInput
                label="Uang Muka (DP)"
                value={downPayment}
                onChangeText={setDownPayment}
                keyboardType="numeric"
                mode="outlined"
                style={{marginBottom: 16, backgroundColor:'#fff'}}
                left={<TextInput.Affix text="Rp" />}
            />
            
            {creditCalculation && selectedTenor && (
                <Card style={{marginBottom: 16, backgroundColor:'#E3F2FD'}}>
                    <Card.Content>
                        <Text variant="titleMedium" style={{textAlign:'center', marginBottom: 8}}>Simulasi Pembayaran</Text>
                        <Divider style={{marginBottom: 8}} />
                        <View style={styles.row}>
                            <Text>Pokok Utang:</Text>
                            <Text>{formatCurrency(creditCalculation.principal)}</Text>
                        </View>
                        <View style={styles.row}>
                            <Text>Angsuran per {tenorType === 'weekly' ? 'Minggu' : tenorType === 'daily' ? 'Hari' : 'Bulan'}:</Text>
                            <Text style={{fontWeight:'bold', fontSize: 18, color:'#D32F2F'}}>
                                {formatCurrency(creditCalculation.installment)}
                            </Text>
                        </View>
                        <View style={styles.row}>
                            <Text>Jatuh Tempo Pertama:</Text>
                            <Text style={{fontWeight:'bold'}}>{getNextDueDate(tenorType)}</Text>
                        </View>
                        <Text style={{textAlign:'center', marginTop: 8, fontSize: 12, color:'#666'}}>
                            x {selectedTenor} kali pembayaran
                        </Text>
                        <Button mode="text" compact onPress={() => setScheduleDialogVisible(true)} style={{marginTop: 4}}>
                            Lihat Jadwal Lengkap
                        </Button>
                        <Button mode="contained-tonal" icon="printer" onPress={generatePDF} style={{marginTop: 8}}>
                            Cetak Simulasi / Surat Perjanjian
                        </Button>
                    </Card.Content>
                </Card>
            )}

            <Portal>
                <Dialog visible={scheduleDialogVisible} onDismiss={() => setScheduleDialogVisible(false)}>
                    <Dialog.Title>Jadwal Pembayaran</Dialog.Title>
                    <Dialog.ScrollArea style={{maxHeight: 300, paddingHorizontal: 0}}>
                        <ScrollView contentContainerStyle={{paddingHorizontal: 24}}>
                            {selectedTenor && getFullSchedule(tenorType, selectedTenor).map((item) => (
                                <View key={item.installment} style={{flexDirection:'row', justifyContent:'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee'}}>
                                    <View style={{flexDirection:'row', gap: 8}}>
                                      <Text>Cicilan ke-{item.installment}</Text>
                                      <Text style={{color:'#1976D2'}}>{formatCurrency(item.amount)}</Text>
                                    </View>
                                    <Text style={{fontWeight:'bold'}}>{item.date}</Text>
                                </View>
                            ))}
                        </ScrollView>
                    </Dialog.ScrollArea>
                    <Dialog.Actions>
                        <Button onPress={() => setScheduleDialogVisible(false)}>Tutup</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

            <TextInput
                label="Catatan (Opsional)"
                value={notes}
                onChangeText={setNotes}
                mode="outlined"
                style={{marginBottom: 16, backgroundColor:'#fff'}}
                multiline
            />

            <Card style={{marginBottom: 24, borderColor: '#ddd'}} mode="outlined">
                <Card.Content>
                    <Text variant="titleMedium" style={{marginBottom: 8}}>Syarat & Ketentuan</Text>
                    <Text variant="bodySmall" style={{color: '#666', marginBottom: 4}}>1. Barang yang sudah dibeli tidak dapat dikembalikan.</Text>
                    <Text variant="bodySmall" style={{color: '#666', marginBottom: 4}}>2. Pembayaran angsuran wajib dilakukan tepat waktu sesuai jadwal.</Text>
                    <Text variant="bodySmall" style={{color: '#666', marginBottom: 4}}>3. Hak milik barang beralih ke pembeli setelah lunas.</Text>
                    
                    <View style={{flexDirection:'row', alignItems:'center', marginTop: 8}}>
                        <Checkbox.Android status={agreedToTerms ? 'checked' : 'unchecked'} onPress={() => setAgreedToTerms(!agreedToTerms)} />
                        <Text onPress={() => setAgreedToTerms(!agreedToTerms)} style={{flex: 1}}>
                            Saya, <Text style={{fontWeight: 'bold'}}>{selectedCustomer.name}</Text>, menyetujui syarat & ketentuan di atas
                        </Text>
                    </View>
                </Card.Content>
            </Card>

            {/* Success Modal */}
            <Portal>
                <Dialog visible={successModalVisible} onDismiss={() => setSuccessModalVisible(false)} dismissable={false}>
                    <Dialog.Icon icon="check-circle" size={50} color="#4CAF50" />
                    <Dialog.Title style={{textAlign:'center', color: '#4CAF50'}}>Transaksi Berhasil</Dialog.Title>
                    <Dialog.Content>
                        <Text style={{textAlign:'center', marginBottom: 10}}>
                            {isPaymentMode ? 'Pembayaran telah berhasil dicatat.' : 'Transaksi kredit telah berhasil dicatat ke dalam sistem.'}
                        </Text>
                        <View style={{backgroundColor:'#f5f5f5', padding: 10, borderRadius: 8}}>
                             {isPaymentMode ? (
                                <View style={styles.row}>
                                    <Text variant="bodySmall">Jumlah Bayar:</Text>
                                    <Text variant="bodySmall" style={{fontWeight:'bold'}}>{formatCurrency(parseInt(paymentAmount) || 0)}</Text>
                                </View>
                             ) : (
                                <>
                                    <View style={styles.row}>
                                        <Text variant="bodySmall">ID Transaksi:</Text>
                                        <Text variant="bodySmall" style={{fontWeight:'bold'}}>{lastTransactionId}</Text>
                                    </View>
                                    <View style={styles.row}>
                                        <Text variant="bodySmall">Total Kredit:</Text>
                                        <Text variant="bodySmall" style={{fontWeight:'bold'}}>{formatCurrency(creditCalculation?.creditPriceTotal || 0)}</Text>
                                    </View>
                                </>
                             )}
                        </View>
                    </Dialog.Content>
                    <Dialog.Actions style={{justifyContent: 'center'}}>
                        <Button mode="contained" onPress={() => {
                            setSuccessModalVisible(false);
                            // Reset form
                            setStep(1);
                            setSelectedCustomer(null);
                            setSelectedProduct(null);
                            setSelectedTenor(null);
                            setDownPayment('');
                            setNotes('');
                            setAgreedToTerms(false);
                            setCustomTenor('');
                            setTenorType('weekly');
                            // Payment Reset
                            setPaymentAmount('');
                            setPaymentNotes('');
                            // Reload data
                            loadInitialData();
                            router.replace('/(admin)');
                        }}>OK</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

            {/* Error Modal */}
            <Portal>
                <Dialog visible={errorModalVisible} onDismiss={() => setErrorModalVisible(false)}>
                    <Dialog.Icon icon="alert-circle" size={50} color="#F44336" />
                    <Dialog.Title style={{textAlign:'center', color: '#F44336'}}>Gagal Mencatat Transaksi</Dialog.Title>
                    <Dialog.Content>
                         <Text style={{textAlign:'center', marginBottom: 10}}>
                            Maaf, terjadi kesalahan saat memproses transaksi.
                        </Text>
                        <Text style={{textAlign:'center', color: '#666', fontSize: 12}}>
                            Detail Error: {errorDetails}
                        </Text>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setErrorModalVisible(false)} textColor="#666">Batal</Button>
                        <Button mode="contained" buttonColor="#F44336" onPress={() => {
                            setErrorModalVisible(false);
                            handleSubmit(); // Retry
                        }}>Coba Lagi</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

            <Button 
                mode="contained" 
                onPress={handleSubmit} 
                disabled={!selectedTenor || processing || !agreedToTerms}
                loading={processing}
                style={{paddingVertical: 6}}
            >
                Buat Transaksi
            </Button>

          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    stepContainer: { flex: 1, padding: 16 },
    stepTitle: { marginBottom: 16, fontWeight: 'bold', color:'#333' },
    searchBar: { marginBottom: 16, backgroundColor: '#fff' },
    cardItem: { marginBottom: 8, backgroundColor: '#fff' },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
});
