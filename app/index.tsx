import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';
import { useEffect, useState } from 'react';

export default function Index() {
  const { isAuthenticated, user } = useAuthStore();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  // Redirect based on role
  switch (user?.role) {
    case 'admin':
      return <Redirect href="/(admin)" />;
    case 'employee':
      return <Redirect href="/(employee)" />;
    case 'customer':
      return <Redirect href="/(customer)" />;
    default:
      return <Redirect href="/(auth)/login" />;
  }
}
