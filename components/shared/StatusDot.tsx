import { cn } from '@/lib/utils/cn';

import { TONE_FILL, type Tone } from './tone';

/** A status as a dot, with its word kept for screen readers and on hover.
    `pulse` is for something happening now (a running shift, a live service);
    `dashed` for something not yet real (a draft). */
export function StatusDot({
  tone,
  label,
  pulse = false,
  dashed = false,
  className,
}: {
  tone: Tone;
  label: string;
  pulse?: boolean;
  dashed?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('relative inline-flex size-2 shrink-0', className)} title={label}>
      {pulse && (
        <span
          className={cn('absolute inset-0 animate-ping rounded-full opacity-60 motion-reduce:hidden', TONE_FILL[tone])}
          aria-hidden="true"
        />
      )}
      <span
        className={cn(
          'relative inline-flex size-2 rounded-full',
          dashed ? 'border border-dashed border-muted-foreground bg-transparent' : TONE_FILL[tone],
        )}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
