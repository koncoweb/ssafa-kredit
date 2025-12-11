import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, ViewStyle } from 'react-native';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function GradientBackground({ children, style }: Props) {
  return (
    <LinearGradient
      colors={["#0F172A", "#1E293B", "#0B1324"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.bg, style]}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
});

