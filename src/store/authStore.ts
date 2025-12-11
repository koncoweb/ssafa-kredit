import { create } from 'zustand';
import { User, UserRole } from '../types';
import { loginEmailAuth, registerEmailAuth } from '../services/authSdk';
import { getUserRole, setUserRole } from '../services/firestore';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loginEmail: (email: string, password: string) => Promise<void>;
  registerEmail: (email: string, password: string, role: UserRole) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  loginEmail: async (email, password) => {
    const fb = await loginEmailAuth(email, password);
    let role: UserRole = 'customer';
    try {
      const fetched = await getUserRole(fb.uid);
      if (fetched === 'admin' || fetched === 'employee' || fetched === 'customer') {
        role = fetched as UserRole;
      }
    } catch {}
    const user: User = {
      id: fb.uid,
      name: (email.split('@')[0] || fb.email || 'User').toString(),
      username: email,
      role,
    };
    set({ user, isAuthenticated: true });
  },
  registerEmail: async (email, password, role) => {
    const fb = await registerEmailAuth(email, password);
    try {
      await setUserRole(fb.uid, role);
    } catch {}
    const user: User = {
      id: fb.uid,
      name: (email.split('@')[0] || fb.email || 'User').toString(),
      username: email,
      role,
    };
    set({ user, isAuthenticated: true });
  },
  logout: () => set({ user: null, isAuthenticated: false }),
}));
