import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, Divider, SegmentedButtons, Surface, Text, TextInput } from 'react-native-paper';
import { calculateCreditPrice, calculateInstallment } from '../../services/productService';
import { CreditSettings, Product } from '../../types';

interface ProductSimulationProps {
  product: Product;
  globalSettings: CreditSettings;
}

export default function ProductSimulation({ product, globalSettings }: ProductSimulationProps) {
  const [dp, setDp] = useState('');
  const [installType, setInstallType] = useState('monthly'); // 'monthly' | 'weekly'
  const [selectedTenor, setSelectedTenor] = useState<number>(0);
  
  const creditPrice = calculateCreditPrice(product.priceCash, product.markupPercentage, globalSettings.globalMarkupPercentage);
  const dpValue = parseFloat(dp) || 0;

  // Available Tenors based on Settings or Default
  const weeklyTenors = globalSettings.availableTenors?.weekly || [4, 8, 12, 16];
  const monthlyTenors = globalSettings.availableTenors?.monthly || [3, 6, 9, 12];
  
  const currentTenors = installType === 'weekly' ? weeklyTenors : monthlyTenors;

  // Set default tenor if not selected
  React.useEffect(() => {
      if (!currentTenors.includes(selectedTenor)) {
          setSelectedTenor(currentTenors[0]);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installType]);

  const installment = calculateInstallment(creditPrice, dpValue, selectedTenor);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(val);
  };

  return (
    <Surface style={styles.container} elevation={2}>
      <Text variant="titleMedium" style={styles.header}>Simulasi Kredit</Text>
      
      <View style={styles.row}>
        <Text variant="bodyMedium">Harga Cash</Text>
        <Text variant="bodyLarge" style={{fontWeight:'bold'}}>{formatCurrency(product.priceCash)}</Text>
      </View>

      <View style={styles.row}>
        <Text variant="bodyMedium">Harga Kredit</Text>
        <Text variant="bodyLarge" style={{fontWeight:'bold', color: '#D32F2F'}}>{formatCurrency(creditPrice)}</Text>
      </View>
      
      <Divider style={styles.divider} />

      <TextInput
        label="Uang Muka (DP)"
        value={dp}
        onChangeText={setDp}
        keyboardType="numeric"
        mode="outlined"
        style={styles.input}
        left={<TextInput.Affix text="Rp " />}
      />

      <Text variant="labelMedium" style={{marginBottom: 8}}>Pilih Tipe Cicilan</Text>
      <SegmentedButtons
        value={installType}
        onValueChange={setInstallType}
        buttons={[
          { value: 'weekly', label: 'Mingguan' },
          { value: 'monthly', label: 'Bulanan' },
        ]}
        style={{marginBottom: 16}}
      />

      <Text variant="labelMedium" style={{marginBottom: 8}}>Pilih Tenor ({installType === 'weekly' ? 'Minggu' : 'Bulan'})</Text>
      <View style={styles.chipRow}>
          {currentTenors.map(t => (
              <Chip 
                key={t} 
                selected={selectedTenor === t} 
                onPress={() => setSelectedTenor(t)}
                style={styles.chip}
                showSelectedOverlay
              >
                  {t}x
              </Chip>
          ))}
      </View>

      <Divider style={styles.divider} />

      <View style={styles.result}>
        <Text variant="bodyLarge">Angsuran per {installType === 'weekly' ? 'Minggu' : 'Bulan'}:</Text>
        <Text variant="headlineSmall" style={styles.installment}>{formatCurrency(installment)}</Text>
        <Text variant="bodySmall" style={{color:'#757575'}}>x {selectedTenor} kali bayar</Text>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 8,
    margin: 16,
    backgroundColor: 'white',
  },
  header: {
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center'
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  divider: {
    marginVertical: 16,
  },
  input: {
    marginBottom: 12,
    backgroundColor: 'white'
  },
  result: {
    alignItems: 'center',
  },
  installment: {
    color: '#1E88E5',
    fontWeight: 'bold',
    marginVertical: 4
  },
  chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 8
  },
  chip: {
      marginBottom: 8
  }
});