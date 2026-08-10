import { create } from 'zustand';

interface PageHeaderStore {
  /**
   * Whether the top bar is mounted and will host the page's masthead. False
   * once it unmounts (leaving the CRM layout), so a page that outlives it draws
   * its own masthead rather than stranding back/title/actions in a dead portal.
   */
  barVisible: boolean;
  /** The bar's slot element. Null until the bar mounts and registers its ref. */
  slot: HTMLElement | null;
  setBarVisible: (barVisible: boolean) => void;
  setSlot: (slot: HTMLElement | null) => void;
}

export const usePageHeaderStore = create<PageHeaderStore>((set) => ({
  // Defaults to true because the bar renders on every CRM page. Assuming it's
  // there costs one frame with no masthead; assuming it isn't would flash a
  // masthead the bar is about to take over.
  barVisible: true,
  slot: null,
  setBarVisible: (barVisible) => set({ barVisible }),
  setSlot: (slot) => set({ slot }),
}));
