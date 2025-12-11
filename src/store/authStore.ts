import { create } from 'zustand';
import { User, UserRole } from '../types';
import { loginEmailAuth, registerEmailAuth } from '../services/authSdk';
import { getUserRole, setUserRole, createCustomerProfile, createEmployeeProfile } from '../services/firestore';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loginEmail: (email: string, password: string) => Promise<void>;
  registerEmail: (email: string, password: string, role: UserRole, name?: string) => Promise<void>;
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
  registerEmail: async (email, password, role, name) => {
    const fb = await registerEmailAuth(email, password);
    const userName = name || (email.split('@')[0] || fb.email || 'User').toString();
    
    try {
      if (role === 'customer') {
        await createCustomerProfile(fb.uid, {
          uid: fb.uid,
          email: email,
          name: userName,
          role: 'customer',
          creditLimit: 0,
          currentDebt: 0
        });
      } else if (role === 'employee') {
        await createEmployeeProfile(fb.uid, userName, email);
      } else {
        await setUserRole(fb.uid, role);
      }
    } catch (e) {
      console.error('Error creating user profile:', e);
    }
    
    const user: User = {
      id: fb.uid,
      name: userName,
      username: email,
      role,
    };
    set({ user, isAuthenticated: true });
  },
  logout: () => set({ user: null, isAuthenticated: false }),
}));
