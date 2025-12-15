import React, { useEffect, useState, useMemo } from 'react';
import { View, FlatList, Image } from 'react-native';
import { Appbar, Searchbar, Card, Text, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { getProducts } from '../../src/services/productService';
import { Product } from '../../src/types';

export default function EmployeeCatalogScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await getProducts(true); // only active
        setProducts(data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    return products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  }, [products, search]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <Appbar.Header style={{ backgroundColor: '#fff', elevation: 2 }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Katalog Produk" />
      </Appbar.Header>
      <View style={{ padding: 12 }}>
        <Searchbar
          placeholder="Cari produk..."
          value={search}
          onChangeText={setSearch}
          style={{ backgroundColor: '#fff', marginBottom: 12 }}
        />
        {loading ? (
          <ActivityIndicator style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingBottom: 20 }}
            renderItem={({ item }) => (
              <Card
                style={{ marginBottom: 10, backgroundColor: '#fff' }}
                onPress={() =>
                  router.push({
                    pathname: '/(employee)/catalog/[id]',
                    params: { id: item.id },
                  })
                }
              >
                <Card.Content style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={{ width: 60, height: 60, borderRadius: 6, marginRight: 12 }} />
                  ) : null}
                  <View style={{ flex: 1 }}>
                    <Text variant="titleMedium">{item.name}</Text>
                    <Text variant="bodySmall" style={{ color: '#666' }}>{formatCurrency(item.priceCash)} (Cash)</Text>
                    <Text variant="bodySmall" style={{ color: item.stock < 5 ? '#D32F2F' : '#666' }}>
                      Stok: {item.stock} {item.stock < 5 ? '(Menipis)' : ''}
                    </Text>
                  </View>
                </Card.Content>
              </Card>
            )}
          />
        )}
      </View>
    </View>
  );
}
