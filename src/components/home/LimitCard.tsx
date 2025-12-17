import React, { useEffect, useState } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useAuthStore } from '../../store/authStore';
import { getCustomerData } from '../../services/firestore';

export function LimitCard() {
  const { isAuthenticated, user } = useAuthStore();
  const [hover, setHover] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creditLimit, setCreditLimit] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (isAuthenticated && user?.role === 'customer') {
        setLoading(true);
        try {
          const data = await getCustomerData(user.id);
          if (!cancelled) {
            setCreditLimit(data?.creditLimit ?? 0);
          }
        } catch {
          if (!cancelled) {
            setCreditLimit(0);
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      } else {
        setCreditLimit(null);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id, user?.role]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount);

  return (
    <Pressable
      onPress={() => {}}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={({ pressed }) => ({
        margin: 16,
        borderRadius: 8,
        padding: 16,
        backgroundColor: '#1E88E5',
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        transform: [{ scale: pressed || hover ? 1.01 : 1 }],
      })}
      accessibilityLabel="Kartu limit kredit"
    >
      <Text variant="labelSmall" style={{ color: '#fff', opacity: 0.9 }}>LIMIT KREDIT BARANG</Text>
      {!isAuthenticated && (
        <Text variant="bodyMedium" style={{ color: '#fff', marginTop: 8 }}>
          Anda harus login terlebih dahulu untuk melihat limit kredit
        </Text>
      )}
      {isAuthenticated && user?.role === 'customer' && (
        <View style={{ marginTop: 8 }}>
          <Text variant="headlineMedium" style={{ color: '#fff', fontWeight: 'bold' }}>
            {loading ? 'Memuat limit kredit...' : formatCurrency(creditLimit ?? 0)}
          </Text>
          <Text variant="bodySmall" style={{ color: '#fff', marginTop: 4 }}>
            Limit kredit aktual berdasarkan profil Anda
          </Text>
        </View>
      )}
      {isAuthenticated && user && user.role !== 'customer' && (
        <Text variant="bodyMedium" style={{ color: '#fff', marginTop: 8 }}>
          {`Anda adalah ${user.role}`}
        </Text>
      )}
    </Pressable>
  );
}
