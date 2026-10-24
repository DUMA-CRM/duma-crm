import type { KeyboardEvent, MouseEvent } from 'react';
import { type SileoOptions, sileo } from 'sileo';

import { X } from '@/components/icons';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  /** Short pill label. The message itself goes in the expanding body. */
  title?: string;
  /** Optional call to action rendered under the message. */
  button?: { title: string; onClick: () => void };
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
  const id = `${type}:${message}`;
  const duration = DURATIONS[type];
  // `id` is honoured by sileo's store but missing from its public options type.
  const opts: SileoOptions & { id: string } = {
    id,
    title: options.title ?? TITLES[type],
    description: <ToastBody id={id} message={message} />,
    button: options.button,
    // Set per toast, not only on the Toaster: a toast fired during a page's
    // first render runs before the Toaster's effect sets its default, and
    // would land at sileo's fallback (top-right).
    position: 'top-center',
    // Always finite: a `null` duration also turns off sileo's auto-expand, so the
    // message never showed and the pill sat there until clicked. Hovering pauses
    // the timer; the ✕ or a swipe dismisses early.
    duration,
    // Stay open for the whole duration, so the message and its ✕ never fold
    // back into the pill while the toast is still on screen.
    autopilot: { collapse: duration },
    // DUMA's corners are tight; sileo's default 16 reads as a bubble.
    roundness: 10,
  };
  return sileo[type](opts);
}

/**
 * The message plus a close control. sileo renders each toast as a <button>, so
 * the ✕ cannot be a <button> too. It is a span with button semantics, and
 * `data-sileo-button` keeps sileo's swipe handler from capturing the pointer,
 * which would otherwise swallow the click.
 */
function ToastBody({ id, message }: { id: string; message: string }) {
  const close = (e: MouseEvent | KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    sileo.dismiss(id);
  };
  return (
    <>
      {message}
      <span
        role="button"
        tabIndex={0}
        aria-label="Dismiss notification"
        data-sileo-button
        data-toast-close
        onClick={close}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') close(e);
        }}
      >
        <X size={14} aria-hidden="true" />
      </span>
    </>
  );
}

export const dismissToast = (id: string) => sileo.dismiss(id);
