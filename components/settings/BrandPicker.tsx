'use client';

import { useId } from 'react';

import { Check } from '@/components/icons';
import { BRANDS, type Brand } from '@/lib/utils/brand';
import { cn } from '@/lib/utils/cn';

/**
 * The brand colour picker. Each swatch carries its own `data-brand`, so it is
 * painted by the same globals.css block that would paint the app — no hex
 * values here, and in night mode the swatches show the night key.
 */
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {BRANDS.map((choice) => {
          const active = value === choice.id;
          return (
            <label
              key={choice.id}
              data-brand={choice.id}
              className={cn(
                'group relative flex cursor-pointer flex-col in-disabled:cursor-default gap-3 rounded-lg border bg-field p-3 text-left',
                'transition-[border-color,background-color,box-shadow] duration-150',
                'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring',
                active ? 'border-(--brand) shadow-[inset_0_0_0_1px_var(--brand)]' : 'border-rule/70 hover:border-rule hover:bg-band/45',
              )}
            >
              <input
                type="radio"
                name={name}
                value={choice.id}
                checked={active}
                onChange={() => onChange(choice.id)}
                className="sr-only"
              />
              <span aria-hidden="true" className="flex h-10 items-center justify-center rounded-md bg-(--brand) text-(--brand-on)">
                {active && <Check size={18} strokeWidth={3} />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-snug text-foreground">{choice.label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{choice.detail}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
