/**
 * Debounced autosave with one save in flight at a time.
 *
 * `schedule(value)` remembers the latest value and saves it `delay` ms after
 * the last call. A save never overlaps another: a change made while one is in
 * flight waits for it, then the latest value goes — the ones in between are
 * skipped, never sent out of order. `flush()` saves what's pending now and
 * resolves once everything has landed (before publishing, before leaving).
 *
 * A failed save keeps its value pending, so Retry (or the next change) sends
 * it again. A conflict stops the saver for good: someone else changed the
 * record, and saving over them would lose their work.
 *
 * Framework-free and clock-injectable so the rules are tested without React.
 */

export type AutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error' | 'conflict';

export interface AutosaveTimers {
  set: (run: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
}

export interface AutosaverOptions<T> {
  delay: number;
  save: (value: T) => Promise<void>;
  /** A save refused because the record changed since it was read. */
  isConflict?: (error: unknown) => boolean;
  onStatus?: (status: AutosaveStatus, error?: unknown) => void;
  timers?: AutosaveTimers;
}

export interface Autosaver<T> {
  schedule: (value: T) => void;
  /** Save what's pending now. True when nothing is left unsaved. */
  flush: () => Promise<boolean>;
  /** Try the failed save again, now. */
  retry: () => Promise<boolean>;
  /** Stop the timer (the value stays pending; nothing more is sent by the timer). */
  dispose: () => void;
  status: () => AutosaveStatus;
  /** A value is waiting or being saved. */
  busy: () => boolean;
}

const defaultTimers: AutosaveTimers = {
  set: (run, ms) => setTimeout(run, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export function createAutosaver<T>({
  delay,
  save,
  isConflict = () => false,
  onStatus,
  timers = defaultTimers,
}: AutosaverOptions<T>): Autosaver<T> {
  let latest: T | undefined;
  let pending = false;
  let timer: unknown = null;
  let inFlight: Promise<void> | null = null;
  let state: AutosaveStatus = 'idle';
  let stopped = false;

  const set = (next: AutosaveStatus, error?: unknown) => {
    state = next;
    onStatus?.(next, error);
  };
  const clearTimer = () => {
    if (timer !== null) timers.clear(timer);
    timer = null;
  };

  const run = (): Promise<void> => {
    clearTimer();
    if (stopped) return Promise.resolve();
    if (inFlight) return inFlight; // `pending` stays set; the flight's end picks it up.
    if (!pending) return Promise.resolve();
    const value = latest as T;
    pending = false;
    set('saving');
    inFlight = save(value).then(
      () => {
        inFlight = null;
        // A newer value arrived mid-flight and its timer has already fired: send it now.
        if (pending && timer === null) return run();
        if (!pending) set('saved');
        else set('pending');
      },
      (error: unknown) => {
        inFlight = null;
        if (isConflict(error)) {
          stopped = true;
          clearTimer();
          set('conflict', error);
          return;
        }
        // Keep it to send again. A newer value typed mid-flight keeps its timer, and goes then.
        pending = true;
        set('error', error);
      },
    );
    return inFlight;
  };

  const flush = async (): Promise<boolean> => {
    clearTimer();
    // Wait out the flight, then send what's left — repeat until nothing is.
    for (let guard = 0; guard < 20; guard++) {
      if (stopped) return false;
      if (inFlight) {
        await inFlight;
        continue;
      }
      if (!pending) return state !== 'error';
      await run();
      if (state === 'error') return false;
    }
    return !pending && !inFlight && !stopped;
  };

  return {
    schedule(value) {
      latest = value;
      pending = true;
      if (stopped) return;
      clearTimer();
      timer = timers.set(() => {
        timer = null;
        void run();
      }, delay);
      if (!inFlight) set('pending');
    },
    flush,
    retry: flush,
    dispose: clearTimer,
    status: () => state,
    busy: () => pending || inFlight !== null,
  };
}
