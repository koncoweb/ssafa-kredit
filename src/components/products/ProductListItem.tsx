import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Text, Surface, IconButton, Chip, Divider } from 'react-native-paper';
import { Product } from '../../types';

interface ProductListItemProps {
  product: Product;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function ProductListItem({ product, onPress, onEdit, onDelete }: ProductListItemProps) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  };

  return (
    <Surface style={styles.container} elevation={1}>
      <TouchableOpacity style={styles.touchable} onPress={onPress}>
        <View style={styles.imageContainer}>
          {product.imageUrl && (product.imageUrl.startsWith('http') || product.imageUrl.startsWith('data:image')) ? (
            <Image 
                source={{ uri: product.imageUrl }} 
                style={styles.image} 
                resizeMode="cover"
                onError={(e) => console.log("Error loading image:", e.nativeEvent.error)}
            />
          ) : (
            <View style={[styles.image, styles.placeholderImage]}>
              <Text variant="labelMedium" style={{color: '#aaa'}}>No Img</Text>
            </View>
          )}
          {!product.active && (
            <View style={styles.inactiveOverlay}>
              <Text variant="labelSmall" style={{color: 'white', fontWeight: 'bold'}}>Nonaktif</Text>
            </View>
          )}
        </View>

        <View style={styles.infoContainer}>
          <View style={styles.headerRow}>
            <Text variant="titleMedium" numberOfLines={1} style={styles.title}>{product.name}</Text>
            {product.markupPercentage !== undefined && (
               <Chip compact style={styles.promoChip} textStyle={{fontSize: 10, color: 'white'}}>Khusus</Chip>
            )}
          </View>
          
          <Text variant="titleSmall" style={styles.price}>{formatCurrency(product.priceCash)}</Text>
          
          <View style={styles.detailsRow}>
            <Text variant="bodySmall" style={{color: product.stock < 5 ? '#D32F2F' : '#757575', fontWeight: product.stock < 5 ? 'bold' : 'normal'}}>
                Stok: {product.stock} {product.stock < 5 ? '(Menipis!)' : ''}
            </Text>
            <Text variant="bodySmall" style={{color: '#757575'}}> • </Text>
            <Text variant="bodySmall" style={{color: '#757575'}}>{product.category || 'Uncategorized'}</Text>
          </View>

          {(product.minCreditPurchase || product.creditRequirements) && (
              <View style={styles.creditInfo}>
                  <Text variant="labelSmall" style={{color: '#1976D2'}}>
                      {product.minCreditPurchase ? `Min. Kredit: ${product.minCreditPurchase} item` : ''}
                  </Text>
              </View>
          )}
        </View>
      </TouchableOpacity>

      <View style={styles.actionsContainer}>
        <IconButton icon="pencil" size={20} onPress={onEdit} />
        <IconButton icon="delete" size={20} iconColor="#D32F2F" onPress={onDelete} />
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
    marginHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  touchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageContainer: {
    width: 80,
    height: 80,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inactiveOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontWeight: 'bold',
    flex: 1,
    marginRight: 8,
  },
  promoChip: {
    backgroundColor: '#FF9800',
    height: 24,
  },
  price: {
    color: '#1E88E5',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  creditInfo: {
      marginTop: 4,
  },
  actionsContainer: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    borderLeftWidth: 1,
    borderLeftColor: '#f0f0f0',
  }
});
