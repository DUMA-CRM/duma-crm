import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ScannerMode = 'camera' | 'external';

// Per-device POS preferences (localStorage) — a counter tablet keeps its own
// scanner setup regardless of who signs in.
interface PosSettingsStore {
  /** How loyalty QR codes are read at the POS: the device camera, or a
   *  keyboard-wedge USB/Bluetooth scanner. */
  scannerMode: ScannerMode;
  setScannerMode: (mode: ScannerMode) => void;
}

export const usePosSettingsStore = create<PosSettingsStore>()(
  persist(
    (set) => ({
      scannerMode: 'camera',
      setScannerMode: (scannerMode) => set({ scannerMode }),
    }),
    { name: 'pos-settings' },
  ),
);
