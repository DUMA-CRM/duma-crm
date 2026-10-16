'use client';

import { useId } from 'react';

import { Check } from '@/components/icons';
import { BRANDS, type Brand } from '@/lib/utils/brand';
import { cn } from '@/lib/utils/cn';

/** Colour-only swatches use the same brand tokens as the workspace. */
export function BrandPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: Brand | undefined;
  onChange: (brand: Brand) => void;
  disabled?: boolean;
}) {
  const name = useId();

  return (
    <fieldset disabled={disabled} className="disabled:opacity-60">
      <legend className="sr-only">Brand colour</legend>
      <div className="grid w-full grid-cols-2 gap-3">
        {BRANDS.map((choice) => {
          const active = value === choice.id;
          return (
            <label
              key={choice.id}
              data-brand={choice.id}
              className={cn(
                'relative flex h-16 w-full cursor-pointer items-center justify-center rounded-md border bg-(--brand) text-(--brand-on) in-disabled:cursor-default',
                'transition-[outline-color,opacity] duration-150 hover:opacity-90',
                'has-focus-visible:outline-2 has-focus-visible:outline-offset-4 has-focus-visible:outline-ring',
                active ? 'border-transparent outline-2 outline-offset-4 outline-primary' : 'border-rule/40',
              )}
            >
              <input
                type="radio"
                name={name}
                value={choice.id}
                aria-label={choice.label}
                checked={active}
                onChange={() => onChange(choice.id)}
                className="sr-only"
              />
              {active && <Check size={22} strokeWidth={3} aria-hidden="true" />}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
