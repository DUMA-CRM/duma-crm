'use client';

import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils/cn';

export interface SectionTab<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
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
}: {
  tabs: SectionTab<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <nav className="border-b border-border bg-card px-4 md:px-8 overflow-x-auto shrink-0" aria-label={ariaLabel}>
      <div className="flex min-w-max" role="tablist">
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
                'h-11 px-3 md:px-4 border-b-2 flex items-center gap-2 text-sm font-medium transition-colors',
                active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {Icon && <Icon size={15} aria-hidden="true" />}
              {tab.label}
              {!!tab.count && (
                <span
                  title={tab.countLabel}
                  aria-label={tab.countLabel}
                  className={cn(
                    'h-5 min-w-5 px-1.5 rounded-full flex items-center justify-center text-[11px] font-bold tabular-nums',
                    tab.countTone === 'danger'
                      ? 'bg-destructive/10 text-destructive'
                      : active
                        ? 'bg-primary/10 text-primary'
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
