'use client';

import { Mascot } from '@/components/ai/Mascot';

import { cn } from '@/lib/utils/cn';

/**
 * The Ask DUMA mascot with one line of speech — the head of every Ask DUMA
 * card in Content. It thinks while `busy`, celebrates on each new `cheer`,
 * and is sad when the line is an error.
 */
export function DumaSays({ line, busy, tone, cheer }: { line: string; busy: boolean; tone: 'idle' | 'done' | 'error'; cheer: number }) {
  return (
    <div className="flex items-center gap-3">
      <Mascot
        size={52}
        state={busy ? 'thinking' : undefined}
        feeling={tone === 'error' ? 'sad' : tone === 'done' ? 'happy' : 'curious'}
        gesture={tone === 'done' ? 'celebrate' : undefined}
        gestureKey={cheer}
        fps={24}
        className="-my-1 shrink-0"
      />
      {/* The speech bubble: one line, whatever is true right now. */}
      <p
        aria-live="polite"
        className={cn(
          'relative min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm leading-5',
          'before:absolute before:-left-1.5 before:top-1/2 before:size-3 before:-translate-y-1/2 before:rotate-45 before:border-b before:border-l before:bg-inherit before:[border-color:inherit]',
          tone === 'error' ? 'border-exception/40 bg-exception/6 text-exception' : 'border-rule/60 bg-control text-foreground',
        )}
      >
        {line}
      </p>
    </div>
  );
}
