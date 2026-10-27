import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { type Brand, DEFAULT_BRAND, parseBrand, UI_SETTINGS_STORAGE_KEY } from '@/lib/utils/brand';

/** How a list of records is laid out — a dense table or a grid of cards. */
export type ListView = 'table' | 'cards';

// App-wide display preferences — persisted per device (localStorage).
interface UiSettingsStore {
  /** Ids of one-off guidance panels (e.g. the Communications setup steps) the
   *  user has dismissed — they stay hidden on this device. */
  dismissedTips: string[];
  dismissTip: (id: string) => void;
  /** Table-or-cards choice per list, keyed by list id ('customers', …), so each
   *  screen remembers how this device likes to read it. */
  listViews: Record<string, ListView>;
  setListView: (id: string, view: ListView) => void;
  /**
   * Each workspace's brand colour, cached on this device by context partition
   * (account + workspace) so a tab paints the right one before its context
   * loads. Written by WorkspaceContextProvider from the workspace's own setting;
   * BrandSync paints the entry for this tab's context. DUMA Admin never has an
   * entry — it always wears the default.
   */
  brands: Record<string, Brand>;
  setBrandFor: (partition: string, brand: Brand) => void;
  /** The last colour painted in any tab — the pre-paint fallback for a tab with no context yet. */
  brand: Brand;
  setBrand: (brand: Brand) => void;
  /** Reservations' floor maps draw each table's chairs. */
  showChairs: boolean;
  setShowChairs: (show: boolean) => void;
}

export const useUiSettingsStore = create<UiSettingsStore>()(
  persist(
    (set) => ({
      dismissedTips: [],
      dismissTip: (id) => set((state) => ({ dismissedTips: [...new Set([...state.dismissedTips, id])] })),
      listViews: {},
      setListView: (id, view) => set((state) => ({ listViews: { ...state.listViews, [id]: view } })),
      brands: {},
      // Bounded: the last 20 contexts this device has opened, newest kept.
      setBrandFor: (partition, brand) =>
        set((state) => ({
          brands: Object.fromEntries([...Object.entries(state.brands).filter(([key]) => key !== partition), [partition, brand]].slice(-20)),
        })),
      brand: DEFAULT_BRAND,
      setBrand: (brand) => set({ brand }),
      showChairs: true,
      setShowChairs: (showChairs) => set({ showChairs }),
    }),
    {
      // The pre-paint script in app/layout.tsx reads `state.brand` under this key.
      name: UI_SETTINGS_STORAGE_KEY,
      version: 4,
      migrate: (persisted) => {
        const previous = persisted as Partial<Pick<UiSettingsStore, 'dismissedTips' | 'listViews' | 'brand' | 'brands' | 'showChairs'>>;
        return {
          dismissedTips: previous.dismissedTips ?? [],
          listViews: previous.listViews ?? {},
          brands: Object.fromEntries(Object.entries(previous.brands ?? {}).map(([key, value]) => [key, parseBrand(value)])),
          brand: parseBrand(previous.brand),
          showChairs: previous.showChairs ?? true,
        };
      },
    },
  ),
);
