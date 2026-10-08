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
   * The workspace's brand colour, cached on this device so the next load paints
   * it before the profile arrives. Set by WorkspaceSettingsSync; BrandSync puts
   * it on <html>.
   */
  brand: Brand;
  setBrand: (brand: Brand) => void;
}

export const useUiSettingsStore = create<UiSettingsStore>()(
  persist(
    (set) => ({
      dismissedTips: [],
      dismissTip: (id) => set((state) => ({ dismissedTips: [...new Set([...state.dismissedTips, id])] })),
      listViews: {},
      setListView: (id, view) => set((state) => ({ listViews: { ...state.listViews, [id]: view } })),
      brand: DEFAULT_BRAND,
      setBrand: (brand) => set({ brand }),
    }),
    {
      // The pre-paint script in app/layout.tsx reads `state.brand` under this key.
      name: UI_SETTINGS_STORAGE_KEY,
      version: 3,
      migrate: (persisted) => {
        const previous = persisted as Partial<Pick<UiSettingsStore, 'dismissedTips' | 'listViews' | 'brand'>>;
        return {
          dismissedTips: previous.dismissedTips ?? [],
          listViews: previous.listViews ?? {},
          brand: parseBrand(previous.brand),
        };
      },
    },
  ),
);
