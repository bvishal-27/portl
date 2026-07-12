import { create } from 'zustand';

type Role = 'resident' | 'guard' | 'admin' | null;

interface AuthState {
  userId: string | null;
  role: Role;
  setSession: (userId: string | null, role: Role) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  role: null,
  setSession: (userId, role) => set({ userId, role }),
  clearSession: () => set({ userId: null, role: null }),
}));