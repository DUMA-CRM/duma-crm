'use client';

import { Select as SelectPrimitive } from 'radix-ui';
import { type ReactNode, useRef } from 'react';

import { Check, ChevronDown } from '@/components/icons';

import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  ariaLabel: string;
  id?: string;
  name?: string;
  required?: boolean;
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
  placeholder?: string;
  icon?: ReactNode;
  className?: string;
  contentClassName?: string;
  disabled?: boolean;
}

const EMPTY_VALUE = '__duma_select_empty__';

function Select({
  value,
  onValueChange,
  options,
  ariaLabel,
  id,
  name,
  required,
  ariaDescribedBy,
  ariaInvalid,
  placeholder = 'Select…',
  icon,
  className,
  contentClassName,
  disabled,
}: SelectProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <SelectPrimitive.Root
      value={value || EMPTY_VALUE}
      onValueChange={(nextValue) => {
        const resolvedValue = nextValue === EMPTY_VALUE ? '' : nextValue;
        onValueChange(resolvedValue);
        triggerRef.current?.dispatchEvent(
          new CustomEvent('duma:select-change', { bubbles: true, detail: { value: resolvedValue } }),
        );
      }}
      disabled={disabled}
      name={name}
      required={required}
    >
      <SelectPrimitive.Trigger
        ref={triggerRef}
        id={id}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid || undefined}
        aria-required={required || undefined}
        className={cn(
          // Matches Input: same fill, same border token, so a select and a text
          // field sitting side by side read as one control family.
          'inline-flex h-9 min-w-0 items-center gap-2 rounded-sm border border-input bg-field px-3 text-base text-foreground outline-none sm:text-sm',
          'transition-[border-color,outline-color,background-color] duration-100 hover:bg-band',
          'focus:border-measured focus:outline-2 focus:outline-offset-0 focus:outline-measured',
          'aria-invalid:border-exception aria-invalid:text-exception',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
      >
        {icon && <span className="shrink-0 text-muted-foreground [&>svg]:size-3.5">{icon}</span>}
        <SelectPrimitive.Value placeholder={placeholder} className="min-w-0 flex-1 truncate text-left" />
        <SelectPrimitive.Icon className="ml-auto shrink-0 text-muted-foreground">
          <ChevronDown size={14} aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            'z-[100] min-w-[var(--radix-select-trigger-width)] max-h-[min(20rem,var(--radix-select-content-available-height))] overflow-hidden',
            // A callout off the plot: hairline box, real drop because it floats.
            'rounded-sm border border-rule bg-surface shadow-lg',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            contentClassName,
          )}
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value || EMPTY_VALUE}
                disabled={option.disabled}
                className={cn(
                  'relative flex min-h-9 cursor-default select-none items-center rounded-sm py-2 pl-3 pr-9 text-base text-foreground outline-none sm:text-sm',
                  'data-[highlighted]:bg-band data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
                )}
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-3 inline-flex items-center text-measured">
                  <Check size={14} aria-hidden="true" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export { Select };
