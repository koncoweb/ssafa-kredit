import React, { useState } from 'react';
import { View, StyleSheet, Image, Alert } from 'react-native';
import { TextInput, Button, Text, Surface } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginEmail } = useAuthStore();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Email dan Password wajib diisi');
      return;
    }
    
    setLoading(true);
    try {
      await loginEmail(email.trim(), password);
      router.replace('/');
    } catch (error: any) {
      console.error('Login error:', error);
      let message = 'Gagal masuk. Periksa email dan password Anda.';
      
      if (error.code === 'auth/invalid-credential') {
        message = 'Kombinasi Email dan Password salah, atau akun tidak ditemukan.';
      } else if (error.code === 'auth/user-not-found') {
        message = 'Akun dengan email ini tidak ditemukan.';
      } else if (error.code === 'auth/wrong-password') {
        message = 'Password salah.';
      } else if (error.code === 'auth/too-many-requests') {
        message = 'Terlalu banyak percobaan gagal. Silakan coba lagi nanti.';
      }
      
      Alert.alert('Gagal Login', message);
    } finally {
      setLoading(false);
    }
  };


  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F2' }}>
      <View style={styles.container}>
        <Surface style={styles.card} elevation={3}>
          <Image source={require('../../assets/images/icon.png')} style={styles.logo} />
          <Text variant="headlineMedium" style={styles.title}>Ssafa Kredit</Text>
          <Text variant="bodyMedium" style={styles.subtitle}>Masuk ke akun Anda</Text>

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


          <Button 
            mode="contained" 
            onPress={handleLogin} 
            style={styles.button} 
            icon="login" 
            loading={loading}
            disabled={loading}
          >
            Masuk
          </Button>
          <Button mode="text" onPress={() => router.push('/(auth)/register')} style={styles.link}>Daftar lewat halaman</Button>
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
  logo: {
    width: 64,
    height: 64,
    alignSelf: 'center',
    marginBottom: 8,
  },
  link: {
    marginTop: 8,
  }
});
