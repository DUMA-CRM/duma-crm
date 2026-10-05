'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useId } from 'react';

import { Check } from '@/components/icons';
import { cn } from '@/lib/utils/cn';

type Icon = typeof Check;

export interface Choice<T extends string> {
  value: T;
  label: string;
  detail?: string;
  icon?: Icon;
  /** Take the whole row, e.g. a "both" that combines the options above it. */
  wide?: boolean;
}

interface ChoiceGridProps<T extends string> {
  label: string;
  choices: readonly Choice<T>[];
  selected: readonly T[];
  multiple?: boolean;
  onChange: (value: T) => void;
  columns?: 1 | 2 | 3;
  /** Number keys 1–9 pick a card. On for the one-question onboarding screens; off anywhere a page holds several grids. */
  shortcuts?: boolean;
}

/**
 * Big answer cards. Native radio/checkbox inputs underneath, so arrow keys,
 * Space and screen readers behave as they would on any form; number keys 1–9
 * pick a card directly while focus is not in a text field.
 */
export function ChoiceGrid<T extends string>({
  label,
  choices,
  selected,
  multiple = false,
  onChange,
  columns = 2,
  shortcuts = true,
}: ChoiceGridProps<T>) {
  const name = useId();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!shortcuts) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input[type=text], input[type=email], input[type=password], input[type=number], textarea')) return;
      const index = Number(event.key) - 1;
      if (Number.isInteger(index) && index >= 0 && index < choices.length) {
        event.preventDefault();
        onChange(choices[index].value);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [choices, onChange, shortcuts]);

  return (
    <fieldset>
      <legend className="sr-only">{label}</legend>
      <div className={cn('grid gap-3', columns === 2 && 'sm:grid-cols-2', columns === 3 && 'sm:grid-cols-3')}>
        {choices.map((choice, index) => {
          const active = selected.includes(choice.value);
          const Icon = choice.icon;
          // Three across is too narrow for icon | text | marker in a row; stack it instead.
          const stacked = columns === 3;
          const icon = Icon && (
            <span
              className={cn(
                'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border transition-colors',
                active ? 'border-primary/40 bg-primary text-primary-foreground' : 'border-rule/55 bg-background text-muted-foreground group-hover:text-foreground',
              )}
            >
              <Icon size={18} aria-hidden="true" />
            </span>
          );
          const marker = (
            <span
              aria-hidden="true"
              className={cn(
                'mt-0.5 flex size-5 shrink-0 items-center justify-center border text-micro tabular-nums transition-colors',
                multiple ? 'rounded-[5px]' : 'rounded-full',
                active ? 'border-primary bg-primary text-primary-foreground' : 'border-rule/70 text-muted-foreground',
              )}
            >
              {active ? <Check size={12} strokeWidth={3} /> : shortcuts && index < 9 ? index + 1 : null}
            </span>
          );
          const text = (
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold leading-snug text-foreground">{choice.label}</span>
              {choice.detail && <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground">{choice.detail}</span>}
            </span>
          );
          return (
            <motion.label
              key={choice.value}
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : 0.12 + index * 0.04, duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              whileTap={reduceMotion ? undefined : { scale: 0.985 }}
              className={cn(
                // In two columns an odd last card fills its row instead of leaving a hole beside it.
                (choice.wide || (columns === 2 && choices.length % 2 === 1 && index === choices.length - 1)) && 'sm:col-span-full',
                'group relative flex min-h-16 cursor-pointer gap-3.5 rounded-lg border bg-field px-4 py-3.5 text-left',
                stacked ? 'flex-col' : 'items-start',
                'transition-[border-color,background-color,box-shadow] duration-150',
                'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring',
                active
                  ? 'border-primary bg-primary/5 shadow-[inset_0_0_0_1px_var(--primary)]'
                  : 'border-rule/70 hover:border-rule hover:bg-band/45',
              )}
            >
              <input
                type={multiple ? 'checkbox' : 'radio'}
                name={name}
                value={choice.value}
                checked={active}
                onChange={() => onChange(choice.value)}
                className="sr-only"
              />
              {stacked ? (
                <>
                  <span className="flex items-start justify-between gap-3">
                    {icon}
                    {marker}
                  </span>
                  {text}
                </>
              ) : (
                <>
                  {icon}
                  {text}
                  {marker}
                </>
              )}
            </motion.label>
          );
        })}
      </div>
    </fieldset>
  );
}
