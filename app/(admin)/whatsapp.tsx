import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Alert, View } from 'react-native';
import { Appbar, TextInput, Button, Card, Text, ActivityIndicator, HelperText } from 'react-native-paper';
import { useRouter } from 'expo-router';
// import { GradientBackground } from '../../src/components/GradientBackground';
import { getWATemplates, saveWATemplates, WATemplates } from '../../src/services/firestore';

export default function WhatsAppSettings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<WATemplates>({
    reminder: '',
    receipt: '',
    newCredit: ''
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await getWATemplates();
      setTemplates(data);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Gagal memuat template WhatsApp');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveWATemplates(templates);
      Alert.alert('Sukses', 'Template WhatsApp berhasil disimpan');
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Gagal menyimpan template');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F2F2F2' }}>
        <Appbar.Header style={{ backgroundColor: '#fff', elevation: 2 }}>
          <Appbar.BackAction onPress={() => router.back()} />
          <Appbar.Content title="Template WhatsApp" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F2' }}>
      <Appbar.Header style={{ backgroundColor: '#fff', elevation: 2 }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Template WhatsApp" />
        <Appbar.Action icon="check" onPress={handleSave} disabled={saving} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.container}>
        <Text variant="bodyMedium" style={styles.infoText}>
          Gunakan variabel berikut untuk data dinamis: {'\n'}
          {'{nama}'} - Nama Nasabah{'\n'}
          {'{jumlah}'} - Jumlah Uang{'\n'}
          {'{tanggal}'} - Tanggal{'\n'}
          {'{sisa}'} - Sisa Utang{'\n'}
          {'{total}'} - Total Utang
        </Text>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.cardTitle}>Pengingat Jatuh Tempo</Text>
            <TextInput
              mode="outlined"
              multiline
              numberOfLines={4}
              value={templates.reminder}
              onChangeText={(text) => setTemplates(prev => ({ ...prev, reminder: text }))}
              placeholder="Contoh: Halo {nama}, tagihan Anda..."
            />
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.cardTitle}>Bukti Pembayaran</Text>
            <TextInput
              mode="outlined"
              multiline
              numberOfLines={4}
              value={templates.receipt}
              onChangeText={(text) => setTemplates(prev => ({ ...prev, receipt: text }))}
              placeholder="Contoh: Terima kasih {nama}, pembayaran..."
            />
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.cardTitle}>Info Kredit Baru</Text>
            <TextInput
              mode="outlined"
              multiline
              numberOfLines={4}
              value={templates.newCredit}
              onChangeText={(text) => setTemplates(prev => ({ ...prev, newCredit: text }))}
              placeholder="Contoh: Kredit baru disetujui..."
            />
          </Card.Content>
        </Card>

        <Button 
          mode="contained" 
          onPress={handleSave} 
          loading={saving} 
          style={styles.saveButton}
        >
          Simpan Perubahan
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoText: {
    marginBottom: 16,
    color: '#333',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
  },
  card: {
    marginBottom: 16,
    backgroundColor: 'white',
  },
  cardTitle: {
    marginBottom: 8,
    fontWeight: 'bold',
  },
  saveButton: {
    marginTop: 10,
    marginBottom: 30,
  }
});
