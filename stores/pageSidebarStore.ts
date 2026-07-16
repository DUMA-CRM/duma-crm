import { create } from 'zustand';

interface PageSidebarStore {
  /** Whether the current page renders a right-hand panel (registered by PageSidebar on mount). */
  present: boolean;
  /** Drawer visibility on small screens — on lg+ the panel is always inline and this is ignored. */
  open: boolean;
  setPresent: (present: boolean) => void;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

export const usePageSidebarStore = create<PageSidebarStore>((set) => ({
  present: false,
  open: false,
  // Leaving a page with a sidebar also closes the drawer so it doesn't flash open on the next page.
  setPresent: (present) => set(present ? { present } : { present, open: false }),
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}));
