import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { type TillHardwareSettings, validateHardware } from '@/lib/pos-hardware/model';
import { rememberPrinterOrigins } from '@/lib/pos-hardware/printer-access';

interface TillHardwareStore {
  registers: Record<string, TillHardwareSettings>;
  save: (scope: string, settings: TillHardwareSettings) => void;
}

/** Every network printer this browser's tills use — what the proxy lets this browser's CSP reach. */
export const networkOrigins = (registers: Record<string, TillHardwareSettings>) =>
  Object.values(registers).map((settings) => (settings.connector === 'epson-epos' ? settings.networkOrigin : undefined));

export const useTillHardwareStore = create<TillHardwareStore>()(
  persist(
    (set, get) => ({
      registers: {},
      save: (scope, settings) => {
        const error = validateHardware(settings);
        if (error) throw new Error(error);
        set((state) => ({ registers: { ...state.registers, [scope]: settings } }));
        rememberPrinterOrigins(networkOrigins(get().registers));
      },
    }),
    {
      name: 'duma-till-hardware',
      version: 1,
      // A cleared cookie (or a till set up before the cookie existed) is restored on load.
      onRehydrateStorage: () => (state) => {
        if (state) rememberPrinterOrigins(networkOrigins(state.registers));
      },
    },
  ),
);
