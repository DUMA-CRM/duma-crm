'use client';

import { Popover } from 'radix-ui';
import { useState } from 'react';

import { ChevronDown } from '@/components/icons';

import { cn } from '@/lib/utils';

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  value: string[];
  onChange: (next: string[]) => void;
  options: MultiSelectOption[];
  /** Shown on the trigger when nothing is chosen — say what "nothing" means. */
  placeholder: string;
  ariaLabel: string;
  className?: string;
  contentClassName?: string;
  disabled?: boolean;
}

/**
 * Pick several from a list.
 *
 * Radix `Select` is single-choice by construction, so long multi-value filters
 * were being drawn as walls of toggle chips — twenty-two of them for the FSA
 * allergens and dietary preferences alone, which is a form pretending to be a
 * control. This is the same trigger as `Select` so the two read as one control
 * family, with real checkboxes inside: native, tabbable, and announced as a
 * group without any invented keyboard handling.
 *
 * The trigger names the choice rather than counting it — "Peanuts +2" tells a
 * manager what is filtering the list; "3 selected" makes them open it to find out.
 */
function MultiSelect({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  className,
  contentClassName,
  disabled,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);

  const chosen = options.filter((option) => value.includes(option.value));
  const summary =
    chosen.length === 0 ? placeholder : chosen.length === 1 ? chosen[0]!.label : `${chosen[0]!.label} +${chosen.length - 1}`;

  const toggle = (optionValue: string) => {
    const next = value.includes(optionValue) ? value.filter((item) => item !== optionValue) : [...value, optionValue];
    onChange(next);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={ariaLabel}
        disabled={disabled}
        className={cn(
          // Matches the Select trigger exactly: same fill, same border token, so
          // a select and a multi-select side by side are the same control.
          'inline-flex h-9 min-w-0 items-center gap-2 rounded-sm border border-input bg-field px-3 text-base text-foreground outline-none sm:text-sm',
          'transition-[border-color,outline-color,background-color] duration-100 hover:bg-band aria-expanded:bg-band',
          'focus:border-measured focus:outline-2 focus:outline-offset-0 focus:outline-measured',
          'disabled:cursor-not-allowed disabled:opacity-50',
          chosen.length === 0 && 'text-muted-foreground',
          className,
        )}
      >
        <span className="min-w-0 flex-1 truncate text-left">{summary}</span>
        <ChevronDown size={14} className="ml-auto shrink-0 text-muted-foreground" aria-hidden="true" />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            'z-100 min-w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] overflow-hidden',
            'rounded-sm border border-rule bg-surface shadow-lg outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            contentClassName,
          )}
        >
          <div
            role="group"
            aria-label={ariaLabel}
            className="max-h-[min(18rem,var(--radix-popover-content-available-height))] overflow-y-auto p-1"
          >
            {options.map((option) => {
              const on = value.includes(option.value);
              return (
                <label
                  key={option.value}
                  className={cn(
                    'flex min-h-9 cursor-pointer select-none items-center gap-2.5 rounded-sm px-2.5 text-base sm:text-sm',
                    'hover:bg-band has-[:focus-visible]:bg-band',
                    on ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(option.value)}
                    className="size-4 shrink-0 rounded accent-primary"
                  />
                  <span className="min-w-0 truncate">{option.label}</span>
                </label>
              );
            })}
          </div>

          {chosen.length > 0 && (
            <div className="border-t border-rule/60 p-1">
              <button
                type="button"
                onClick={() => onChange([])}
                className="flex min-h-8 w-full items-center rounded-sm px-2.5 text-xs font-semibold text-muted-foreground hover:bg-band hover:text-foreground"
              >
                Clear {chosen.length} selected
              </button>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export { MultiSelect };
