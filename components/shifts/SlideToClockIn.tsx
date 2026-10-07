'use client';

import { useReducedMotion } from 'motion/react';
import { useState } from 'react';

import { Loader2, LogIn } from '@/components/icons';
import { ShimmeringText } from '@/components/shimmering-text';
import { SlideToUnlock, SlideToUnlockHandle, SlideToUnlockText, SlideToUnlockTrack } from '@/components/slide-to-unlock';

import { cn } from '@/lib/utils';
import { uiSound } from '@/lib/utils/chime';

interface SlideToClockInProps {
  /** Resolves once clocked in, rejects if not — pass `mutateAsync`. */
  onClockIn: () => Promise<unknown>;
  pending?: boolean;
  disabled?: boolean;
  label?: string;
  className?: string;
}

// A deliberate gesture rather than a tap: clocking in starts a timesheet, and a
// stray touch on a shared till shouldn't do that.
export function SlideToClockIn({
  onClockIn,
  pending = false,
  disabled = false,
  label = 'Slide to clock in',
  className,
}: SlideToClockInProps) {
  const reduceMotion = useReducedMotion();
  // The handle stays parked at the end while the request runs. On success the
  // caller swaps this out; on failure remounting sends the handle home.
  const [attempt, setAttempt] = useState(0);

  const handleUnlock = () => {
    // The phone's unlock click, as the handle lands — inside the gesture, which
    // also unlocks audio for the error sound should the clock-in fail.
    uiSound('unlock');
    // Wrapped so a synchronous throw lands in the same failure path.
    Promise.resolve()
      .then(onClockIn)
      .then(
        () => undefined,
        () => {
          // The caller's onError owns the message; this only resets and sounds.
          uiSound('error');
          setAttempt((n) => n + 1);
        },
      );
  };

  return (
    <SlideToUnlock
      key={attempt}
      onUnlock={handleUnlock}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={cn('w-full rounded-lg', className)}
    >
      <SlideToUnlockTrack>
        <SlideToUnlockText className="pr-2 text-sm font-semibold">
          {({ isDragging }) => <ShimmeringText text={label} isStopped={isDragging || disabled || !!reduceMotion} />}
        </SlideToUnlockText>
        <SlideToUnlockHandle aria-label={pending ? 'Clocking in…' : label} className="rounded-md bg-primary text-primary-foreground">
          {pending ? <Loader2 size={20} className="animate-spin" aria-hidden="true" /> : <LogIn size={20} aria-hidden="true" />}
        </SlideToUnlockHandle>
      </SlideToUnlockTrack>
      <span className="sr-only" role="status">
        {pending ? 'Clocking in…' : ''}
      </span>
    </SlideToUnlock>
  );
}
