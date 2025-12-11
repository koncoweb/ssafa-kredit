import React, { useEffect, useState } from 'react';
import { ScrollView, View, Alert, RefreshControl } from 'react-native';
import { Appbar, Avatar, Text, FAB, Portal, Dialog, TextInput, Button, Card, Divider, ActivityIndicator, SegmentedButtons } from 'react-native-paper';
import { useRouter } from 'expo-router';
// import { GradientBackground } from '../../src/components/GradientBackground';
import { getAllCustomers, createCustomerProfile, CustomerData } from '../../src/services/firestore';
import { createSecondaryUser } from '../../src/services/authSdk';

export default function CustomersManagement() {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('new'); // 'new' | 'old'

  // Add Customer Dialog State
  const [addVisible, setAddVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [loadingAdd, setLoadingAdd] = useState(false);

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

  const handleAddCustomer = async () => {
    if (!newName || !newEmail || !newPassword) {
      Alert.alert('Error', 'Nama, Email, dan Password wajib diisi');
      return;
    }
    setLoadingAdd(true);
    try {
      const user = await createSecondaryUser(newEmail, newPassword);
      await createCustomerProfile(user.uid, {
        uid: user.uid,
        name: newName,
        email: newEmail,
        role: 'customer',
        phone: newPhone,
        address: newAddress,
        creditLimit: parseFloat(newLimit) || 0,
        currentDebt: 0
      });

      Alert.alert('Sukses', 'Nasabah berhasil ditambahkan');
      setAddVisible(false);
      // Reset form
      setNewName(''); setNewEmail(''); setNewPassword('');
      setNewPhone(''); setNewAddress(''); setNewLimit('');
      loadCustomers();
    } catch (error: any) {
      Alert.alert('Gagal', error.message || 'Terjadi kesalahan');
    } finally {
      setLoadingAdd(false);
    }
  };

  const filteredCustomers = customers.filter(c => {
    if (filter === 'new') return (c.currentDebt || 0) === 0;
    return (c.currentDebt || 0) > 0;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount || 0);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F2' }}>
      <Appbar.Header style={{ backgroundColor: '#fff', elevation: 2 }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Data Nasabah" />
      </Appbar.Header>

      <View style={{ padding: 16 }}>
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
                <Avatar.Icon size={48} icon="account-group" style={{ backgroundColor: filter === 'new' ? '#4CAF50' : '#FF9800' }} />
                <View style={{ marginLeft: 16, flex: 1 }}>
                  <Text variant="titleMedium">{cust.name}</Text>
                  <Text variant="bodySmall" style={{ color: '#757575' }}>{cust.email}</Text>
                  {cust.phone ? <Text variant="bodySmall">{cust.phone}</Text> : null}
                  <Divider style={{ marginVertical: 8 }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View>
                      <Text variant="labelSmall">Limit Kredit</Text>
                      <Text variant="bodyMedium" style={{ color: '#1E88E5' }}>{formatCurrency(cust.creditLimit)}</Text>
                    </View>
                    <View>
                      <Text variant="labelSmall">Utang Saat Ini</Text>
                      <Text variant="bodyMedium" style={{ color: '#F44336' }}>{formatCurrency(cust.currentDebt)}</Text>
                    </View>
                  </View>
                </View>
              </Card.Content>
              <Card.Actions>
                <Button onPress={() => router.push({ pathname: '/(admin)/reports', params: { customerId: cust.uid, customerName: cust.name } })}>Riwayat</Button>
              </Card.Actions>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Add Dialog */}
      <Portal>
        <Dialog visible={addVisible} onDismiss={() => setAddVisible(false)}>
          <Dialog.Title>Tambah Nasabah Baru</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView contentContainerStyle={{ paddingVertical: 10 }}>
              <TextInput label="Nama Lengkap" value={newName} onChangeText={setNewName} style={{ marginBottom: 10 }} />
              <TextInput label="Email" value={newEmail} onChangeText={setNewEmail} autoCapitalize="none" keyboardType="email-address" style={{ marginBottom: 10 }} />
              <TextInput label="Password" value={newPassword} onChangeText={setNewPassword} secureTextEntry style={{ marginBottom: 10 }} />
              <TextInput label="No. Telepon" value={newPhone} onChangeText={setNewPhone} keyboardType="phone-pad" style={{ marginBottom: 10 }} />
              <TextInput label="Alamat" value={newAddress} onChangeText={setNewAddress} style={{ marginBottom: 10 }} />
              <TextInput label="Limit Kredit (Rp)" value={newLimit} onChangeText={setNewLimit} keyboardType="numeric" />
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setAddVisible(false)}>Batal</Button>
            {loadingAdd ? <ActivityIndicator animating={true} style={{ padding: 10 }} /> : <Button onPress={handleAddCustomer}>Simpan</Button>}
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
