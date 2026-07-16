import { create } from 'zustand';

// Kiosk mode: hide the app chrome (sidebar + header) for full-screen displays
// like the barista KDS. The data attribute lets CSS zero out --header-height
// so full-height pages reclaim the header's space.
interface ChromeStore {
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
}

export const useChromeStore = create<ChromeStore>((set) => ({
  hidden: false,
  setHidden: (hidden) => {
    document.documentElement.toggleAttribute('data-chrome-hidden', hidden);
    set({ hidden });
  },
}));
