import { create } from 'zustand';

import type { StaffRole } from '@/lib/api/staff.service';
import type { User } from '@/lib/api/auth.service';

interface AuthState {
  user: User | null;
  // The signed-in user's staff role (null if unknown / no profile).
  role: StaffRole | null;
  // Set by AuthInitializer after the server hydrates user data into the client.
  isLoaded: boolean;
  setUser: (user: User | null) => void;
  setRole: (role: StaffRole | null) => void;
  setLoaded: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  isLoaded: false,
  setUser: (user) => set({ user }),
  setRole: (role) => set({ role }),
  setLoaded: () => set({ isLoaded: true }),
}));
