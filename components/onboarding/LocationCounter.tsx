'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';

import { Minus, Plus } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

const PRESETS = [1, 2, 3, 5, 10] as const;
const MAX = 10_000;

/** A number you nudge rather than type: the figure rolls in the direction it moved. */
export function LocationCounter({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const reduceMotion = useReducedMotion();
  // The roll direction is derived during render from the last value shown.
  const [shown, setShown] = useState({ value, direction: 1 });
  if (shown.value !== value) setShown({ value, direction: value > shown.value ? 1 : -1 });
  const { direction } = shown;
  const set = (next: number) => onChange(Math.min(MAX, Math.max(1, Math.round(next) || 1)));

  return (
    <div className="flex flex-col items-start gap-6">
      <div className="flex items-center gap-5">
        <Button type="button" variant="outline" size="icon-touch" aria-label="One fewer location" disabled={value <= 1} onClick={() => set(value - 1)}>
          <Minus aria-hidden="true" />
        </Button>
        <div className="relative h-16 min-w-28 overflow-hidden text-center">
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.span
              key={value}
              custom={direction}
              aria-hidden="true"
              variants={{
                enter: (dir: number) => ({ y: reduceMotion ? 0 : dir * 24, opacity: 0 }),
                center: { y: 0, opacity: 1 },
                exit: (dir: number) => ({ y: reduceMotion ? 0 : dir * -24, opacity: 0 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 flex items-center justify-center font-mono text-5xl font-semibold tabular-nums text-foreground"
            >
              {value}
            </motion.span>
          </AnimatePresence>
          {/* The real control sits on top with invisible text, so typing keeps focus while the figure animates. */}
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX}
            aria-label="Number of locations"
            value={value}
            onChange={(event) => set(Number(event.target.value))}
            autoFocus
            className="absolute inset-0 w-full rounded-md bg-transparent text-center font-mono text-5xl text-transparent caret-transparent outline-none [appearance:textfield] focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </div>
        <Button type="button" variant="outline" size="icon-touch" aria-label="One more location" onClick={() => set(value + 1)}>
          <Plus aria-hidden="true" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Common answers">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => set(preset)}
            className={cn(
              'h-11 min-w-11 rounded-md border px-3 text-sm font-semibold tabular-nums transition-colors',
              value === preset ? 'border-primary bg-primary text-primary-foreground' : 'border-rule/70 bg-field text-foreground hover:bg-band',
            )}
          >
            {preset === 10 ? '10+' : preset}
          </button>
        ))}
      </div>
    </div>
  );
}
