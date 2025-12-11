import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput, Surface, Divider, Button } from 'react-native-paper';
import { Product, CreditSettings } from '../../types';
import { calculateCreditPrice, calculateInstallment } from '../../services/productService';

interface ProductSimulationProps {
  product: Product;
  globalSettings: CreditSettings;
}

export default function ProductSimulation({ product, globalSettings }: ProductSimulationProps) {
  const [dp, setDp] = useState('');
  const [tenor, setTenor] = useState(globalSettings.defaultTenor?.toString() || '12');
  
  const creditPrice = calculateCreditPrice(product.priceCash, product.markupPercentage, globalSettings.globalMarkupPercentage);
  
  const dpValue = parseFloat(dp) || 0;
  const tenorValue = parseInt(tenor) || 12;
  const installment = calculateInstallment(creditPrice, dpValue, tenorValue);

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

      <TextInput
        label="Tenor (Bulan)"
        value={tenor}
        onChangeText={setTenor}
        keyboardType="numeric"
        mode="outlined"
        style={styles.input}
      />

      <Divider style={styles.divider} />

      <View style={styles.result}>
        <Text variant="bodyLarge">Angsuran per Bulan:</Text>
        <Text variant="headlineSmall" style={styles.installment}>{formatCurrency(installment)}</Text>
        <Text variant="bodySmall" style={{color:'#757575'}}>x {tenorValue} bulan</Text>
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
  }
});