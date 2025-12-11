import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';

export const firebaseConfig = {
  apiKey: 'AIzaSyDy3fE8UbZuPUtGZN_d2uHM4dIqXA6p0kE',
  authDomain: 'de-river.firebaseapp.com',
  projectId: 'de-river',
  storageBucket: 'de-river.firebasestorage.app',
  messagingSenderId: '818632490714',
  appId: '1:818632490714:web:a7f723798e1f2c16ccefe3',
  measurementId: 'G-0GC2H5FK05',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
if (Platform.OS === 'web') {
  // Persist auth for web; React Native uses default in-memory persistence
  setPersistence(auth, browserLocalPersistence);
}

export const db = getFirestore(app);
export const storage = getStorage(app);

