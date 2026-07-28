import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// App-wide display preferences — persisted per device (localStorage).
interface UiSettingsStore {
  /** Hide the big page title header (eyebrow + title) on every page — frees
   *  vertical space for content on small tablets. Header slots (search bars,
   *  category tabs) stay visible. */
  hidePageTitles: boolean;
  setHidePageTitles: (hidePageTitles: boolean) => void;
  /** Hide the top bar on large screens and move its tools (location, reload,
   *  audit) into the sidebar — a chrome-light layout for tablets/kiosks.
   *  Below `lg` the header stays put, since it's the only way to reach the
   *  off-canvas sidebar there. */
  hideHeader: boolean;
  setHideHeader: (hideHeader: boolean) => void;
  /** Ids of one-off guidance panels (e.g. the Communications setup steps) the
   *  user has dismissed — they stay hidden on this device. */
  dismissedTips: string[];
  dismissTip: (id: string) => void;
}

export const useUiSettingsStore = create<UiSettingsStore>()(
  persist(
    (set) => ({
      hidePageTitles: false,
      setHidePageTitles: (hidePageTitles) => set({ hidePageTitles }),
      hideHeader: false,
      setHideHeader: (hideHeader) => set({ hideHeader }),
      dismissedTips: [],
      dismissTip: (id) => set((state) => ({ dismissedTips: [...new Set([...state.dismissedTips, id])] })),
    }),
    { name: 'ui-settings' },
  ),
);
