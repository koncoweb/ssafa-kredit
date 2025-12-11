import React, { useEffect, useState } from 'react';
import { ScrollView, View, Alert, RefreshControl } from 'react-native';
import { Appbar, List, Avatar, Text, FAB, Portal, Dialog, TextInput, Button, Card, Divider, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
// import { GradientBackground } from '../../src/components/GradientBackground';
import { getEmployees, updateEmployee, createEmployeeProfile, EmployeeData } from '../../src/services/firestore';
import { createSecondaryUser } from '../../src/services/authSdk';

export default function EmployeesManagement() {
  const router = useRouter();
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  
  // Edit Dialog State
  const [visible, setVisible] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeData | null>(null);
  const [target, setTarget] = useState('');
  const [bonus, setBonus] = useState('');
  const [internalDebt, setInternalDebt] = useState('');

  // Add Employee Dialog State
  const [addVisible, setAddVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loadingAdd, setLoadingAdd] = useState(false);

  const loadEmployees = async () => {
    try {
      const data = await getEmployees();
      setEmployees(data);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Gagal memuat data karyawan. Pastikan permission/index sudah benar.');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEmployees();
    setRefreshing(false);
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const openEditDialog = (emp: EmployeeData) => {
    setSelectedEmployee(emp);
    setTarget(emp.target?.toString() || '0');
    setBonus(emp.bonus?.toString() || '0');
    setInternalDebt(emp.internalDebt?.toString() || '0');
    setVisible(true);
  };

  const handleSave = async () => {
    if (!selectedEmployee) return;
    try {
      await updateEmployee(selectedEmployee.uid, {
        target: parseFloat(target) || 0,
        bonus: parseFloat(bonus) || 0,
        internalDebt: parseFloat(internalDebt) || 0,
      });
      setVisible(false);
      loadEmployees();
    } catch (error) {
      Alert.alert('Error', 'Gagal menyimpan perubahan');
    }
  };

  const handleAddEmployee = async () => {
    if (!newName || !newEmail || !newPassword) {
      Alert.alert('Error', 'Semua kolom wajib diisi');
      return;
    }
    setLoadingAdd(true);
    try {
      // 1. Create User in Auth (Secondary App)
      const user = await createSecondaryUser(newEmail, newPassword);
      
      // 2. Create Profile in Firestore
      await createEmployeeProfile(user.uid, newName, newEmail);

      Alert.alert('Sukses', 'Karyawan berhasil ditambahkan');
      setAddVisible(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      loadEmployees();
    } catch (error: any) {
      console.error(error);
      Alert.alert('Gagal', error.message || 'Terjadi kesalahan saat membuat akun');
    } finally {
      setLoadingAdd(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount || 0);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F2' }}>
      <Appbar.Header style={{ backgroundColor: '#fff', elevation: 2 }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Data Karyawan" />
      </Appbar.Header>

      <ScrollView 
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {employees.length === 0 ? (
          <Text style={{ textAlign: 'center', color: '#B0BEC5', marginTop: 20 }}>
            Belum ada karyawan terdaftar.
          </Text>
        ) : (
          employees.map((emp) => (
            <Card key={emp.uid} style={{ marginBottom: 12 }} mode="elevated" onPress={() => openEditDialog(emp)}>
              <Card.Content style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Avatar.Icon size={48} icon="account" style={{ backgroundColor: '#1E88E5' }} />
                <View style={{ marginLeft: 16, flex: 1 }}>
                  <Text variant="titleMedium">{emp.name || 'Tanpa Nama'}</Text>
                  <Text variant="bodySmall" style={{ color: '#757575' }}>{emp.email}</Text>
                  <Divider style={{ marginVertical: 8 }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View>
                      <Text variant="labelSmall">Target</Text>
                      <Text variant="bodyMedium" style={{ color: '#1E88E5' }}>{formatCurrency(emp.target)}</Text>
                    </View>
                    <View>
                      <Text variant="labelSmall">Capaian</Text>
                      <Text variant="bodyMedium" style={{ color: '#43A047' }}>{formatCurrency(emp.collected)}</Text>
                    </View>
                    <View>
                      <Text variant="labelSmall">Bonus</Text>
                      <Text variant="bodyMedium" style={{ color: '#FB8C00' }}>{formatCurrency(emp.bonus)}</Text>
                    </View>
                  </View>
                </View>
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Dialog Edit Karyawan */}
      <Portal>
        <Dialog visible={visible} onDismiss={() => setVisible(false)}>
          <Dialog.Title>Edit Karyawan: {selectedEmployee?.name}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Target Penagihan"
              value={target}
              onChangeText={setTarget}
              keyboardType="numeric"
              style={{ marginBottom: 10 }}
            />
            <TextInput
              label="Bonus Terkumpul"
              value={bonus}
              onChangeText={setBonus}
              keyboardType="numeric"
              style={{ marginBottom: 10 }}
            />
            <TextInput
              label="Piutang Internal (Kasbon)"
              value={internalDebt}
              onChangeText={setInternalDebt}
              keyboardType="numeric"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setVisible(false)}>Batal</Button>
            <Button onPress={handleSave}>Simpan</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Dialog Tambah Karyawan */}
      <Portal>
        <Dialog visible={addVisible} onDismiss={() => setAddVisible(false)}>
          <Dialog.Title>Tambah Karyawan Baru</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Nama Lengkap"
              value={newName}
              onChangeText={setNewName}
              style={{ marginBottom: 10 }}
            />
            <TextInput
              label="Email"
              value={newEmail}
              onChangeText={setNewEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={{ marginBottom: 10 }}
            />
            <TextInput
              label="Password"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAddVisible(false)}>Batal</Button>
            {loadingAdd ? (
              <ActivityIndicator animating={true} style={{ padding: 10 }} />
            ) : (
              <Button onPress={handleAddEmployee}>Buat Akun</Button>
            )}
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <FAB
        icon="plus"
        style={{
          position: 'absolute',
          margin: 16,
          right: 0,
          bottom: 0,
          backgroundColor: '#00E676'
        }}
        onPress={() => setAddVisible(true)}
      />
    </View>
  );
}
