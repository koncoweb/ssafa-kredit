import React, { useEffect, useState } from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { Appbar, ActivityIndicator, Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { Product } from '../../../src/types';
import { getProducts } from '../../../src/services/productService';
import ProductCard from '../../../src/components/products/ProductCard';

export default function ProductListScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const data = await getProducts(true);
      setProducts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F2' }}>
      <Appbar.Header style={{ backgroundColor: '#fff' }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Katalog Produk" />
      </Appbar.Header>

      {loading ? (
        <View style={{flex:1, justifyContent:'center'}}><ActivityIndicator /></View>
      ) : (
        <ScrollView 
            contentContainerStyle={{ paddingVertical: 16 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); loadProducts();}} />}
        >
          {products.length === 0 ? (
            <Text style={{textAlign:'center', marginTop: 20}}>Belum ada produk.</Text>
          ) : (
            products.map(p => (
              <ProductCard 
                key={p.id} 
                product={p} 
                onPress={() => router.push(`/(customer)/products/${p.id}` as any)} 
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}