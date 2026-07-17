import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// App-wide display preferences — persisted per device (localStorage).
interface UiSettingsStore {
  /** Hide the big page title header (eyebrow + title) on every page — frees
   *  vertical space for content on small tablets. Header slots (search bars,
   *  category tabs) stay visible. */
  hidePageTitles: boolean;
  setHidePageTitles: (hidePageTitles: boolean) => void;
}

export const useUiSettingsStore = create<UiSettingsStore>()(
  persist(
    (set) => ({
      hidePageTitles: false,
      setHidePageTitles: (hidePageTitles) => set({ hidePageTitles }),
    }),
    { name: 'ui-settings' },
  ),
);
