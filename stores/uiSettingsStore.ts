import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
}

export const useUiSettingsStore = create<UiSettingsStore>()(
  persist(
    (set) => ({
      dismissedTips: [],
      dismissTip: (id) => set((state) => ({ dismissedTips: [...new Set([...state.dismissedTips, id])] })),
      listViews: {},
      setListView: (id, view) => set((state) => ({ listViews: { ...state.listViews, [id]: view } })),
    }),
    {
      name: 'ui-settings',
      version: 2,
      migrate: (persisted) => {
        const previous = persisted as Partial<Pick<UiSettingsStore, 'dismissedTips' | 'listViews'>>;
        return {
          dismissedTips: previous.dismissedTips ?? [],
          listViews: previous.listViews ?? {},
        };
      },
    },
  ),
);
