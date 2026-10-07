'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import * as React from 'react';

import { Copy, Loader2 } from '@/components/icons';
import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils/cn';

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** A tick that draws itself, stroke first — the "done" mark for every action below. */
export function DrawnCheck({ className, delay = 0.05 }: { className?: string; delay?: number }) {
  const reduceMotion = useReducedMotion();
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-4', className)}
      aria-hidden="true"
    >
      <motion.path
        d="M5 12.5l4.5 4.5L19 7.5"
        initial={reduceMotion ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.36, ease: [0.65, 0, 0.35, 1], delay }}
      />
    </svg>
  );
}

type ActionState = 'idle' | 'pending' | 'done';

/**
 * A button whose label slides between idle, working and done. On `done` it
 * turns success-coloured, draws a tick and gives one small pop — the beat that
 * says "that saved" before the dialog or bar it lives in moves on.
 */
export function ActionButton({
  pending = false,
  done = false,
  pendingLabel = 'Saving…',
  doneLabel = 'Saved',
  icon,
  children,
  className,
  disabled,
  ...props
}: React.ComponentProps<typeof Button> & {
  pending?: boolean;
  done?: boolean;
  pendingLabel?: React.ReactNode;
  doneLabel?: React.ReactNode;
  /** Shown before the idle label. */
  icon?: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const state: ActionState = done ? 'done' : pending ? 'pending' : 'idle';
  const slide = reduceMotion ? 0 : 10;

  return (
    <Button
      {...props}
      disabled={disabled || pending || done}
      aria-live="polite"
      data-state={state}
      className={cn(
        'relative overflow-hidden',
        done && 'bg-success text-success-foreground hover:bg-success disabled:opacity-100',
        className,
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={state}
          className="inline-flex items-center gap-1.5"
          initial={{ opacity: 0, y: slide }}
          animate={{ opacity: 1, y: 0, scale: state === 'done' && !reduceMotion ? [0.9, 1.06, 1] : 1 }}
          exit={{ opacity: 0, y: -slide }}
          transition={{ duration: 0.22, ease: EASE_OUT }}
        >
          {state === 'pending' && <Loader2 className="animate-spin" aria-hidden="true" />}
          {state === 'done' && <DrawnCheck />}
          {state === 'idle' && icon}
          {state === 'pending' ? pendingLabel : state === 'done' ? doneLabel : children}
        </motion.span>
      </AnimatePresence>
    </Button>
  );
}

/**
 * A short-lived "done" flag for an `ActionButton` whose button stays on screen
 * after it succeeds. Fire it from the call site —
 * `save.mutate(undefined, { onSuccess: flash })` — so the mutation itself is untouched.
 */
export function useDoneBeat(ms = 1400) {
  const [done, setDone] = React.useState(false);
  React.useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => setDone(false), ms);
    return () => clearTimeout(timer);
  }, [done, ms]);
  const flash = React.useCallback(() => setDone(true), []);
  return [done, flash] as const;
}

/**
 * The copy icon that answers: it pops out and a tick draws in its place. For
 * the hand-rolled copy buttons that keep their own `copied` state.
 * `className` sizes and colours the tick; the copy icon takes `size`.
 */
export function CopyGlyph({ copied, size = 14, className }: { copied: boolean; size?: number; className?: string }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={copied ? 'copied' : 'copy'}
        className="inline-flex"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.6 }}
        transition={{ duration: 0.18, ease: EASE_OUT }}
      >
        {copied ? <DrawnCheck className={className} /> : <Copy size={size} aria-hidden="true" />}
      </motion.span>
    </AnimatePresence>
  );
}

/**
 * Copy with an answer: the button itself turns into "Copied ✓" for a moment.
 * `onCopy` resolves true when the clipboard took it; on false the caller toasts.
 * `iconOnly` keeps it a square icon button, labelled for screen readers.
 */
export function CopyButton({
  onCopy,
  label = 'Copy',
  copiedLabel = 'Copied',
  iconOnly = false,
  icon,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Button>, 'onClick'> & {
  onCopy: () => Promise<boolean>;
  label?: string;
  copiedLabel?: string;
  iconOnly?: boolean;
  /** Replaces the copy icon in the idle state. */
  icon?: React.ReactNode;
}) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  React.useEffect(() => () => clearTimeout(timer.current), []);
  // A solid button turns success-filled; an outline or ghost one just takes the colour.
  const filled = props.variant === 'default';

  return (
    <Button
      variant="outline"
      size={iconOnly ? 'icon' : undefined}
      aria-label={iconOnly ? (copied ? copiedLabel : label) : undefined}
      {...props}
      className={cn(
        'overflow-hidden transition-colors',
        !iconOnly && 'min-w-24',
        copied && (filled ? 'bg-success text-success-foreground hover:bg-success' : 'border-success/50 text-success'),
        className,
      )}
      onClick={async () => {
        if (!(await onCopy())) return;
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1800);
      }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={copied ? 'copied' : 'copy'}
          className="inline-flex items-center gap-1.5"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.18, ease: EASE_OUT }}
        >
          {copied ? <DrawnCheck /> : (icon ?? <Copy aria-hidden="true" />)}
          {!iconOnly && (copied ? copiedLabel : label)}
        </motion.span>
      </AnimatePresence>
    </Button>
  );
}
