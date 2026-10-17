import { type IconComponent, X } from '@/components/icons';

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
        'inline-flex max-w-full items-center border pl-2.5 text-xs font-medium text-primary',
        tag
          ? 'min-h-8 gap-2 rounded-md border-primary/25 bg-primary/5 pr-1'
          : 'h-7 gap-1.5 rounded-full border-primary/20 bg-primary/8 pr-1.5',
      )}
    >
      {Icon && <Icon size={14} aria-hidden="true" className="shrink-0" />}
      <span className="max-w-52 truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
        className={cn(
          'flex shrink-0 items-center justify-center hover:bg-band',
          tag
            ? 'size-7 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
            : 'size-5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
        )}
      >
        <X size={tag ? 13 : 11} aria-hidden="true" />
      </button>
    </span>
  );
}
