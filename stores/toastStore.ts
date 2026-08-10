import { create } from 'zustand';

import type { ToastMessage } from '@/components/shared/Toast';

interface ToastStore {
  toasts: ToastMessage[];
  add: (type: ToastMessage['type'], message: string) => void;
  dismiss: (id: number) => void;
}

let nextId = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (type, message) =>
    set((s) => {
      // Drop exact duplicates already on screen (e.g. one global error per burst).
      if (s.toasts.some((t) => t.type === type && t.message === message)) return s;
      // A failing page can fan out into many query failures. Keep the newest
      // four messages so the notification layer never obscures the workspace.
      return { toasts: [...s.toasts, { id: ++nextId, type, message }].slice(-4) };
    }),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative helper — usable outside React (mutations, query callbacks). */
export const toast = (type: ToastMessage['type'], message: string) => useToastStore.getState().add(type, message);
