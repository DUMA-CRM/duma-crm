import type { ReactNode } from 'react';

import { type IconComponent, X } from '@/components/icons';
import { FIELD_LABEL_CLASS } from '@/components/ui/label';

import { cn } from '@/lib/utils/cn';

/**
 * One active filter, stated in words and removable on the spot.
 *
 * The chip row is what lets a filter toolbar collapse: the controls can hide
 * behind a popover because the *state* they produced never does. A filter the
 * user cannot see is a filter they will blame the data for.
 */
export function FilterChip({
  label,
  onRemove,
  variant = 'pill',
  icon: Icon,
}: {
  label: string;
  onRemove: () => void;
  variant?: 'pill' | 'tag';
  icon?: IconComponent;
}) {
  const tag = variant === 'tag';
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center rounded-md bg-band pl-2.5 text-xs font-medium text-foreground',
        tag ? 'min-h-8 gap-2 pr-1' : 'h-7 gap-1.5 pr-1',
      )}
    >
      {Icon && <Icon size={14} aria-hidden="true" className="shrink-0" />}
      <span className="max-w-52 truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
        className={cn(
          'flex shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-foreground/8 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
          tag ? 'size-7' : 'size-5',
        )}
      >
        <X size={tag ? 13 : 11} aria-hidden="true" />
      </button>
    </span>
  );
}

/** One control in a filter popover, with its label above it. */
export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className={cn(FIELD_LABEL_CLASS, 'mb-1.5')}>{label}</p>
      {children}
    </div>
  );
}
