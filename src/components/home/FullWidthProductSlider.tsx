import React, { useEffect, useRef, useState } from 'react';
import { View, Image, Dimensions, FlatList, TouchableOpacity } from 'react-native';
import { IconButton, Text } from 'react-native-paper';
import { getFeaturedProducts } from '../../services/productService';
import { Product } from '../../types';
import { useRouter } from 'expo-router';

export function FullWidthProductSlider() {
  const [products, setProducts] = useState<Product[]>([]);
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<any>>(null);
  const router = useRouter();
  const { width } = Dimensions.get('window');
  const height = Math.min(260, Math.round(width * 0.5));

  useEffect(() => {
    (async () => {
      const data = await getFeaturedProducts(8);
      setProducts(data);
    })();
  }, []);

  const goTo = (i: number) => {
    const clamped = Math.max(0, Math.min(i, products.length - 1));
    setIndex(clamped);
    listRef.current?.scrollToIndex({ index: clamped, animated: true });
  };

  return (
    <View style={{ position:'relative', width: '100%', height, marginTop: 8 }}>
      <FlatList
        ref={listRef}
        data={products}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const offsetX = e.nativeEvent.contentOffset.x;
          const i = Math.round(offsetX / width);
          setIndex(i);
        }}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => router.push('/(customer)/products/[id]' as any, { id: item.id } as any)}
            accessibilityLabel={`Slide produk ${item.name}`}
          >
            <View style={{ width, height }}>
              <Image source={{ uri: item.imageUrl || '' }} style={{ width, height }} resizeMode="cover" />
              <View style={{ position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(0,0,0,0.25)' }} />
              <View style={{ position:'absolute', left:16, bottom:16, paddingHorizontal:12, paddingVertical:8, backgroundColor:'rgba(255,255,255,0.75)', borderRadius:6 }}>
                <Text variant="titleMedium" style={{ fontWeight:'bold' }}>{item.name}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
      <IconButton
        icon="chevron-left"
        onPress={() => goTo(index - 1)}
        style={{ position:'absolute', left: 8, top: height/2 - 20, backgroundColor:'rgba(255,255,255,0.7)' }}
        accessibilityLabel="Slide sebelumnya"
      />
      <IconButton
        icon="chevron-right"
        onPress={() => goTo(index + 1)}
        style={{ position:'absolute', right: 8, top: height/2 - 20, backgroundColor:'rgba(255,255,255,0.7)' }}
        accessibilityLabel="Slide berikutnya"
      />
    </View>
  );
}
