import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// KDS display preferences — persisted so the chime setting survives
// navigation and reloads on the shop tablet.
interface KdsStore {
  soundOn: boolean;
  setSoundOn: (soundOn: boolean) => void;
}

export const useKdsStore = create<KdsStore>()(
  persist(
    (set) => ({
      soundOn: false,
      setSoundOn: (soundOn) => set({ soundOn }),
    }),
    { name: 'kds-settings' },
  ),
);
