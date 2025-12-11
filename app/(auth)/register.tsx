import React, { useState } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { TextInput, Button, Text, Surface, Chip } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { UserRole } from '../../src/types';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('customer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { registerEmail } = useAuthStore();
  const router = useRouter();

  const handleRegister = async () => {
    try {
      setError(null);
      if (!name || !email || !password) {
        setError('Nama, Email, dan Password wajib diisi');
        return;
      }
      setLoading(true);
      await registerEmail(email.trim(), password, role, name.trim());
      router.replace('/');
    } catch (e: any) {
      setError(e?.message || 'Registrasi gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F2' }}>
      <View style={styles.container}>
        <Surface style={styles.card} elevation={3}>
          <Image source={require('../../assets/images/icon.png')} style={styles.logo} />
          <Text variant="headlineMedium" style={styles.title}>Daftar Akun</Text>
          <Text variant="bodyMedium" style={styles.subtitle}>Buat akun baru untuk Ssafa Kredit</Text>

          <TextInput
            label="Nama Lengkap"
            value={name}
            onChangeText={setName}
            mode="outlined"
            style={styles.input}
          />

          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry
            style={styles.input}
          />

          <Text style={styles.divider}>Daftar sebagai</Text>
          <View style={styles.roleRow}>
            <Chip selected={role==='admin'} onPress={() => setRole('admin')} icon="shield-crown-outline">Admin</Chip>
            <Chip selected={role==='employee'} onPress={() => setRole('employee')} icon="account-hard-hat">Karyawan</Chip>
            <Chip selected={role==='customer'} onPress={() => setRole('customer')} icon="account">Nasabah</Chip>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button mode="contained" onPress={handleRegister} style={styles.button} loading={loading} disabled={loading} icon="account-plus">Daftar</Button>
          <Button mode="text" onPress={() => router.back()} style={styles.link}>Kembali ke Login</Button>
        </Surface>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: 'white',
  },
  title: {
    textAlign: 'center',
    marginBottom: 5,
    fontWeight: 'bold',
    color: '#1E88E5',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 20,
    color: '#757575',
  },
  input: {
    marginBottom: 15,
  },
  button: {
    marginTop: 16,
  },
  divider: {
    textAlign: 'center',
    marginVertical: 12,
    color: '#aaa',
  },
  roleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  logo: {
    width: 64,
    height: 64,
    alignSelf: 'center',
    marginBottom: 8,
  },
  link: {
    marginTop: 8,
  },
  error: {
    color: '#D32F2F',
    textAlign: 'center',
    marginVertical: 8,
  }
});

