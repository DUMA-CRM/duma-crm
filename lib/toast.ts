import { type SileoOptions, sileo } from 'sileo';

import { toastPositionFor } from '@/lib/utils/toast-position';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  /** Short pill label. The message itself goes in the expanding body. */
  title?: string;
  /** Optional call to action rendered under the message. */
  button?: { title: string; onClick: () => void };
  /**
   * A transactional confirmation the operator must not miss — money taken,
   * payslips issued, something published live. Shown top-center.
   */
  critical?: boolean;
}

const TITLES: Record<ToastType, string> = {
  success: 'Done',
  error: 'Something went wrong',
  info: 'Heads up',
  warning: 'Check this',
};

/** How long each type stays, in ms. Errors get longer to be read, not forever. */
const DURATIONS: Record<ToastType, number> = {
  success: 3000,
  info: 4000,
  warning: 5000,
  error: 6000,
};

/**
 * App-wide notification, backed by sileo. Usable anywhere — components,
 * mutation callbacks, the QueryCache — because sileo keeps its own store.
 *
 * The id is derived from type + message: sileo replaces a toast that shares an
 * id, so a failing page fanning out into identical query errors shows one
 * toast, while distinct messages still stack.
 */
export function toast(type: ToastType, message: string, options: ToastOptions = {}) {
  // `id` is honoured by sileo's store but missing from its public options type.
  const opts: SileoOptions & { id: string } = {
    id: `${type}:${message}`,
    title: options.title ?? TITLES[type],
    description: message,
    button: options.button,
    // Unset → the Toaster's route-based default (see AppToaster).
    position: options.critical ? toastPositionFor(null, true) : undefined,
    // Always finite: a `null` duration also turns off sileo's auto-expand, so the
    // message never showed and the pill sat there until clicked. Hovering pauses
    // the timer; clicking dismisses early.
    duration: DURATIONS[type],
  };
  return sileo[type](opts);
}

export const dismissToast = (id: string) => sileo.dismiss(id);
