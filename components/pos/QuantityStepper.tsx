import { Minus, Plus } from '@/components/icons';

import { cn } from '@/lib/utils/cn';

const STEP =
  'flex w-12 touch-manipulation items-center justify-center text-foreground transition-colors duration-75 active:bg-band disabled:text-muted-foreground/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring';

/** The till's quantity control: fewer · the count · more, as one segmented 44px control. */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
}) {
  return (
    <div
      className={cn('flex h-11 items-stretch divide-x divide-border overflow-hidden rounded-md border border-border bg-card', className)}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="One fewer"
        className={STEP}
      >
        <Minus size={18} aria-hidden="true" />
      </button>
      <span
        data-figure
        className="flex w-12 items-center justify-center text-base font-semibold tabular-nums text-heading"
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="One more"
        className={STEP}
      >
        <Plus size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
