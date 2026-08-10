import type { IconComponent } from '@/components/icons';

import { cn } from '@/lib/utils/cn';

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: string;
  /** Drawn before the label — or on its own when the control is `iconOnly`. */
  icon?: IconComponent;
}

interface SegmentedControlProps<T extends string = string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** 'lg' bumps the touch targets — for touch-first screens like the POS. */
  size?: 'default' | 'lg';
  /** Square icon buttons; each label becomes the accessible name. Needs `icon`s. */
  iconOnly?: boolean;
  /** Names the group for screen readers — worth setting when `iconOnly`. */
  ariaLabel?: string;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'default',
  iconOnly = false,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'flex items-center gap-0 bg-band w-fit max-w-full min-w-0 p-0.5 rounded-md border border-rule/70 overflow-x-auto',
        size === 'lg' ? 'h-11' : 'h-9',
        className,
      )}
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            aria-label={iconOnly ? opt.label : undefined}
            title={iconOnly ? opt.label : undefined}
            className={cn(
              'shrink-0 flex items-center justify-center gap-1.5 rounded-sm text-xs font-semibold transition-[background-color,color,box-shadow] duration-150',
              size === 'lg' ? 'h-9' : 'h-7',
              iconOnly ? (size === 'lg' ? 'w-9' : 'w-7') : 'px-4',
              active ? 'bg-card text-foreground shadow-sm' : 'bg-transparent text-muted-foreground hover:bg-card/45 hover:text-foreground',
            )}
          >
            {Icon && <Icon size={size === 'lg' ? 18 : 16} aria-hidden="true" />}
            {!iconOnly && opt.label}
          </button>
        );
      })}
    </div>
  );
}
