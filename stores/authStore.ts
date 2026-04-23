import { create } from 'zustand';

import type { User } from '@/lib/api/auth.service';

interface AuthState {
  user: User | null;
  // Set by AuthInitializer after the server hydrates user data into the client.
  isLoaded: boolean;
  setUser: (user: User | null) => void;
  setLoaded: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoaded: false,
  setUser: (user) => set({ user }),
  setLoaded: () => set({ isLoaded: true }),
}));
