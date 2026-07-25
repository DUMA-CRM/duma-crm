'use client';

import { Check, ChevronDown } from 'lucide-react';
import { Select as SelectPrimitive } from 'radix-ui';
import type { ReactNode } from 'react';

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
  return (
    <SelectPrimitive.Root
      value={value || EMPTY_VALUE}
      onValueChange={(nextValue) => onValueChange(nextValue === EMPTY_VALUE ? '' : nextValue)}
      disabled={disabled}
      name={name}
      required={required}
    >
      <SelectPrimitive.Trigger
        id={id}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid || undefined}
        aria-required={required || undefined}
        className={cn(
          'inline-flex h-9 min-w-0 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none',
          'transition-[border-color,box-shadow,background-color] duration-150 hover:bg-muted/50',
          'focus:border-primary focus:ring-2 focus:ring-primary/15',
          'aria-invalid:border-destructive/60 aria-invalid:ring-destructive/15',
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
            'rounded-xl border border-border bg-surface shadow-lg',
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
                  'relative flex min-h-9 cursor-default select-none items-center rounded-lg py-2 pl-3 pr-9 text-sm text-foreground outline-none',
                  'data-[highlighted]:bg-surface-offset data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
                )}
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-3 inline-flex items-center text-primary">
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
