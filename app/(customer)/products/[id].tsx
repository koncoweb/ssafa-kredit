import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Appbar, Button, Chip, DataTable, Dialog, Divider, List, Portal, SegmentedButtons, Surface, Text, TextInput } from 'react-native-paper';
import { createCreditRequest, getCustomerData } from '../../../src/services/firestore';
import { getQueue, isOnline, resolveQueuedItemData, syncAll, upsertQueuedItem } from '../../../src/services/offline';
import { calculateCreditPrice, calculateInstallment, getCreditSettings, getProduct } from '../../../src/services/productService';
import { useAuthStore } from '../../../src/store/authStore';
import { CreditSettings, Product } from '../../../src/types';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const [product, setProduct] = useState<Product | null>(null);
  const [settings, setSettings] = useState<CreditSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const [applyVisible, setApplyVisible] = useState(false);
  const [queueVisible, setQueueVisible] = useState(false);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [queuedItems, setQueuedItems] = useState<any[]>([]);

  const [draftQueueId, setDraftQueueId] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string>('');
  const [tenorType, setTenorType] = useState<'weekly' | 'monthly'>('weekly');
  const [tenorCount, setTenorCount] = useState<number | null>(null);
  const [downPayment, setDownPayment] = useState<string>('0');
  const [notes, setNotes] = useState<string>('');

  const loadData = React.useCallback(async () => {
    if (!id) return;
    try {
      const [productData, settingsData] = await Promise.all([
        getProduct(id as string),
        getCreditSettings()
      ]);
      setProduct(productData);
      setSettings(settingsData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  };

  const generateClientId = () => {
    return `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  };

  if (loading) {
    return (
      <View style={{flex:1, justifyContent:'center', alignItems:'center'}}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!product || !settings) {
    return (
      <View style={{flex:1}}>
        <Appbar.Header><Appbar.BackAction onPress={() => router.back()} /></Appbar.Header>
        <View style={{flex:1, justifyContent:'center', alignItems:'center'}}>
          <Text>Produk tidak ditemukan</Text>
        </View>
      </View>
    );
  }

  const creditPrice = calculateCreditPrice(product.priceCash, product.markupPercentage, settings.globalMarkupPercentage);
  const weeklyTenors = (settings.availableTenors?.weekly && settings.availableTenors.weekly.length > 0)
    ? settings.availableTenors.weekly
    : [4, 8, 12, 16];
  const monthlyTenors = (settings.availableTenors?.monthly && settings.availableTenors.monthly.length > 0)
    ? settings.availableTenors.monthly
    : [3, 6, 9, 12];

  const activeTenors = tenorType === 'weekly' ? weeklyTenors : monthlyTenors;
  const dpNumber = (() => {
    const n = parseInt(downPayment || '0');
    return Number.isFinite(n) ? n : 0;
  })();
  const installment = tenorCount ? calculateInstallment(creditPrice, dpNumber, tenorCount) : null;

  const loadQueueForUser = async () => {
    if (!user?.id) return;
    setLoadingQueue(true);
    try {
      const all = await getQueue();
      const mine = all.filter((i) => i?.metadata?.userId === user.id && i?.metadata?.syncStatus !== 'synced');
      setQueuedItems(mine);
      return mine;
    } finally {
      setLoadingQueue(false);
    }
  };

  const openApply = async () => {
    if (!user?.id) {
      Alert.alert('Login diperlukan', 'Silakan login untuk mengajukan kredit.');
      return;
    }
    if (!product) return;

    setApplyVisible(true);
    const all = await loadQueueForUser();
    const drafts = (all || []).filter((i) => i.type === 'creditRequest');
    let existing: { item: any; data: any } | null = null;
    for (const item of drafts) {
      try {
        const data = await resolveQueuedItemData(item);
        if (data?.productId === product.id) {
          existing = { item, data };
          break;
        }
      } catch {
        continue;
      }
    }
    if (existing) {
      setDraftQueueId(existing.item.id);
      setRequestId(existing.data?.id || existing.data?.requestId || generateClientId());
      setTenorType((existing.data?.tenorType as any) === 'monthly' ? 'monthly' : 'weekly');
      setTenorCount(typeof existing.data?.tenorCount === 'number' ? existing.data.tenorCount : null);
      setDownPayment(String(existing.data?.downPayment ?? '0'));
      setNotes(String(existing.data?.notes ?? ''));
    } else {
      setDraftQueueId(null);
      setRequestId(generateClientId());
      setTenorType('weekly');
      setTenorCount(null);
      setDownPayment('0');
      setNotes('');
    }
  };

  const submitCreditRequest = async () => {
    if (!user?.id || !product) return;
    if (!tenorCount) {
      Alert.alert('Validasi', 'Pilih tenor cicilan.');
      return;
    }
    if (dpNumber < 0) {
      Alert.alert('Validasi', 'DP tidak boleh negatif.');
      return;
    }
    if (dpNumber >= creditPrice) {
      Alert.alert('Validasi', 'DP terlalu besar.');
      return;
    }

    if (isOnline()) {
      try {
        const customer = await getCustomerData(user.id);
        await createCreditRequest({
          id: requestId,
          customerId: user.id,
          customerName: customer?.name || user.name,
          customerPhone: customer?.phone || '',
          productId: product.id,
          productName: product.name,
          productPriceCash: product.priceCash,
          creditPriceTotal: creditPrice,
          tenorType,
          tenorCount,
          downPayment: dpNumber,
          notes,
        });
        setApplyVisible(false);
        Alert.alert('Sukses', 'Pengajuan kredit terkirim.');
      } catch (e: any) {
        Alert.alert('Gagal', e?.message || 'Gagal mengirim pengajuan kredit.');
      }
      return;
    }

    try {
      const customer = await getCustomerData(user.id);
      await upsertQueuedItem({
        id: draftQueueId || undefined,
        type: 'creditRequest',
        priority: 'high',
        maxSize: 1024 * 1024,
        format: 'json',
        data: {
          id: requestId,
          customerId: user.id,
          customerName: customer?.name || user.name,
          customerPhone: customer?.phone || '',
          productId: product.id,
          productName: product.name,
          productPriceCash: product.priceCash,
          creditPriceTotal: creditPrice,
          tenorType,
          tenorCount,
          downPayment: dpNumber,
          notes,
        },
        metadata: {
          userId: user.id,
          sensitive: true,
        },
      });
      setApplyVisible(false);
      Alert.alert('Tersimpan', 'Pengajuan disimpan sebagai draft (offline) dan akan disinkronkan otomatis.');
    } catch (e: any) {
      Alert.alert('Gagal', e?.message || 'Gagal menyimpan draft offline.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <Appbar.Header style={{ backgroundColor: '#fff' }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Detail Produk" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        {product.imageUrl && (
            <Image source={{ uri: product.imageUrl }} style={styles.image} resizeMode="cover" />
        )}
        
        <Surface style={styles.surface} elevation={1}>
            <Text variant="headlineSmall" style={styles.title}>{product.name}</Text>
            <Text variant="headlineMedium" style={styles.price}>{formatCurrency(product.priceCash)}</Text>
            
            <View style={{flexDirection: 'row', marginTop: 8}}>
                <Chip icon="package-variant" style={{marginRight: 8}}>Stok: {product.stock}</Chip>
                {product.active ? 
                    <Chip icon="check-circle" style={{backgroundColor:'#E8F5E9'}}>Tersedia</Chip> : 
                    <Chip icon="close-circle" style={{backgroundColor:'#FFEBEE'}}>Habis</Chip>
                }
            </View>

            <Divider style={{marginVertical: 16}} />
            
            <Text variant="titleMedium" style={{marginBottom: 8}}>Deskripsi</Text>
            <Text variant="bodyMedium" style={{color: '#616161', lineHeight: 20}}>
                {product.description || 'Tidak ada deskripsi.'}
            </Text>
        </Surface>

        <Surface style={styles.surface} elevation={1}>
            <Text variant="titleLarge" style={{marginBottom: 16, color: '#1565C0'}}>Simulasi Cicilan</Text>
            <Text variant="bodySmall" style={{marginBottom: 16, color: '#757575'}}>
                *Harga kredit dasar: {formatCurrency(creditPrice)}
            </Text>

            <Text variant="titleMedium" style={{marginTop: 8, marginBottom: 8}}>Cicilan Mingguan</Text>
            <DataTable>
                <DataTable.Header>
                    <DataTable.Title>Tenor</DataTable.Title>
                    <DataTable.Title numeric>Angsuran</DataTable.Title>
                </DataTable.Header>
                {weeklyTenors.map((tenor) => {
                    const installment = calculateInstallment(creditPrice, 0, tenor);
                    return (
                        <DataTable.Row key={`w-${tenor}`}>
                            <DataTable.Cell>{tenor} x (Minggu)</DataTable.Cell>
                            <DataTable.Cell numeric>{formatCurrency(installment)}</DataTable.Cell>
                        </DataTable.Row>
                    );
                })}
            </DataTable>

            <Text variant="titleMedium" style={{marginTop: 24, marginBottom: 8}}>Cicilan Bulanan</Text>
            <DataTable>
                <DataTable.Header>
                    <DataTable.Title>Tenor</DataTable.Title>
                    <DataTable.Title numeric>Angsuran</DataTable.Title>
                </DataTable.Header>
                {monthlyTenors.map((tenor) => {
                    const installment = calculateInstallment(creditPrice, 0, tenor);
                    return (
                        <DataTable.Row key={`m-${tenor}`}>
                            <DataTable.Cell>{tenor} x (Bulan)</DataTable.Cell>
                            <DataTable.Cell numeric>{formatCurrency(installment)}</DataTable.Cell>
                        </DataTable.Row>
                    );
                })}
            </DataTable>
        </Surface>
      </ScrollView>

      <Portal>
        <Dialog visible={applyVisible} onDismiss={() => setApplyVisible(false)}>
          <Dialog.Title>Ajukan Kredit</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 12 }}>
              <Text variant="titleMedium" style={{ marginBottom: 6 }}>{product.name}</Text>
              <Text variant="bodySmall" style={{ color: '#757575', marginBottom: 16 }}>Harga kredit dasar: {formatCurrency(creditPrice)}</Text>

              <SegmentedButtons
                value={tenorType}
                onValueChange={(v) => {
                  setTenorType(v === 'monthly' ? 'monthly' : 'weekly');
                  setTenorCount(null);
                }}
                buttons={[
                  { value: 'weekly', label: 'Mingguan' },
                  { value: 'monthly', label: 'Bulanan' },
                ]}
                style={{ marginBottom: 12 }}
              />

              <Text variant="labelLarge" style={{ marginBottom: 6 }}>Tenor</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>
                {activeTenors.map((t) => (
                  <Chip
                    key={`${tenorType}-${t}`}
                    selected={tenorCount === t}
                    onPress={() => setTenorCount(t)}
                    style={{ marginRight: 8, marginBottom: 8 }}
                    showSelectedOverlay
                  >
                    {t}x
                  </Chip>
                ))}
              </View>

              <TextInput
                label="Uang Muka (DP)"
                value={downPayment}
                onChangeText={setDownPayment}
                keyboardType="numeric"
                mode="outlined"
                style={{ marginBottom: 12, backgroundColor: '#fff' }}
                left={<TextInput.Affix text="Rp" />}
              />

              {tenorCount && installment !== null ? (
                <List.Item
                  title="Estimasi angsuran"
                  description={`${formatCurrency(installment)} / ${tenorType === 'weekly' ? 'minggu' : 'bulan'}`}
                  left={(props) => <List.Icon {...props} icon="calculator" />}
                />
              ) : null}

              <TextInput
                label="Catatan (opsional)"
                value={notes}
                onChangeText={setNotes}
                mode="outlined"
                multiline
                style={{ backgroundColor: '#fff' }}
              />
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setApplyVisible(false)}>Batal</Button>
            <Button onPress={submitCreditRequest}>Ajukan</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={queueVisible}
          onDismiss={() => setQueueVisible(false)}
        >
          <Dialog.Title>Antrian Sinkronisasi</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 12 }}>
              {loadingQueue ? (
                <ActivityIndicator />
              ) : queuedItems.length === 0 ? (
                <Text>Tidak ada item yang menunggu sinkronisasi.</Text>
              ) : (
                queuedItems
                  .sort((a, b) => (a?.metadata?.timestamp || 0) - (b?.metadata?.timestamp || 0))
                  .map((i) => (
                    <List.Item
                      key={i.id}
                      title={i.type === 'creditRequest' ? 'Pengajuan Kredit' : i.type}
                      description={`Status: ${i?.metadata?.syncStatus || 'queued'} | Retry: ${i?.metadata?.attempts || 0}`}
                      left={(props) => <List.Icon {...props} icon="sync" />}
                      right={() => (
                        <Text style={{ alignSelf: 'center', color: '#757575' }}>
                          {new Date(i?.metadata?.timestamp || Date.now()).toLocaleString('id-ID')}
                        </Text>
                      )}
                    />
                  ))
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button
              onPress={async () => {
                if (!isOnline()) {
                  Alert.alert('Offline', 'Tidak ada koneksi.');
                  return;
                }
                await syncAll();
                await loadQueueForUser();
              }}
            >
              Sinkronkan
            </Button>
            <Button onPress={() => setQueueVisible(false)}>Tutup</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <View style={styles.footer}>
        <Button mode="contained" onPress={openApply} style={styles.button}>
          Ajukan Kredit
        </Button>
        <Button
          mode="text"
          onPress={async () => {
            if (!user?.id) {
              Alert.alert('Login diperlukan', 'Silakan login untuk melihat antrian.');
              return;
            }
            setQueueVisible(true);
            await loadQueueForUser();
          }}
          style={{ marginTop: 4 }}
        >
          Lihat antrian sinkronisasi
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: 250,
    backgroundColor: '#fff',
  },
  surface: {
    padding: 16,
    margin: 16,
    marginBottom: 0,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  price: {
    color: '#1E88E5',
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    elevation: 4,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  button: {
    paddingVertical: 4,
  }
});
