import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Image, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Appbar, Button, Chip, Dialog, Divider, FAB, IconButton, Menu, Portal, Searchbar, Snackbar, Text, TextInput } from 'react-native-paper';
import ProductListItem from '../../../src/components/products/ProductListItem';
import { createProduct, deleteProduct, getProducts, getProductStockHistory, updateProduct, updateProductStock } from '../../../src/services/productService';
import { useAuthStore } from '../../../src/store/authStore';
import { Product, StockHistory } from '../../../src/types';


const PRODUCT_CATEGORIES = [
  "Elektronik",
  "Handphone & Tablet",
  "Komputer & Laptop",
  "Fashion Pria",
  "Fashion Wanita",
  "Ibu & Bayi",
  "Rumah Tangga",
  "Kecantikan",
  "Kesehatan",
  "Olahraga",
  "Otomotif",
  "Hobi & Koleksi",
  "Makanan & Minuman",
  "Perlengkapan Sekolah",
  "Lainnya"
];

export default function AdminProductListScreen() {
  const router = useRouter();
  const user = useAuthStore(state => state.user);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filter & Sort State
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'stock'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Add/Edit Dialog State
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newStock, setNewStock] = useState('10');
  const [newDesc, setNewDesc] = useState('');
  const [newImage, setNewImage] = useState<string | null>(null);
  const [newMarkup, setNewMarkup] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [categoryMenuVisible, setCategoryMenuVisible] = useState(false);
  const [filterCategoryMenuVisible, setFilterCategoryMenuVisible] = useState(false);
  const [newMinCredit, setNewMinCredit] = useState('');
  const [newRequirements, setNewRequirements] = useState('');
  const [newExpiry, setNewExpiry] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [newActive, setNewActive] = useState(true);

  const [loadingSave, setLoadingSave] = useState(false);
  
  // Feedback State
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarError, setSnackbarError] = useState(false);

  // Stock History State
  const [historyDialogVisible, setHistoryDialogVisible] = useState(false);
  const [stockHistory, setStockHistory] = useState<StockHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedProductForHistory, setSelectedProductForHistory] = useState<Product | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadStockHistory = async (product: Product) => {
    setSelectedProductForHistory(product);
    setHistoryDialogVisible(true);
    setLoadingHistory(true);
    try {
        const history = await getProductStockHistory(product.id);
        setStockHistory(history);
    } catch (e) {
        console.error(e);
        Alert.alert("Error", "Gagal memuat riwayat stok");
    } finally {
        setLoadingHistory(false);
    }
  };

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

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const formatted = selectedDate.toISOString().split('T')[0]; // YYYY-MM-DD
      setNewExpiry(formatted);
    }
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
        // Handle Stock Update with History
        if (stock !== editingProduct.stock) {
             await updateProductStock(
                editingProduct.id, 
                stock, 
                user?.id || 'admin', 
                'Update Manual via Admin',
                user?.name || 'Admin'
             );
             delete productData.stock; 
        }

        await updateProduct(editingProduct.id, productData);
        setSnackbarMessage('Produk berhasil diperbarui');
      } else {
        await createProduct(productData, user?.id || 'admin', user?.name || 'Admin');
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
            } catch (error) {
              console.error(error);
              setSnackbarMessage('Gagal menghapus produk');
              setSnackbarError(true);
              setSnackbarVisible(true);
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
                  <Menu
                      visible={filterCategoryMenuVisible}
                      onDismiss={() => setFilterCategoryMenuVisible(false)}
                      anchor={
                          <TouchableOpacity onPress={() => setFilterCategoryMenuVisible(true)}>
                              <TextInput 
                                  label="Kategori" 
                                  value={categoryFilter} 
                                  mode="outlined" 
                                  style={{marginBottom: 12}} 
                                  editable={false}
                                  right={<TextInput.Icon icon="chevron-down" onPress={() => setFilterCategoryMenuVisible(true)} />}
                              />
                          </TouchableOpacity>
                      }
                  >
                      <Menu.Item onPress={() => { setCategoryFilter(''); setFilterCategoryMenuVisible(false); }} title="Semua Kategori" />
                      <Divider />
                      {PRODUCT_CATEGORIES.map((cat) => (
                          <Menu.Item key={cat} onPress={() => { setCategoryFilter(cat); setFilterCategoryMenuVisible(false); }} title={cat} />
                      ))}
                  </Menu>

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
                    {editingProduct && (
                        <Button 
                            mode="outlined" 
                            icon="history" 
                            onPress={() => {
                                setDialogVisible(false); // Close edit dialog
                                loadStockHistory(editingProduct);
                            }}
                            style={{marginBottom: 16, borderColor: '#1976D2'}}
                            textColor="#1976D2"
                        >
                            Lihat Riwayat Stok
                        </Button>
                    )}

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

                    <Menu
                        visible={categoryMenuVisible}
                        onDismiss={() => setCategoryMenuVisible(false)}
                        anchor={
                            <TouchableOpacity onPress={() => setCategoryMenuVisible(true)}>
                                <TextInput 
                                    label="Kategori" 
                                    value={newCategory} 
                                    mode="outlined" 
                                    style={styles.input} 
                                    placeholder="Pilih Kategori" 
                                    editable={false}
                                    right={<TextInput.Icon icon="chevron-down" onPress={() => setCategoryMenuVisible(true)} />}
                                />
                            </TouchableOpacity>
                        }
                    >
                        {PRODUCT_CATEGORIES.map((cat) => (
                            <Menu.Item key={cat} onPress={() => { setNewCategory(cat); setCategoryMenuVisible(false); }} title={cat} />
                        ))}
                    </Menu>
                    
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
                    
                    <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                        <TextInput 
                            label="Masa Berlaku / Expired" 
                            value={newExpiry} 
                            mode="outlined" 
                            style={styles.input} 
                            placeholder="YYYY-MM-DD" 
                            editable={false}
                            right={<TextInput.Icon icon="calendar" onPress={() => setShowDatePicker(true)} />}
                        />
                    </TouchableOpacity>
                    {showDatePicker && (
                        <DateTimePicker
                            testID="dateTimePicker"
                            value={newExpiry ? new Date(newExpiry) : new Date()}
                            mode="date"
                            display="default"
                            onChange={onDateChange}
                        />
                    )}
                    
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

      {/* Stock History Dialog */}
      <Portal>
          <Dialog visible={historyDialogVisible} onDismiss={() => setHistoryDialogVisible(false)} style={{maxHeight: '80%'}}>
              <Dialog.Title>Riwayat Stok: {selectedProductForHistory?.name}</Dialog.Title>
              <Dialog.Content>
                  {loadingHistory ? (
                      <ActivityIndicator size="large" style={{marginVertical: 20}} />
                  ) : (
                      <FlatList
                          data={stockHistory}
                          keyExtractor={item => item.id}
                          renderItem={({item}) => (
                              <View style={{borderBottomWidth: 1, borderBottomColor: '#eee', paddingVertical: 8}}>
                                  <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                                      <Text variant="bodyMedium" style={{fontWeight:'bold'}}>
                                          {item.type === 'transaction' ? 'Transaksi' : 
                                           item.type === 'restock' ? 'Stok Awal/Restock' : 'Penyesuaian Manual'}
                                      </Text>
                                      <Text variant="bodyMedium" style={{
                                          color: item.changeAmount > 0 ? '#4CAF50' : '#F44336',
                                          fontWeight: 'bold'
                                      }}>
                                          {item.changeAmount > 0 ? '+' : ''}{item.changeAmount}
                                      </Text>
                                  </View>
                                  <Text variant="bodySmall" style={{color:'#666'}}>
                                      {item.createdAt instanceof Date ? item.createdAt.toLocaleString() : 'Baru saja'}
                                  </Text>
                                  <View style={{flexDirection:'row', justifyContent:'space-between', marginTop: 4}}>
                                      <Text variant="bodySmall">Stok: {item.oldStock} ➔ {item.newStock}</Text>
                                      <Text variant="bodySmall" style={{color:'#666', fontStyle:'italic'}}>{item.notes || '-'}</Text>
                                  </View>
                              </View>
                          )}
                          ListEmptyComponent={<Text style={{textAlign:'center', marginTop: 20}}>Belum ada riwayat.</Text>}
                      />
                  )}
              </Dialog.Content>
              <Dialog.Actions>
                  <Button onPress={() => setHistoryDialogVisible(false)}>Tutup</Button>
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
