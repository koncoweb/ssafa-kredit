import React from 'react';
import { StyleSheet } from 'react-native';
import { Card, Chip, Text } from 'react-native-paper';
import { Product } from '../../types';

interface ProductCardProps {
  product: Product;
  onPress: () => void;
  showStock?: boolean;
}

export default function ProductCard({ product, onPress, showStock = true }: ProductCardProps) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(val);
  };

  return (
    <Card style={styles.card} onPress={onPress}>
      {product.imageUrl && <Card.Cover source={{ uri: product.imageUrl }} style={styles.image} />}
      <Card.Content style={styles.content}>
        <Text variant="titleMedium" numberOfLines={2} style={styles.title}>{product.name}</Text>
        <Text variant="titleLarge" style={styles.price}>{formatCurrency(product.priceCash)}</Text>
        {showStock && (
            <Chip icon="package-variant" compact textStyle={{fontSize: 12}}>Stok: {product.stock}</Chip>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    marginHorizontal: 16,
    backgroundColor: 'white',
  },
  image: {
    height: 150,
  },
  content: {
    paddingVertical: 12,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  price: {
    color: '#1E88E5',
    fontWeight: 'bold',
    marginBottom: 8,
  }
});