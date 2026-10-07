'use client';

import { useId, useState } from 'react';

import { type IconComponent, X } from '@/components/icons';

import { cn } from '@/lib/utils/cn';

import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { WheelPickerWrapper } from './wheel-picker';

export interface WheelFieldProps {
  /** What the closed field reads, e.g. "09:41" or "1 h 30 min". '' shows the placeholder. */
  display: string;
  icon: IconComponent;
  id?: string;
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
  /** Shown when set and not required: empties the value. */
  onClear?: () => void;
  /** Width of the wheel well, e.g. `w-40`. */
  wheelsClassName?: string;
  /** Short read-out beside Done, usually the current value in words. */
  summary?: string;
  /** The `WheelPicker`s. */
  children: React.ReactNode;
}

/**
 * The shell every wheel control shares: an `Input`-shaped trigger that opens
 * wheels in the same popover as the date picker. Wheels set the value as they
 * spin; Done only closes. Time, duration, amount + unit and bounded numbers
 * are all this, with different wheels inside.
 */
export function WheelField({
  display,
  icon: Icon,
  id,
  label,
  hint,
  error,
  required,
  disabled,
  placeholder = '—',
  className,
  'aria-label': ariaLabel,
  onClear,
  wheelsClassName = 'w-40',
  summary,
  children,
}: WheelFieldProps) {
  const generatedId = useId();
  const triggerId = id ?? `wheel-${generatedId}`;
  const [open, setOpen] = useState(false);
  const describedBy = error ? `${triggerId}-error` : hint ? `${triggerId}-hint` : undefined;
  const clearable = Boolean(display && onClear && !required && !disabled);

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && (
        <label htmlFor={triggerId} className="block text-label uppercase text-muted-foreground">
          {label}
          {required && (
            <span className="ml-1 text-exception" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <Popover open={open && !disabled} onOpenChange={setOpen}>
        <div className="relative flex items-center">
          <PopoverTrigger asChild>
            <button
              id={triggerId}
              type="button"
              disabled={disabled}
              aria-label={label ? undefined : ariaLabel}
              aria-describedby={describedBy}
              aria-haspopup="dialog"
              className={cn(
                // The `Input` field exactly: height, hairline, fill and the amber focus marker.
                'flex h-9 w-full items-center rounded-md border border-input bg-control pl-3 pr-9 text-left text-base text-foreground shadow-sm outline-none sm:text-sm',
                'tabular-nums transition-[border-color,outline-color] duration-150 focus-visible:border-measured focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-measured',
                open && 'border-measured',
                error && 'border-exception focus-visible:border-exception focus-visible:outline-exception',
                'disabled:cursor-not-allowed disabled:opacity-50',
                className,
              )}
            >
              <span className={cn('truncate', !display && 'text-muted-foreground')}>{display || placeholder}</span>
            </button>
          </PopoverTrigger>
          {clearable ? (
            <button
              type="button"
              aria-label="Clear"
              onClick={onClear}
              className="absolute right-1.5 rounded-sm p-1.5 text-muted-foreground hover:bg-band hover:text-foreground"
            >
              <X size={14} aria-hidden="true" />
            </button>
          ) : (
            <Icon size={15} className="pointer-events-none absolute right-3 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
        <PopoverContent aria-label={label ?? ariaLabel ?? 'Choose a value'} className="w-auto p-2">
          <WheelPickerWrapper className={wheelsClassName}>{children}</WheelPickerWrapper>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="pl-1 text-xs tabular-nums text-muted-foreground">{summary ?? 'Spin to set'}</span>
            <Button size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {error ? (
        <p id={`${triggerId}-error`} role="alert" className="text-xs text-exception">
          {error}
        </p>
      ) : hint ? (
        <p id={`${triggerId}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Options for a numeric wheel, labelled by `label` (two digits by default). */
export const numberOptions = (values: readonly number[], label: (value: number) => string = (value) => String(value).padStart(2, '0')) =>
  values.map((value) => ({ value, label: label(value) }));
