import React, { useEffect, useState, useRef } from 'react';
import { View, FlatList, Dimensions, TouchableOpacity } from 'react-native';
import { Card, Text, ActivityIndicator, IconButton } from 'react-native-paper';
import { getFeaturedProducts } from '../../services/productService';
import { Product } from '../../types';
import { useRouter } from 'expo-router';

export function ProductSlider() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<any>>(null);
  const router = useRouter();
  const width = Dimensions.get('window').width;
  const itemWidth = Math.min(width - 48, 360);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await getFeaturedProducts(8);
        setProducts(data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const goTo = (i: number) => {
    const clamped = Math.max(0, Math.min(i, products.length - 1));
    setIndex(clamped);
    listRef.current?.scrollToIndex({ index: clamped, animated: true });
  };

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 12 }} />;
  }

  return (
    <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
      <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
        <Text variant="titleMedium">Katalog Pilihan</Text>
        <TouchableOpacity onPress={() => router.push('/(customer)/products' as any)}>
          <Text style={{ color: '#1565C0' }}>Lihat Semua</Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection:'row', alignItems:'center', marginTop: 8 }}>
        <IconButton icon="chevron-left" onPress={() => goTo(index - 1)} accessibilityLabel="Produk sebelumnya" />
        <FlatList
          ref={listRef}
          data={products}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const offsetX = e.nativeEvent.contentOffset.x;
            const w = itemWidth + 12;
            const i = Math.round(offsetX / w);
            setIndex(i);
          }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={{ width: itemWidth, marginRight: 12 }}
              onPress={() => router.push('/(customer)/products/[id]' as any, { id: item.id } as any)}
              accessibilityLabel={`Produk ${item.name}`}
            >
              <Card>
                <Card.Cover source={{ uri: item.imageUrl || '' }} />
                <Card.Content>
                  <Text variant="titleMedium">{item.name}</Text>
                  <Text variant="bodySmall" style={{ color: '#1565C0', fontWeight:'bold' }}>
                    Rp {(item.priceCash || 0).toLocaleString('id-ID')}
                  </Text>
                </Card.Content>
              </Card>
            </TouchableOpacity>
          )}
        />
        <IconButton icon="chevron-right" onPress={() => goTo(index + 1)} accessibilityLabel="Produk berikutnya" />
      </View>
      <View style={{ flexDirection:'row', justifyContent:'center', marginTop: 4 }}>
        {products.map((_, i) => (
          <View key={i} style={{
            width: 8, height: 8, borderRadius: 4,
            marginHorizontal: 3,
            backgroundColor: i === index ? '#1565C0' : '#B0BEC5'
          }} />
        ))}
      </View>
    </View>
  );
}
