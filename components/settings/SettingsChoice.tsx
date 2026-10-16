'use client';

import { useId } from 'react';

import { Check, type IconComponent } from '@/components/icons';

import { cn } from '@/lib/utils/cn';

interface SettingsChoiceProps<T extends string> {
  label: string;
  value: T | undefined;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string; icon: IconComponent }[];
}

/** Compact native radios shared by theme and other settings choices. */
export function SettingsChoice<T extends string>({ label, value, onChange, options }: SettingsChoiceProps<T>) {
  const name = useId();
  return (
    <fieldset>
      <legend className="sr-only">{label}</legend>
      <div className={cn('grid gap-2', options.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
        {options.map(({ value: option, label: optionLabel, icon: Icon }) => {
          const active = value === option;
          return (
            <label
              key={option}
              className={cn(
                'flex min-h-11 cursor-pointer items-center justify-between gap-1 rounded-md border bg-field px-2 text-sm font-medium text-foreground transition-[border-color,background-color,box-shadow] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring in-disabled:cursor-default',
                active
                  ? 'border-primary bg-primary/5 shadow-[inset_0_0_0_1px_var(--primary)]'
                  : 'border-rule/70 hover:border-rule hover:bg-band/45',
              )}
            >
              <input type="radio" name={name} value={option} checked={active} onChange={() => onChange(option)} className="sr-only" />
              <span className="flex min-w-0 items-center gap-1">
                <Icon size={16} aria-hidden="true" className="shrink-0" />
                <span>{optionLabel}</span>
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                  active ? 'border-primary bg-primary text-primary-foreground' : 'border-rule/70 text-muted-foreground',
                )}
              >
                {active && <Check size={12} strokeWidth={3} />}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
