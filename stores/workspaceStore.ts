import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WorkspaceState {
  tenantId: string | null;
  locationId: string | null;
  setTenantId: (id: string | null) => void;
  setLocationId: (id: string | null) => void;
}

// Persisted so the active tenant/location survive page refreshes.
// Import this store in any component or service that needs the active context.
export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      tenantId: null,
      locationId: null,
      // Switching tenant clears the location selection.
      setTenantId: (id) => set({ tenantId: id, locationId: null }),
      setLocationId: (id) => set({ locationId: id }),
    }),
    { name: 'duma-workspace' },
  ),
);
