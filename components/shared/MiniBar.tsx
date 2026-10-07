import { cn } from '@/lib/utils/cn';
import { meterGeometry } from '@/lib/utils/meter';

import { TONE_FILL, type Tone } from './tone';

/* A thin bar of a value against a whole or a target: stock against par, leave
   used of the allowance, a tier's points, an order received so far. It sits
   under or beside a number — it never replaces one, so `label` is required and
   names the reading for screen readers. */
export function MiniBar({
  value,
  max,
  target,
  tone = 'primary',
  label,
  /** Nothing to measure against yet (no par set): a dashed track, no fill. */
  unset = false,
  className,
}: {
  value: number;
  max?: number | null;
  target?: number | null;
  tone?: Tone;
  label: string;
  unset?: boolean;
  className?: string;
}) {
  const { fill, mark } = meterGeometry(value, max, target);
  return (
    <span
      role="meter"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max ?? target ?? undefined}
      title={label}
      className={cn(
        'relative block h-1.5 w-full overflow-hidden rounded-full',
        unset ? 'border border-dashed border-rule bg-transparent' : 'bg-band',
        className,
      )}
    >
      {!unset && <span className={cn('absolute inset-y-0 left-0 rounded-full', TONE_FILL[tone])} style={{ width: `${fill}%` }} />}
      {!unset && mark !== null && (
        <span className="absolute inset-y-0 w-px bg-foreground/45" style={{ left: `${mark}%` }} aria-hidden="true" />
      )}
    </span>
  );
}
