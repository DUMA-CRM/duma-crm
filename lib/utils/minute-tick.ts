/**
 * Clocks that show minutes tick once a minute, on the minute — not every
 * second. `subscribeToMinute` fits `useSyncExternalStore` and setState alike.
 */

/** Milliseconds from `now` to the start of the next wall-clock minute (never 0, so a tick can't fire twice). */
export function msUntilNextMinute(now: number): number {
  return 60_000 - (((now % 60_000) + 60_000) % 60_000);
}

/** Calls `onTick` at the start of every minute until the returned function is called. */
export function subscribeToMinute(onTick: () => void): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const schedule = () => {
    // A small margin so the tick lands inside the new minute, not a millisecond short of it.
    timer = setTimeout(() => {
      onTick();
      schedule();
    }, msUntilNextMinute(Date.now()) + 50);
  };
  schedule();
  return () => clearTimeout(timer);
}
