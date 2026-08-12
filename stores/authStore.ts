import { create } from 'zustand';

import type { StaffRole } from '@/lib/api/staff.service';
import type { User } from '@/lib/api/auth.service';

interface AuthState {
  user: User | null;
  // The signed-in user's staff role (null if unknown / no profile). Kept for
  // display and for the few genuinely role-shaped decisions (e.g. super_admin
  // being the only role without a pinned tenant). Do NOT gate features on it —
  // use `capabilities`, which is what the server actually authorises against.
  role: StaffRole | null;
  // Capabilities for the signed-in user, as returned by GET /staff/me.
  // Deliberately NOT persisted: a role change must not leave stale permissions
  // sitting in localStorage.
  capabilities: string[];
  // Set by AuthInitializer after the server hydrates user data into the client.
  isLoaded: boolean;
  setUser: (user: User | null) => void;
  setRole: (role: StaffRole | null) => void;
  setCapabilities: (capabilities: string[]) => void;
  setLoaded: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  capabilities: [],
  isLoaded: false,
  setUser: (user) => set({ user }),
  setRole: (role) => set({ role }),
  setCapabilities: (capabilities) => set({ capabilities }),
  setLoaded: () => set({ isLoaded: true }),
}));
