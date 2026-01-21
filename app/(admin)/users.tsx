import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { ActivityIndicator, Appbar, Button, Card, Chip, Divider, Menu, Searchbar, Text } from 'react-native-paper';
import { changeUserRole, getAllUsers, UserDoc } from '../../src/services/firestore';
import { useAuthStore } from '../../src/store/authStore';

const roles: UserDoc['role'][] = ['admin', 'employee', 'customer'];

export default function AdminUsersManagement() {
  const router = useRouter();
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleMenuOpen, setRoleMenuOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const currentUser = useAuthStore(state => state.user);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await getAllUsers();
      setUsers(data);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Gagal memuat data users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter(u => 
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q)
    );
  }, [users, search]);

  const handleChangeRole = async (uid: string, newRole: UserDoc['role']) => {
    if (currentUser?.id === uid && newRole !== 'admin') {
      Alert.alert('Proteksi', 'Anda tidak dapat menurunkan peran Anda sendiri.');
      return;
    }
    setSaving(true);
    try {
      await changeUserRole(uid, newRole, currentUser?.id || 'admin', currentUser?.name || 'Admin');
      setRoleMenuOpen(null);
      await loadUsers();
    } catch (e: any) {
      Alert.alert('Gagal', e.message || 'Tidak bisa mengubah role user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F2' }}>
      <Appbar.Header style={{ backgroundColor: '#fff', elevation: 2 }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Manajemen Users (Role)" />
      </Appbar.Header>
      <View style={{ padding: 12 }}>
        <Searchbar
          placeholder="Cari nama, email, atau role..."
          value={search}
          onChangeText={setSearch}
          style={{ backgroundColor: '#fff', marginBottom: 12 }}
        />
        {loading ? (
          <ActivityIndicator style={{ marginTop: 20 }} />
        ) : filtered.length === 0 ? (
          <Text style={{ textAlign: 'center', marginTop: 20, color: '#666' }}>Tidak ada user</Text>
        ) : (
          filtered.map(u => (
            <Card key={u.uid} style={{ marginBottom: 10, backgroundColor: '#fff' }}>
              <Card.Content style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text variant="titleMedium">{u.name || 'Tanpa Nama'}</Text>
                  <Text variant="bodySmall" style={{ color: '#666' }}>{u.email || u.uid}</Text>
                  {u.role === 'employee' ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                      <Chip style={{ backgroundColor: '#F3E5F5', marginRight: 8 }} icon="percent">
                        {typeof u.profitSharePercentage === 'number' ? u.profitSharePercentage : 0}%
                      </Chip>
                    </View>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Menu
                    visible={roleMenuOpen === u.uid}
                    onDismiss={() => setRoleMenuOpen(null)}
                    anchor={
                      <Chip
                        onPress={() => setRoleMenuOpen(u.uid)}
                        icon={u.role === 'admin' ? 'shield-crown' : u.role === 'employee' ? 'account-hard-hat' : 'account'}
                        style={{ backgroundColor: '#E3F2FD' }}
                      >
                        {u.role}
                      </Chip>
                    }
                  >
                    <Text style={{ paddingHorizontal: 16, paddingTop: 8 }}>Ubah Role</Text>
                    <Divider />
                    {roles.map(r => (
                      <Menu.Item
                        key={r}
                        title={r}
                        leadingIcon={r === 'admin' ? 'shield-crown' : r === 'employee' ? 'account-hard-hat' : 'account'}
                        onPress={() => handleChangeRole(u.uid, r)}
                      />
                    ))}
                  </Menu>
                </View>
              </Card.Content>
              {saving && roleMenuOpen === u.uid ? <ActivityIndicator style={{ marginBottom: 8 }} /> : null}
            </Card>
          ))
        )}
        <Button mode="contained-tonal" onPress={loadUsers} style={{ marginTop: 8 }}>Refresh</Button>
      </View>
    </View>
  );
}
