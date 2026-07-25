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
}

export const useUiSettingsStore = create<UiSettingsStore>()(
  persist(
    (set) => ({
      hidePageTitles: false,
      setHidePageTitles: (hidePageTitles) => set({ hidePageTitles }),
      hideHeader: false,
      setHideHeader: (hideHeader) => set({ hideHeader }),
    }),
    { name: 'ui-settings' },
  ),
);
