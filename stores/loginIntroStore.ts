import { create } from 'zustand';

interface LoginIntroStore {
  /** True from a successful sign-in until the intro has finished playing. */
  pending: boolean;
  start: () => void;
  finish: () => void;
}

/**
 * Deliberately NOT persisted: the intro belongs to the act of signing in, not to
 * the session. Reloading the dashboard shouldn't replay it, and it shouldn't
 * survive into tomorrow morning's first page load.
 */
export const useLoginIntroStore = create<LoginIntroStore>((set) => ({
  pending: false,
  start: () => set({ pending: true }),
  finish: () => set({ pending: false }),
}));
