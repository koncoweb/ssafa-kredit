const firebaseConfig = {
  apiKey: "AIzaSyDy3fE8UbZuPUtGZN_d2uHM4dIqXA6p0kE",
  authDomain: "de-river.firebaseapp.com",
  projectId: "de-river",
  storageBucket: "de-river.firebasestorage.app",
  messagingSenderId: "818632490714",
  appId: "1:818632490714:web:a7f723798e1f2c16ccefe3",
  measurementId: "G-0GC2H5FK05",
};

const IDENTITY_BASE = 'https://identitytoolkit.googleapis.com/v1';
const DB_BASE = 'https://de-river-default-rtdb.firebaseio.com';

export type FirebaseUser = { localId: string; email: string; idToken: string };

export async function signInWithEmail(email: string, password: string): Promise<FirebaseUser> {
  const url = `${IDENTITY_BASE}/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!res.ok) throw new Error('Login gagal');
  const data = await res.json();
  return { localId: data.localId, email: data.email, idToken: data.idToken };
}

export async function signUpWithEmail(email: string, password: string): Promise<FirebaseUser> {
  const url = `${IDENTITY_BASE}/accounts:signUp?key=${firebaseConfig.apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!res.ok) throw new Error('Registrasi gagal');
  const data = await res.json();
  return { localId: data.localId, email: data.email, idToken: data.idToken };
}

export async function saveUserRole(localId: string, idToken: string, role: string) {
  const url = `${DB_BASE}/users/${localId}/profile.json?auth=${idToken}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error('Gagal menyimpan role');
}

export async function getUserRole(localId: string, idToken: string): Promise<string | null> {
  const url = `${DB_BASE}/users/${localId}/profile.json?auth=${idToken}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data?.role ?? null;
}

export async function saveData(path: string, idToken: string, value: unknown) {
  const url = `${DB_BASE}/${path}.json?auth=${idToken}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
  if (!res.ok) throw new Error('Gagal menyimpan data');
  return res.json();
}

