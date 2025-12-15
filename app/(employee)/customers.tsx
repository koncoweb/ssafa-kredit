import React, { useEffect, useState } from 'react';
import { ScrollView, View, Alert, RefreshControl } from 'react-native';
import { Appbar, Avatar, Text, FAB, Portal, Dialog, TextInput, Button, Card, Divider, ActivityIndicator, SegmentedButtons, Searchbar, IconButton } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { getAllCustomers, createCustomerProfile, CustomerData, updateCustomerProfile } from '../../src/services/firestore';
import { createSecondaryUser } from '../../src/services/authSdk';

export default function EmployeeCustomersManagement() {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('new'); // 'new' | 'old'
  const [searchQuery, setSearchQuery] = useState('');

  // Add/Edit Customer Dialog State
  const [dialogVisible, setDialogVisible] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newLimit, setNewLimit] = useState('');
  
  const [loadingAction, setLoadingAction] = useState(false);

  const loadCustomers = async () => {
    try {
      const data = await getAllCustomers();
      setCustomers(data);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Gagal memuat data nasabah.');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCustomers();
    setRefreshing(false);
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const openAddDialog = () => {
    setIsEditMode(false);
    setEditingId(null);
    setNewName('');
    setNewEmail('');
    setNewPassword('');
    setNewPhone('');
    setNewAddress('');
    setNewLimit('');
    setDialogVisible(true);
  };

  const openEditDialog = (cust: CustomerData) => {
    setIsEditMode(true);
    setEditingId(cust.uid);
    setNewName(cust.name);
    setNewEmail(cust.email);
    setNewPassword(''); // Password not editable directly here
    setNewPhone(cust.phone || '');
    setNewAddress(cust.address || '');
    setNewLimit(cust.creditLimit.toString());
    setDialogVisible(true);
  };

  const handleSaveCustomer = async () => {
    if (!newName || !newEmail || (!isEditMode && !newPassword) || !newPhone || !newAddress) {
      Alert.alert('Validasi Error', 'Nama, Email, Password (untuk baru), Telepon, dan Alamat wajib diisi.');
      return;
    }

    setLoadingAction(true);
    try {
      if (isEditMode && editingId) {
        // Edit Mode
        await updateCustomerProfile(editingId, {
          name: newName,
          email: newEmail,
          phone: newPhone,
          address: newAddress,
          creditLimit: parseFloat(newLimit) || 0,
        });
        Alert.alert('Sukses', 'Data nasabah berhasil diperbarui');
      } else {
        // Add Mode
        const user = await createSecondaryUser(newEmail, newPassword);
        await createCustomerProfile(user.uid, {
          uid: user.uid,
          name: newName,
          email: newEmail,
          role: 'customer',
          phone: newPhone,
          address: newAddress,
          creditLimit: parseFloat(newLimit) || 0,
          currentDebt: 0,
          totalDebt: 0
        });
        Alert.alert('Sukses', 'Nasabah baru berhasil ditambahkan');
      }

      setDialogVisible(false);
      loadCustomers();
    } catch (error: any) {
      Alert.alert('Gagal', error.message || 'Terjadi kesalahan');
    } finally {
      setLoadingAction(false);
    }
  };

  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.email.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (filter === 'new') return (c.totalDebt || 0) === 0;
    return (c.totalDebt || 0) > 0;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount || 0);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F2' }}>
      <Appbar.Header style={{ backgroundColor: '#fff', elevation: 2 }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Nasabah (Karyawan)" />
      </Appbar.Header>

      <View style={{ padding: 16, paddingBottom: 8 }}>
        <Searchbar
            placeholder="Cari Nasabah..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={{ marginBottom: 12, backgroundColor: '#fff' }}
        />
        <SegmentedButtons
          value={filter}
          onValueChange={setFilter}
          buttons={[
            { value: 'new', label: 'Nasabah Baru' },
            { value: 'old', label: 'Nasabah Lama (Aktif)' },
          ]}
        />
      </View>

      <ScrollView 
        contentContainerStyle={{ padding: 16, paddingTop: 0, paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filteredCustomers.length === 0 ? (
          <Text style={{ textAlign: 'center', color: '#757575', marginTop: 20 }}>
            Tidak ada nasabah dalam kategori ini.
          </Text>
        ) : (
          filteredCustomers.map((cust) => (
            <Card key={cust.uid} style={{ marginBottom: 12 }} mode="elevated">
              <Card.Content style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Avatar.Icon size={48} icon="account" style={{ backgroundColor: filter === 'new' ? '#4CAF50' : '#FF9800' }} />
                <View style={{ marginLeft: 16, flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                        <Text variant="titleMedium">{cust.name}</Text>
                        <Text variant="bodySmall" style={{ color: '#757575' }}>{cust.email}</Text>
                        {cust.phone ? <Text variant="bodySmall">{cust.phone}</Text> : null}
                    </View>
                    <IconButton 
                      icon="pencil" 
                      size={20} 
                      onPress={() => openEditDialog(cust)} 
                    />
                  </View>
                  
                  <Divider style={{ marginVertical: 8 }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View>
                      <Text variant="labelSmall">Limit Kredit</Text>
                      <Text variant="bodyMedium" style={{ color: '#1E88E5' }}>{formatCurrency(cust.creditLimit)}</Text>
                    </View>
                    <View>
                      <Text variant="labelSmall">Utang Saat Ini</Text>
                      <Text variant="bodyMedium" style={{ color: '#F44336' }}>{formatCurrency(cust.totalDebt)}</Text>
                    </View>
                  </View>
                </View>
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Add/Edit Dialog */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title>{isEditMode ? 'Edit Data Nasabah' : 'Tambah Nasabah Baru'}</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView contentContainerStyle={{ paddingVertical: 10 }}>
              <TextInput label="Nama Lengkap" value={newName} onChangeText={setNewName} style={{ marginBottom: 10 }} mode="outlined" />
              <TextInput label="Email" value={newEmail} onChangeText={setNewEmail} autoCapitalize="none" keyboardType="email-address" style={{ marginBottom: 10 }} mode="outlined" disabled={isEditMode} />
              {!isEditMode && (
                <TextInput label="Password" value={newPassword} onChangeText={setNewPassword} secureTextEntry style={{ marginBottom: 10 }} mode="outlined" />
              )}
              <TextInput label="No. Telepon" value={newPhone} onChangeText={setNewPhone} keyboardType="phone-pad" style={{ marginBottom: 10 }} mode="outlined" />
              <TextInput label="Alamat" value={newAddress} onChangeText={setNewAddress} style={{ marginBottom: 10 }} mode="outlined" multiline />
              <TextInput label="Limit Kredit (Rp)" value={newLimit} onChangeText={setNewLimit} keyboardType="numeric" mode="outlined" />
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Batal</Button>
            {loadingAction ? <ActivityIndicator animating={true} style={{ padding: 10 }} /> : <Button onPress={handleSaveCustomer}>Simpan</Button>}
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <FAB
        icon="plus"
        style={{ position: 'absolute', margin: 16, right: 0, bottom: 0, backgroundColor: '#00E676' }}
        onPress={openAddDialog}
      />
    </View>
  );
}
