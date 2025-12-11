import React, { useEffect, useState } from 'react';
import { View, ScrollView, Image } from 'react-native';
import { Appbar, ActivityIndicator, Text, Surface } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Product, CreditSettings } from '../../../src/types';
import { getProduct, getCreditSettings } from '../../../src/services/productService';
import ProductSimulation from '../../../src/components/products/ProductSimulation';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [settings, setSettings] = useState<CreditSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      if (typeof id === 'string') {
        const [p, s] = await Promise.all([
          getProduct(id),
          getCreditSettings()
        ]);
        setProduct(p);
        setSettings(s);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <View style={{flex:1, justifyContent:'center'}}><ActivityIndicator /></View>;
  if (!product || !settings) return <View style={{flex:1, justifyContent:'center'}}><Text style={{textAlign:'center'}}>Produk tidak ditemukan</Text></View>;

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F2' }}>
      <Appbar.Header style={{ backgroundColor: '#fff' }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={product.name} />
      </Appbar.Header>

      <ScrollView>
        {product.imageUrl && (
            <Image source={{ uri: product.imageUrl }} style={{ width: '100%', height: 250, backgroundColor: 'white' }} resizeMode="contain" />
        )}
        
        <Surface style={{ padding: 16, backgroundColor: 'white', marginBottom: 8 }} elevation={1}>
            <Text variant="headlineSmall" style={{marginBottom: 8}}>{product.name}</Text>
            <Text variant="bodyMedium" style={{color: '#616161'}}>{product.description || 'Tidak ada deskripsi'}</Text>
        </Surface>

        <ProductSimulation product={product} globalSettings={settings} />
      </ScrollView>
    </View>
  );
}