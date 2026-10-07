import type { IconComponent } from '@/components/icons';

import { cn } from '@/lib/utils/cn';

import { TONE_TINT, type Tone } from './tone';

/** A short tinted status label. Reach for it for an exception worth reading
    (Overdue, Refunded, Expired); an ordinary state is a `StatusDot` or `IconTag`. */
export function Pill({
  tone,
  icon: Icon,
  children,
  className,
}: {
  tone: Tone;
  icon?: IconComponent;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1 rounded-sm px-2 text-xs font-semibold whitespace-nowrap',
        TONE_TINT[tone],
        className,
      )}
    >
      {Icon && <Icon size={12} aria-hidden="true" />}
      {children}
    </span>
  );
}
