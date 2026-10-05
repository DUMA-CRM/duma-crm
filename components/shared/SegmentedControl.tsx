'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useId } from 'react';

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
  const reduceMotion = useReducedMotion();
  // One indicator per control, so two switches on a page never trade theirs.
  const indicatorId = useId();

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'flex items-center gap-0.5 bg-band/70 w-fit max-w-full min-w-0 p-0.5 rounded-md border border-rule/60 overflow-x-auto',
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
              'relative shrink-0 flex items-center justify-center gap-1.5 rounded-[5px] text-xs font-semibold transition-colors duration-150',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
              size === 'lg' ? 'h-9' : 'h-7',
              iconOnly ? (size === 'lg' ? 'w-9' : 'w-7') : 'px-3.5',
              active ? 'text-foreground' : 'text-muted-foreground hover:bg-card/50 hover:text-foreground',
            )}
          >
            {/* The same sliding "sheet" as the section tabs: one element that
                moves to the chosen option, under the label rather than over it. */}
            {active && (
              <motion.span
                layoutId={indicatorId}
                aria-hidden="true"
                className="absolute inset-0 rounded-[5px] border border-rule/50 bg-card shadow-sm"
                transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 40 }}
              />
            )}
            {Icon && <Icon size={size === 'lg' ? 18 : 16} aria-hidden="true" className="relative z-10" />}
            {!iconOnly && <span className="relative z-10">{opt.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
