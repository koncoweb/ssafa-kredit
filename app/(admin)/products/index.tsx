import React, { useEffect, useState, useMemo } from 'react';
import { View, FlatList, RefreshControl, Alert, Image, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Appbar, ActivityIndicator, Text, FAB, Portal, Dialog, TextInput, Button, Searchbar, Chip, Menu, Divider, IconButton, SegmentedButtons, HelperText, Snackbar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Product } from '../../../src/types';
import { getProducts, createProduct, updateProduct, deleteProduct } from '../../../src/services/productService';
import ProductListItem from '../../../src/components/products/ProductListItem';

export default function AdminProductListScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'stock'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  
  // Advanced Filter State
  const [categoryFilter, setCategoryFilter] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  // Add/Edit State
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  // Form Fields
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newStock, setNewStock] = useState('10');
  const [newDesc, setNewDesc] = useState('');
  const [newImage, setNewImage] = useState<string | null>(null);
  const [newMarkup, setNewMarkup] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newMinCredit, setNewMinCredit] = useState('');
  const [newRequirements, setNewRequirements] = useState('');
  const [newExpiry, setNewExpiry] = useState('');
  const [newActive, setNewActive] = useState(true);
  
  const [loadingSave, setLoadingSave] = useState(false);
  
  // Feedback State
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarError, setSnackbarError] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const data = await getProducts(false); // Get all products
      setProducts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Filter & Sort Logic
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // Search by Name
      if (!p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      
      // Filter by Status
      if (statusFilter === 'active' && !p.active) return false;
      if (statusFilter === 'inactive' && p.active) return false;

      // Filter by Category
      if (categoryFilter && !p.category?.toLowerCase().includes(categoryFilter.toLowerCase())) return false;

      // Filter by Price
      if (minPrice && p.priceCash < parseFloat(minPrice)) return false;
      if (maxPrice && p.priceCash > parseFloat(maxPrice)) return false;

      return true;
    }).sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'price') {
        comparison = a.priceCash - b.priceCash;
      } else if (sortBy === 'stock') {
        comparison = a.stock - b.stock;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [products, searchQuery, statusFilter, sortBy, sortOrder, categoryFilter, minPrice, maxPrice]);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setNewImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const openAddDialog = () => {
    setEditingProduct(null);
    resetForm();
    setDialogVisible(true);
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setNewName(product.name);
    setNewPrice(product.priceCash.toString());
    setNewStock(product.stock.toString());
    setNewDesc(product.description || '');
    setNewImage(product.imageUrl || null);
    setNewMarkup(product.markupPercentage?.toString() || '');
    setNewCategory(product.category || '');
    setNewMinCredit(product.minCreditPurchase?.toString() || '');
    setNewRequirements(product.creditRequirements || '');
    setNewExpiry(product.expiryDate || '');
    setNewActive(product.active);
    setDialogVisible(true);
  };

  const resetForm = () => {
    setNewName(''); setNewPrice(''); setNewStock('10'); setNewDesc(''); 
    setNewImage(null); setNewMarkup(''); setNewCategory(''); 
    setNewMinCredit(''); setNewRequirements(''); setNewExpiry('');
    setNewActive(true);
  };

  const handleSave = async () => {
    if (!newName || !newPrice) {
      setSnackbarMessage('Nama dan Harga wajib diisi');
      setSnackbarError(true);
      setSnackbarVisible(true);
      return;
    }
    
    setLoadingSave(true);
    try {
      const price = parseFloat(newPrice);
      const stock = parseInt(newStock) || 0;
      // Use null for optional numeric fields when empty to avoid "undefined" error in Firestore
      const markup = newMarkup ? parseFloat(newMarkup) : null;
      const minCredit = newMinCredit ? parseInt(newMinCredit) : null;

      if (isNaN(price)) throw new Error("Harga harus berupa angka");

      const productData: any = {
        name: newName,
        priceCash: price,
        stock: stock,
        description: newDesc || null,
        active: newActive,
        category: newCategory || null,
        minCreditPurchase: minCredit,
        creditRequirements: newRequirements || null,
        expiryDate: newExpiry || null,
        markupPercentage: markup,
      };

      if (newImage) {
        productData.imageUrl = newImage;
      } else {
        productData.imageUrl = null; 
      }

      // Remove keys with undefined values just in case (though we tried to use null)
      Object.keys(productData).forEach(key => productData[key] === undefined && delete productData[key]);

      if (editingProduct) {
        await updateProduct(editingProduct.id, productData);
        setSnackbarMessage('Produk berhasil diperbarui');
      } else {
        await createProduct(productData);
        setSnackbarMessage('Produk berhasil ditambahkan');
      }

      setSnackbarError(false);
      setSnackbarVisible(true);
      setDialogVisible(false);
      loadProducts();
    } catch (e: any) {
      console.error("Save error:", e);
      setSnackbarMessage(e.message || "Terjadi kesalahan");
      setSnackbarError(true);
      setSnackbarVisible(true);
    } finally {
      setLoadingSave(false);
    }
  };

  const handleDelete = (product: Product) => {
    Alert.alert(
      'Hapus Produk',
      `Yakin ingin menghapus ${product.name}?`,
      [
        { text: 'Batal', style: 'cancel' },
        { 
          text: 'Hapus', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProduct(product.id);
              loadProducts();
            } catch (e) {
              Alert.alert('Error', 'Gagal menghapus produk');
            }
          }
        }
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F2' }}>
      <Appbar.Header style={{ backgroundColor: '#fff', elevation: 2 }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Manajemen Produk" />
        <Appbar.Action icon="filter-variant" onPress={() => setShowFilterDialog(true)} />
      </Appbar.Header>

      <View style={{ padding: 16, backgroundColor: '#fff', paddingBottom: 8 }}>
        <Searchbar
          placeholder="Cari produk..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={{ marginBottom: 12, backgroundColor: '#f5f5f5' }}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
           <View style={{flexDirection: 'row'}}>
             <Chip 
                selected={statusFilter === 'all'} 
                onPress={() => setStatusFilter('all')} 
                style={{marginRight: 8}}
                showSelectedOverlay
             >Semua</Chip>
             <Chip 
                selected={statusFilter === 'active'} 
                onPress={() => setStatusFilter('active')} 
                style={{marginRight: 8}}
                showSelectedOverlay
             >Aktif</Chip>
              <Chip 
                selected={statusFilter === 'inactive'} 
                onPress={() => setStatusFilter('inactive')} 
                showSelectedOverlay
             >Nonaktif</Chip>
           </View>
        </View>
      </View>
      
      <View style={styles.sortContainer}>
          <Text variant="bodySmall" style={{marginRight: 8}}>Urutkan:</Text>
          <TouchableOpacity onPress={() => setSortBy('name')}>
              <Text style={[styles.sortLink, sortBy === 'name' && styles.sortLinkActive]}>Nama</Text>
          </TouchableOpacity>
          <Text style={styles.sortSeparator}>|</Text>
          <TouchableOpacity onPress={() => setSortBy('price')}>
              <Text style={[styles.sortLink, sortBy === 'price' && styles.sortLinkActive]}>Harga</Text>
          </TouchableOpacity>
          <Text style={styles.sortSeparator}>|</Text>
          <TouchableOpacity onPress={() => setSortBy('stock')}>
              <Text style={[styles.sortLink, sortBy === 'stock' && styles.sortLinkActive]}>Stok</Text>
          </TouchableOpacity>
          
          <IconButton 
            icon={sortOrder === 'asc' ? "arrow-up" : "arrow-down"} 
            size={16} 
            onPress={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
          />
      </View>

      {loading ? (
        <View style={{flex:1, justifyContent:'center'}}><ActivityIndicator /></View>
      ) : (
        <FlatList
            data={filteredProducts}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingVertical: 8 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); loadProducts();}} />}
            renderItem={({ item }) => (
                <ProductListItem 
                    product={item}
                    onPress={() => openEditDialog(item)}
                    onEdit={() => openEditDialog(item)}
                    onDelete={() => handleDelete(item)}
                />
            )}
            ListEmptyComponent={<Text style={{textAlign:'center', marginTop: 32, color: '#888'}}>Tidak ada produk ditemukan</Text>}
        />
      )}

      {/* Filter Dialog */}
      <Portal>
          <Dialog visible={showFilterDialog} onDismiss={() => setShowFilterDialog(false)}>
              <Dialog.Title>Filter Lanjutan</Dialog.Title>
              <Dialog.Content>
                  <TextInput label="Kategori" value={categoryFilter} onChangeText={setCategoryFilter} mode="outlined" style={{marginBottom: 12}} />
                  <View style={{flexDirection: 'row', gap: 10}}>
                      <TextInput label="Min Harga" value={minPrice} onChangeText={setMinPrice} keyboardType="numeric" mode="outlined" style={{flex: 1}} />
                      <TextInput label="Max Harga" value={maxPrice} onChangeText={setMaxPrice} keyboardType="numeric" mode="outlined" style={{flex: 1}} />
                  </View>
              </Dialog.Content>
              <Dialog.Actions>
                  <Button onPress={() => {setCategoryFilter(''); setMinPrice(''); setMaxPrice('');}}>Reset</Button>
                  <Button onPress={() => setShowFilterDialog(false)}>Terapkan</Button>
              </Dialog.Actions>
          </Dialog>
      </Portal>

      {/* Add/Edit Dialog */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)} style={{maxHeight: '80%'}}>
            <Dialog.Title>{editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}</Dialog.Title>
            <Dialog.ScrollArea>
                <ScrollView contentContainerStyle={{paddingTop: 10}}>
                    <TouchableOpacity onPress={pickImage} style={styles.imagePicker}>
                      {newImage && (newImage.startsWith('http') || newImage.startsWith('data:image')) ? (
                        <Image source={{ uri: newImage }} style={{ width: '100%', height: 150, borderRadius: 8 }} resizeMode="contain" />
                      ) : (
                        <View style={{ alignItems: 'center' }}>
                            <Text variant="bodyLarge" style={{color:'#757575'}}>+ Upload Gambar</Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    <TextInput label="Nama Produk *" value={newName} onChangeText={setNewName} mode="outlined" style={styles.input} />
                    
                    <View style={{flexDirection:'row', gap: 8}}>
                        <TextInput label="Harga Cash *" value={newPrice} onChangeText={setNewPrice} keyboardType="numeric" mode="outlined" style={[styles.input, {flex:1}]} left={<TextInput.Affix text="Rp " />} />
                        <TextInput label="Stok *" value={newStock} onChangeText={setNewStock} keyboardType="numeric" mode="outlined" style={[styles.input, {flex:0.5}]} />
                    </View>

                    <TextInput label="Kategori" value={newCategory} onChangeText={setNewCategory} mode="outlined" style={styles.input} placeholder="Elektronik, Furniture, dll" />
                    
                    <TextInput 
                        label="Markup Kredit Khusus (%)" 
                        value={newMarkup} 
                        onChangeText={setNewMarkup} 
                        keyboardType="numeric" 
                        mode="outlined" 
                        placeholder="Kosongkan untuk ikut global"
                        style={styles.input}
                    />

                    <Divider style={{marginVertical: 8}} />
                    <Text variant="titleSmall" style={{marginBottom: 8, color: '#1976D2'}}>Info Tambahan (Opsional)</Text>

                    <TextInput label="Min. Pembelian Kredit (item)" value={newMinCredit} onChangeText={setNewMinCredit} keyboardType="numeric" mode="outlined" style={styles.input} />
                    <TextInput label="Persyaratan Kredit Khusus" value={newRequirements} onChangeText={setNewRequirements} mode="outlined" style={styles.input} multiline />
                    <TextInput label="Masa Berlaku / Expired" value={newExpiry} onChangeText={setNewExpiry} mode="outlined" style={styles.input} placeholder="YYYY-MM-DD" />
                    
                    <TextInput label="Deskripsi" value={newDesc} onChangeText={setNewDesc} mode="outlined" numberOfLines={3} multiline style={styles.input} />
                    
                    <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 8}}>
                        <Text>Status Aktif: </Text>
                        <Button mode={newActive ? "contained" : "outlined"} onPress={() => setNewActive(!newActive)} compact>
                            {newActive ? "Aktif" : "Nonaktif"}
                        </Button>
                    </View>
                </ScrollView>
            </Dialog.ScrollArea>
            <Dialog.Actions>
                <Button onPress={() => setDialogVisible(false)}>Batal</Button>
                <Button onPress={handleSave} loading={loadingSave} mode="contained">Simpan</Button>
            </Dialog.Actions>
        </Dialog>
      </Portal>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={openAddDialog}
      />
      
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        style={{ backgroundColor: snackbarError ? '#D32F2F' : '#323232' }}
        action={{
          label: 'Tutup',
          onPress: () => {
            setSnackbarVisible(false);
          },
        }}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
        backgroundColor: '#00E676',
    },
    input: {
        marginBottom: 10,
        backgroundColor: '#fff',
    },
    imagePicker: {
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#ccc',
        borderStyle: 'dashed',
        borderRadius: 8,
        padding: 20,
        backgroundColor: '#fafafa'
    },
    sortContainer: {
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingHorizontal: 16, 
        paddingBottom: 8,
        backgroundColor: '#fff'
    },
    sortLink: {
        color: '#757575',
        fontWeight: '500',
    },
    sortLinkActive: {
        color: '#2196F3',
        fontWeight: 'bold',
    },
    sortSeparator: {
        marginHorizontal: 8,
        color: '#e0e0e0',
    }
});
