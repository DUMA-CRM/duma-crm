import { create } from 'zustand';

// Chrome/Edge fire `beforeinstallprompt` ONCE, early after page load — long
// before the settings page mounts. ServiceWorkerRegistrar captures it here so
// the "Install app" button can replay it whenever the user finds it.
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaStore {
  installPrompt: BeforeInstallPromptEvent | null;
  installed: boolean;
  setInstallPrompt: (e: BeforeInstallPromptEvent | null) => void;
  setInstalled: (installed: boolean) => void;
}

export const usePwaStore = create<PwaStore>((set) => ({
  installPrompt: null,
  installed: false,
  setInstallPrompt: (installPrompt) => set({ installPrompt }),
  setInstalled: (installed) => set({ installed }),
}));
