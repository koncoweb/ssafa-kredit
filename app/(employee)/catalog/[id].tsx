import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Appbar, Button, Chip, DataTable, Divider, Surface, Text } from 'react-native-paper';
import { calculateCreditPrice, calculateInstallment, getCreditSettings, getProduct } from '../../../src/services/productService';
import { CreditSettings, Product } from '../../../src/types';

export default function EmployeeProductDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [settings, setSettings] = useState<CreditSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = React.useCallback(async () => {
    if (!id) return;
    try {
      const [productData, settingsData] = await Promise.all([
        getProduct(id as string),
        getCreditSettings()
      ]);
      setProduct(productData);
      setSettings(settingsData);
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
                {settings.availableTenors.weekly.map((tenor) => {
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
                {settings.availableTenors.monthly.map((tenor) => {
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

      <View style={styles.footer}>
        <Button mode="contained" onPress={() => router.push('/(employee)/transactions/create')} style={styles.button}>
            Catat Transaksi
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
