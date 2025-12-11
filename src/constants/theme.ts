import { MD3LightTheme as DefaultTheme } from 'react-native-paper';

export const theme = {
  ...DefaultTheme,
  roundness: 8, // Reduced from 12 to make it less curved but still soft
  colors: {
    ...DefaultTheme.colors,
    primary: '#1E88E5',
    secondary: '#455A64',
    background: '#FFFFFF',
    surface: '#FAFAFA',
    surfaceVariant: '#ECEFF1',
    outline: '#E0E0E0',
    error: '#D32F2F',
  },
};
