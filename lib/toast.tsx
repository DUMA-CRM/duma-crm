import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  /** A short bold line above the message. Leave out for most toasts: the message is enough. */
  title?: string;
  /** Optional call to action rendered under the message. */
  button?: { title: string; onClick: () => void };
  /** How long it stays, in ms, when the type's default is too short — an Undo that must outlast a glance. */
  duration?: number;
}

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  button?: ToastOptions['button'];
  duration: number;
  /** Bumped when the same toast is raised again, so its timer restarts. */
  version: number;
}

/** How long each type stays, in ms. Errors get longer to be read, not forever. */
const DURATIONS: Record<ToastType, number> = {
  success: 3000,
  info: 4000,
  warning: 5000,
  error: 6000,
};

/** At most this many on screen; the oldest goes when another arrives. */
const MAX_VISIBLE = 3;

interface ToastStore {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, 'version'>) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (toast) =>
    set((state) => {
      const existing = state.toasts.find((item) => item.id === toast.id);
      if (existing) {
        return { toasts: state.toasts.map((item) => (item.id === toast.id ? { ...toast, version: existing.version + 1 } : item)) };
      }
      return { toasts: [...state.toasts, { ...toast, version: 0 }].slice(-MAX_VISIBLE) };
    }),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) })),
}));

/**
 * App-wide notification. Usable anywhere — components, mutation callbacks, the
 * QueryCache — because the store lives outside React. AppToaster renders it.
 *
 * The id is derived from type + message: raising the same toast again replaces
 * it (and restarts its timer), so a failing page fanning out into identical
 * query errors shows one toast, while distinct messages still stack.
 */
export function toast(type: ToastType, message: string, options: ToastOptions = {}) {
  const id = `${type}:${message}`;
  useToastStore.getState().push({
    id,
    type,
    message,
    title: options.title,
    button: options.button,
    duration: options.duration ?? DURATIONS[type],
  });
  return id;
}

export const dismissToast = (id: string) => useToastStore.getState().dismiss(id);
