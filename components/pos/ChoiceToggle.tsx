'use client';

import type { IconComponent } from '@/components/icons';

import { cn } from '@/lib/utils/cn';

export interface ChoiceToggleOption<T extends string> {
  value: T;
  label: string;
  icon?: IconComponent;
}

/**
 * The till's choice buttons — Eat in / Takeaway first — as one component, so
 * anywhere an order is taken (the till, the Orders page's New order) picks the
 * same way: bordered 44px keys, the chosen one in the primary tint. Labels stay
 * on one line; give a long set more rows (`columns`) rather than squeezing it.
 *
 * `clearable` lets a second tap on the chosen one clear it (`onChange(null)`),
 * for an optional choice a till that doesn't ask never has to make.
 */
export function ChoiceToggle<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  columns = options.length,
  clearable = false,
  className,
}: {
  options: readonly ChoiceToggleOption<T>[];
  value: T | null;
  ariaLabel: string;
  columns?: number;
  className?: string;
} & ({ clearable: true; onChange: (value: T | null) => void } | { clearable?: false; onChange: (value: T) => void })) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn('grid gap-2', className)}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const active = value === option.value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => {
              if (!active) return onChange(option.value);
              if (clearable) (onChange as (value: T | null) => void)(null);
            }}
            className={cn(
              'flex h-11 min-w-0 touch-manipulation items-center justify-center gap-2 rounded-md border px-2 text-sm font-semibold whitespace-nowrap transition-colors duration-75',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              active
                ? 'border-primary bg-primary/8 text-primary'
                : 'border-border bg-card text-muted-foreground hover:text-foreground active:bg-band',
            )}
          >
            {Icon && <Icon size={16} className="shrink-0" aria-hidden="true" />}
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
