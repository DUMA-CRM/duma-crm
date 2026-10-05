'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useId } from 'react';

import type { IconComponent } from '@/components/icons';

import { cn } from '@/lib/utils/cn';

export interface SectionTab<T extends string> {
  value: T;
  label: string;
  icon?: IconComponent;
  /** Count pill after the label — hidden when 0 or undefined. */
  count?: number;
  /** Tint for the count pill. Use `danger` for counts that need attention (failures). */
  countTone?: 'default' | 'danger';
  /** Spoken/hover description of the count, e.g. "2 failed emails". */
  countLabel?: string;
}

/**
 * Underline tab bar for the section nav of a full-page view. Pass it to
 * `EditorShell`'s `subheader` so it pins below the header and above the body.
 */
export function SectionTabs<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
  animationId,
}: {
  tabs: SectionTab<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  /**
   * Stable id for the sliding indicator. Only needed when each tab is its own
   * route that mounts a fresh bar (menu items / categories / modifiers): the
   * shared id lets the indicator slide from the bar that just unmounted.
   */
  animationId?: string;
}) {
  // The active "folder" is one shared element that slides between tabs. Scoped
  // per bar, so two bars on a page never animate into each other.
  const generatedId = useId();
  const indicatorId = animationId ?? generatedId;
  const reduceMotion = useReducedMotion();
  return (
    // px matches the app header's px-3 md:px-6 so tabs, masthead and body all
    // sit on one left edge.
    <nav className="border-b border-rule/70 bg-band/70 px-3 pt-2 md:px-6 overflow-x-auto shrink-0" aria-label={ariaLabel}>
      <div className="flex min-w-max gap-1" role="tablist">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = value === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.value)}
              className={cn(
                'relative h-10 px-3 md:px-4 -mb-px rounded-t-md flex items-center gap-2 text-sm font-semibold transition-colors',
                active ? 'text-foreground' : 'text-muted-foreground hover:bg-card/45 hover:text-foreground',
              )}
            >
              {active && (
                <motion.span
                  layoutId={indicatorId}
                  aria-hidden="true"
                  transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }}
                  className="absolute inset-0 z-0 rounded-t-md border border-rule/70 border-b-card bg-card"
                />
              )}
              {/* z-10 across the whole bar: the sliding folder passes under every label, not just its own. */}
              {Icon && <Icon size={15} aria-hidden="true" className="relative z-10" />}
              <span className="relative z-10">{tab.label}</span>
              {!!tab.count && (
                <span
                  title={tab.countLabel}
                  aria-label={tab.countLabel}
                  className={cn(
                    'relative z-10 h-5 min-w-5 px-1.5 rounded-sm flex items-center justify-center text-label font-semibold tabular-nums',
                    tab.countTone === 'danger'
                      ? 'bg-destructive/6 text-destructive'
                      : active
                        ? 'bg-band text-primary'
                        : 'bg-muted text-muted-foreground',
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
