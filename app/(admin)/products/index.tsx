import React, { useEffect, useState } from 'react';
import { View, ScrollView, RefreshControl, Alert } from 'react-native';
import { Appbar, ActivityIndicator, Text, FAB, Portal, Dialog, TextInput, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { Product } from '../../../src/types';
import { getProducts, createProduct } from '../../../src/services/productService';
import ProductCard from '../../../src/components/products/ProductCard';

export default function AdminProductListScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Add State
  const [addVisible, setAddVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newStock, setNewStock] = useState('10');
  const [newDesc, setNewDesc] = useState('');
  const [loadingAdd, setLoadingAdd] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const data = await getProducts(false); // Get all (including inactive if needed)
      setProducts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAdd = async () => {
      if (!newName || !newPrice) {
          Alert.alert('Error', 'Nama dan Harga wajib diisi');
          return;
      }
      setLoadingAdd(true);
      try {
          await createProduct({
              name: newName,
              priceCash: parseFloat(newPrice),
              stock: parseInt(newStock) || 0,
              description: newDesc,
              active: true
          });
          setAddVisible(false);
          setNewName(''); setNewPrice(''); setNewStock('10'); setNewDesc('');
          loadProducts();
          Alert.alert('Sukses', 'Produk berhasil ditambahkan');
      } catch (e: any) {
          Alert.alert('Gagal', e.message);
      } finally {
          setLoadingAdd(false);
      }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F2' }}>
      <Appbar.Header style={{ backgroundColor: '#fff' }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Manajemen Produk" />
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
                onPress={() => { /* Edit feature coming soon */ }} 
              />
            ))
          )}
        </ScrollView>
      )}

      <Portal>
        <Dialog visible={addVisible} onDismiss={() => setAddVisible(false)}>
            <Dialog.Title>Tambah Produk Baru</Dialog.Title>
            <Dialog.ScrollArea>
                <ScrollView contentContainerStyle={{paddingTop: 10}}>
                    <TextInput label="Nama Produk" value={newName} onChangeText={setNewName} mode="outlined" style={{marginBottom: 10}} />
                    <TextInput label="Harga Cash" value={newPrice} onChangeText={setNewPrice} keyboardType="numeric" mode="outlined" left={<TextInput.Affix text="Rp " />} style={{marginBottom: 10}} />
                    <TextInput label="Stok" value={newStock} onChangeText={setNewStock} keyboardType="numeric" mode="outlined" style={{marginBottom: 10}} />
                    <TextInput label="Deskripsi" value={newDesc} onChangeText={setNewDesc} mode="outlined" numberOfLines={3} multiline />
                </ScrollView>
            </Dialog.ScrollArea>
            <Dialog.Actions>
                <Button onPress={() => setAddVisible(false)}>Batal</Button>
                <Button onPress={handleAdd} loading={loadingAdd}>Simpan</Button>
            </Dialog.Actions>
        </Dialog>
      </Portal>

      <FAB
        icon="plus"
        style={{ position: 'absolute', margin: 16, right: 0, bottom: 0, backgroundColor: '#00E676' }}
        onPress={() => setAddVisible(true)}
      />
    </View>
  );
}