'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useId } from 'react';

import type { IconComponent } from '@/components/icons';

import { cn } from '@/lib/utils/cn';

export interface SectionTab<T extends string> {
  value: T;
  label: string;
  icon?: IconComponent;
  /**
   * Count pill after the label — hidden when 0 or undefined. Policy: a count is
   * only for things WAITING on someone (pending approvals, failed sends, open
   * requests). A tab is not a total of what it lists — that number belongs in the
   * page, once, if anywhere.
   */
  count?: number;
  /** Tint for the count pill. Use `danger` for counts that need attention (failures). */
  countTone?: 'default' | 'danger';
  /** Spoken/hover description of the count, e.g. "2 failed emails". */
  countLabel?: string;
}

/**
 * Underline tab bar for the section nav of a full-page view, like the marketing
 * site: labels on the page colour over a hairline, the active one in heading
 * ink with a short bar under it that slides between tabs. Pass it to
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
  // The active underline is one shared element that slides between tabs. Scoped
  // per bar, so two bars on a page never animate into each other.
  const generatedId = useId();
  const indicatorId = animationId ?? generatedId;
  const reduceMotion = useReducedMotion();
  return (
    // px matches the app header's px-3 md:px-6 so tabs, masthead and body all
    // sit on one left edge.
    <nav className="border-b border-border bg-field px-3 md:px-6 overflow-x-auto shrink-0" aria-label={ariaLabel}>
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
                'relative h-11 px-3 flex items-center gap-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                active ? 'text-heading' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {active && (
                <motion.span
                  layoutId={indicatorId}
                  aria-hidden="true"
                  transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }}
                  className="absolute inset-x-3 -bottom-px z-0 h-0.5 rounded-full bg-heading"
                />
              )}
              {/* z-10 across the whole bar: the sliding underline never covers a label. */}
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
